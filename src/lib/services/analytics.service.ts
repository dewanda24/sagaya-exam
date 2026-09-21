import { queryPostgres } from '../core/postgres';
import { AnalyticsContext, AnalyticsAuthService } from '../core/analytics-auth';
import { AnalyticsCacheService } from './analytics-cache.service';

export interface ScoreDistributionBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface ScoreSummaryStats {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile90: number;
  passingGrade: number;
  passedCount: number;
  failedCount: number;
  passRatePercentage: number;
  distributionBuckets: ScoreDistributionBucket[];
  gradeBrackets: {
    gradeA: { count: number; percentage: number }; // 85-100
    gradeB: { count: number; percentage: number }; // 70-84
    gradeC: { count: number; percentage: number }; // 55-69
    gradeD: { count: number; percentage: number }; // <55
  };
}

export class AnalyticsService {
  /**
   * Helper kalkulasi statistik nilai: Mean, Median, Min, Max, Standard Deviation, Percentiles, Buckets
   */
  static computeScoreStats(
    scores: number[],
    passingGrade: number = 75,
    customBucketStep: number = 10
  ): ScoreSummaryStats {
    const count = scores.length;
    if (count === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        standardDeviation: 0,
        percentile25: 0,
        percentile50: 0,
        percentile75: 0,
        percentile90: 0,
        passingGrade,
        passedCount: 0,
        failedCount: 0,
        passRatePercentage: 0,
        distributionBuckets: [],
        gradeBrackets: {
          gradeA: { count: 0, percentage: 0 },
          gradeB: { count: 0, percentage: 0 },
          gradeC: { count: 0, percentage: 0 },
          gradeD: { count: 0, percentage: 0 },
        },
      };
    }

    const sorted = [...scores].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = Math.round((sum / count) * 100) / 100;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // Median
    const mid = Math.floor(count / 2);
    const median = count % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;

    // Standard Deviation (Sample Standard Deviation if N > 1, else 0)
    let variance = 0;
    if (count > 1) {
      const squaredDiffs = sorted.map((val) => Math.pow(val - mean, 2));
      const sumSquaredDiffs = squaredDiffs.reduce((acc, val) => acc + val, 0);
      variance = sumSquaredDiffs / (count - 1);
    }
    const standardDeviation = Math.round(Math.sqrt(variance) * 100) / 100;

    // Percentiles (Nearest-rank / linear interpolation)
    const getPercentile = (p: number): number => {
      const index = (p / 100) * (count - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      if (lower === upper) return sorted[lower];
      return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 100) / 100;
    };

    const percentile25 = getPercentile(25);
    const percentile50 = median;
    const percentile75 = getPercentile(75);
    const percentile90 = getPercentile(90);

    // Pass / Fail
    let passedCount = 0;
    let gradeACount = 0;
    let gradeBCount = 0;
    let gradeCCount = 0;
    let gradeDCount = 0;

    for (const s of sorted) {
      if (s >= passingGrade) passedCount++;
      if (s >= 85) gradeACount++;
      else if (s >= 70) gradeBCount++;
      else if (s >= 55) gradeCCount++;
      else gradeDCount++;
    }

    const failedCount = count - passedCount;
    const passRatePercentage = Math.round((passedCount / count) * 10000) / 100;

    // Buckets: 0-9, 10-19, ..., 90-100
    const buckets: ScoreDistributionBucket[] = [];
    const step = customBucketStep > 0 ? customBucketStep : 10;
    for (let lower = 0; lower <= 100; lower += step) {
      const upper = lower + step === 100 ? 100 : lower + step - 1;
      if (lower > 100) break;
      const inBucket = sorted.filter((s) => s >= lower && (upper === 100 ? s <= upper : s <= upper));
      buckets.push({
        range: `${lower}-${upper}`,
        min: lower,
        max: upper,
        count: inBucket.length,
        percentage: Math.round((inBucket.length / count) * 10000) / 100,
      });
      if (upper === 100) break;
    }

    return {
      count,
      mean,
      median,
      min,
      max,
      standardDeviation,
      percentile25,
      percentile50,
      percentile75,
      percentile90,
      passingGrade,
      passedCount,
      failedCount,
      passRatePercentage,
      distributionBuckets: buckets,
      gradeBrackets: {
        gradeA: { count: gradeACount, percentage: Math.round((gradeACount / count) * 10000) / 100 },
        gradeB: { count: gradeBCount, percentage: Math.round((gradeBCount / count) * 10000) / 100 },
        gradeC: { count: gradeCCount, percentage: Math.round((gradeCCount / count) * 10000) / 100 },
        gradeD: { count: gradeDCount, percentage: Math.round((gradeDCount / count) * 10000) / 100 },
      },
    };
  }

  /**
   * 1. Analitik Ujian Terpusat (getExamAnalytics)
   */
  static async getExamAnalytics(
    context: AnalyticsContext,
    examId: string,
    filters?: { classId?: string; resultStatus?: string; includePending?: boolean }
  ) {
    const { schoolId } = await AnalyticsAuthService.assertExamAccess(context, examId);

    const filterHash = AnalyticsCacheService.hashFilters({ examId, ...filters });
    const cacheKey = AnalyticsCacheService.buildCacheKey(schoolId, 'EXAM_ANALYTICS', filterHash);
    const cached = AnalyticsCacheService.get<any>(cacheKey);
    if (cached) return cached;

    // Ambil metadata ujian
    const examRes = await queryPostgres(
      `SELECT e.id, e.title, e.passing_grade, e.duration_minutes, e.start_time, e.end_time,
              s.name as subject_name
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       WHERE e.id = $1 AND e.school_id = $2;`,
      [examId, schoolId]
    );

    if (examRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan.');
    }
    const exam = examRes.rows[0];
    const passingGrade = parseFloat(exam.passing_grade || '75');

    // Ambil partisipan, sesi, dan hasil
    let sql = `
      SELECT ep.id as participant_id, ep.student_id,
             st.class_room_id,
             es.id as session_id, es.status as session_status,
             es.started_at, es.server_started_at, es.submitted_at, es.tab_violation_count,
             er.id as result_id, er.final_score, er.status as result_status
      FROM exam_participants ep
      JOIN students st ON ep.student_id = st.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      LEFT JOIN exam_results er ON es.id = er.session_id
      WHERE ep.exam_id = $1 AND ep.school_id = $2
    `;
    const params: any[] = [examId, schoolId];

    if (filters?.classId) {
      params.push(filters.classId);
      sql += ` AND st.class_room_id = $${params.length}`;
    }

    const res = await queryPostgres(sql, params);
    const rows = res.rows;

    const registeredCount = rows.length;
    let startedCount = 0;
    let submittedCount = 0;
    let timeoutCount = 0;
    let terminatedCount = 0;
    let presentCount = 0;
    let absentCount = 0;
    let totalViolations = 0;

    const durationsMinutes: number[] = [];
    const validScores: number[] = [];

    for (const r of rows) {
      const sStatus = r.session_status;
      if (sStatus && sStatus !== 'CREATED' && sStatus !== 'READY') {
        presentCount++;
        startedCount++;
      } else {
        absentCount++;
      }

      if (sStatus === 'SUBMITTED') submittedCount++;
      else if (sStatus === 'TIMEOUT') timeoutCount++;
      else if (sStatus === 'TERMINATED') terminatedCount++;

      totalViolations += parseInt(r.tab_violation_count || '0', 10);

      // Durasi pengerjaan
      const start = r.started_at || r.server_started_at;
      if (start && r.submitted_at) {
        const diffMs = new Date(r.submitted_at).getTime() - new Date(start).getTime();
        const mins = Math.max(0, Math.round((diffMs / 60000) * 10) / 10);
        durationsMinutes.push(mins);
      }

      // Skor: Hanya status PUBLISHED, GRADED, REVIEWED (Pengecualian PENDING, PARTIALLY_GRADED, VOID)
      const allowedScoreStatuses = ['PUBLISHED', 'GRADED', 'REVIEWED'];
      if (filters?.includePending) {
        allowedScoreStatuses.push('PENDING', 'PARTIALLY_GRADED');
      }

      if (r.final_score !== null && r.final_score !== undefined && allowedScoreStatuses.includes(r.result_status)) {
        validScores.push(parseFloat(r.final_score));
      }
    }

    // Perhitungan Rasio / Rate
    const attendanceRate = registeredCount > 0 ? Math.round((presentCount / registeredCount) * 10000) / 100 : 0;
    const completionRate = startedCount > 0 ? Math.round((submittedCount / startedCount) * 10000) / 100 : 0;

    // Durasi pengerjaan rata-rata
    const avgDuration =
      durationsMinutes.length > 0
        ? Math.round((durationsMinutes.reduce((a, b) => a + b, 0) / durationsMinutes.length) * 10) / 10
        : 0;

    // Statistik Skor Terpusat
    const scoreStats = this.computeScoreStats(validScores, passingGrade);

    // Rincian Pelanggaran
    const violationSummaryRes = await queryPostgres(
      `SELECT type, severity, COUNT(*) as count 
       FROM exam_session_violations 
       WHERE exam_id = $1 AND school_id = $2 
       GROUP BY type, severity 
       ORDER BY count DESC;`,
      [examId, schoolId]
    );

    const analyticsData = {
      exam: {
        id: exam.id,
        title: exam.title,
        subjectName: exam.subject_name,
        passingGrade,
        allocatedDurationMinutes: exam.duration_minutes,
      },
      participation: {
        registered: registeredCount,
        present: presentCount,
        absent: absentCount,
        attendanceRatePercentage: attendanceRate,
      },
      sessions: {
        started: startedCount,
        completed: submittedCount,
        timeout: timeoutCount,
        terminated: terminatedCount,
        completionRatePercentage: completionRate,
        averageDurationMinutes: avgDuration,
      },
      scores: scoreStats,
      violations: {
        totalEvents: totalViolations,
        breakdown: violationSummaryRes.rows.map((v) => ({
          type: v.type,
          severity: v.severity,
          count: parseInt(v.count, 10),
        })),
      },
    };

    AnalyticsCacheService.set(cacheKey, analyticsData);
    return analyticsData;
  }

  /**
   * 2. Analitik Siswa (getStudentAnalytics)
   */
  static async getStudentAnalytics(context: AnalyticsContext, targetStudentId: string) {
    const { schoolId } = await AnalyticsAuthService.assertStudentAccess(context, targetStudentId);

    const studentRes = await queryPostgres(
      `SELECT s.id, s.nis, s.nisn, s.full_name, c.name as class_name 
       FROM students s
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       WHERE s.id = $1 AND s.school_id = $2;`,
      [targetStudentId, schoolId]
    );

    if (studentRes.rows.length === 0) {
      throw new Error('Siswa tidak ditemukan.');
    }
    const student = studentRes.rows[0];

    // Riwayat ujian dan nilai siswa
    // Jika context adalah SISWA, hanya tampilkan hasil PUBLISHED
    let sql = `
      SELECT ep.exam_id, e.title as exam_title, sub.name as subject_name,
             es.status as session_status, es.server_started_at, es.submitted_at,
             er.final_score, er.percentage, er.status as result_status, er.published_at,
             e.passing_grade
      FROM exam_participants ep
      JOIN exams e ON ep.exam_id = e.id
      JOIN subjects sub ON e.subject_id = sub.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      LEFT JOIN exam_results er ON es.id = er.session_id
      WHERE ep.student_id = $1 AND ep.school_id = $2
    `;

    if (context.role === 'PENGAWAS' || context.studentId) {
      sql += ` AND er.status = 'PUBLISHED'`;
    }

    sql += ` ORDER BY e.start_time DESC;`;

    const examHistoryRes = await queryPostgres(sql, [targetStudentId, schoolId]);
    const history = examHistoryRes.rows;

    const totalExams = history.length;
    let completedExams = 0;
    const scores: number[] = [];
    const subjectMap: Record<string, number[]> = {};

    for (const h of history) {
      if (h.session_status === 'SUBMITTED') completedExams++;
      if (h.final_score !== null && h.final_score !== undefined && (h.result_status === 'PUBLISHED' || h.result_status === 'GRADED')) {
        const score = parseFloat(h.final_score);
        scores.push(score);
        if (!subjectMap[h.subject_name]) subjectMap[h.subject_name] = [];
        subjectMap[h.subject_name].push(score);
      }
    }

    const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
    const completionRate = totalExams > 0 ? Math.round((completedExams / totalExams) * 10000) / 100 : 0;

    const subjectPerformance = Object.keys(subjectMap).map((subName) => {
      const arr = subjectMap[subName];
      const avg = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
      return {
        subjectName: subName,
        examCount: arr.length,
        averageScore: avg,
      };
    });

    return {
      student: {
        id: student.id,
        name: student.full_name,
        nis: student.nis,
        nisn: student.nisn,
        className: student.class_name,
      },
      summary: {
        totalExamsRegistered: totalExams,
        totalExamsCompleted: completedExams,
        completionRatePercentage: completionRate,
        averageScore: avgScore,
      },
      subjectPerformance,
      examHistory: history.map((h) => ({
        examTitle: h.exam_title,
        subjectName: h.subject_name,
        sessionStatus: h.session_status,
        finalScore: h.final_score !== null ? parseFloat(h.final_score) : null,
        isPassed: h.final_score !== null ? parseFloat(h.final_score) >= parseFloat(h.passing_grade || '75') : null,
        resultStatus: h.result_status,
      })),
    };
  }

  /**
   * 3. Analitik Kelas (getClassAnalytics)
   */
  static async getClassAnalytics(context: AnalyticsContext, classId: string) {
    const { schoolId } = await AnalyticsAuthService.assertClassAccess(context, classId);

    const classRes = await queryPostgres(
      `SELECT id, name FROM class_rooms WHERE id = $1 AND school_id = $2;`,
      [classId, schoolId]
    );

    if (classRes.rows.length === 0) {
      throw new Error('Kelas tidak ditemukan.');
    }
    const cls = classRes.rows[0];

    // Ambil seluruh siswa di kelas
    const studentCountRes = await queryPostgres(
      `SELECT COUNT(*) as count FROM students WHERE class_room_id = $1 AND school_id = $2;`,
      [classId, schoolId]
    );
    const totalStudents = parseInt(studentCountRes.rows[0].count, 10);

    // Ambil hasil ujian siswa di kelas ini
    const resultsRes = await queryPostgres(
      `SELECT er.final_score, er.status as result_status, e.passing_grade,
              e.title as exam_title, sub.name as subject_name
       FROM exam_results er
       JOIN students s ON er.student_id = s.id
       JOIN exams e ON er.exam_id = e.id
       JOIN subjects sub ON e.subject_id = sub.id
       WHERE s.class_room_id = $1 AND er.school_id = $2 AND er.status IN ('PUBLISHED', 'GRADED', 'REVIEWED');`,
      [classId, schoolId]
    );

    const scores = resultsRes.rows.map((r) => parseFloat(r.final_score));
    const stats = this.computeScoreStats(scores, 75);

    return {
      classRoom: {
        id: cls.id,
        name: cls.name,
        totalStudents,
      },
      scores: stats,
      totalEvaluations: resultsRes.rows.length,
    };
  }

  /**
   * 4. Analitik Mata Pelajaran (getSubjectAnalytics)
   */
  static async getSubjectAnalytics(context: AnalyticsContext, subjectId: string) {
    const { schoolId } = await AnalyticsAuthService.assertSubjectAccess(context, subjectId);

    const subRes = await queryPostgres(
      `SELECT id, name, code FROM subjects WHERE id = $1 AND school_id = $2;`,
      [subjectId, schoolId]
    );

    if (subRes.rows.length === 0) {
      throw new Error('Mata pelajaran tidak ditemukan.');
    }
    const subject = subRes.rows[0];

    const examsRes = await queryPostgres(
      `SELECT e.id, e.title, e.status,
              (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) as participant_count
       FROM exams e
       WHERE e.subject_id = $1 AND e.school_id = $2;`,
      [subjectId, schoolId]
    );

    const resultsRes = await queryPostgres(
      `SELECT er.final_score 
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.id
       WHERE e.subject_id = $1 AND er.school_id = $2 AND er.status IN ('PUBLISHED', 'GRADED', 'REVIEWED');`,
      [subjectId, schoolId]
    );

    const scores = resultsRes.rows.map((r) => parseFloat(r.final_score));
    const stats = this.computeScoreStats(scores, 75);

    return {
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
      },
      totalExams: examsRes.rows.length,
      totalEvaluations: scores.length,
      scores: stats,
    };
  }

  /**
   * 5. Analitik Guru (getTeacherAnalytics)
   */
  static async getTeacherAnalytics(context: AnalyticsContext, teacherId: string) {
    AnalyticsAuthService.assertSchoolScope(context, context.schoolId || '');

    const teacherRes = await queryPostgres(
      `SELECT id, full_name, nip FROM users WHERE id = $1 AND school_id = $2 AND role = 'GURU';`,
      [teacherId, context.schoolId]
    );

    if (teacherRes.rows.length === 0) {
      throw new Error('Data guru tidak ditemukan.');
    }
    const teacher = teacherRes.rows[0];

    // Ujian yang dibuat guru
    const examsRes = await queryPostgres(
      `SELECT id, title, status FROM exams WHERE created_by = $1 AND school_id = $2;`,
      [teacherId, context.schoolId]
    );

    // Penilaian essay yang ditugaskan
    const essayStatsRes = await queryPostgres(
      `SELECT 
         COUNT(*) as total_essays,
         COUNT(CASE WHEN eqr.score_status = 'PENDING_MANUAL_REVIEW' THEN 1 END) as pending_count,
         COUNT(CASE WHEN eqr.score_status = 'MANUALLY_GRADED' THEN 1 END) as graded_count
       FROM exam_question_results eqr
       JOIN exam_results er ON eqr.result_id = er.id
       JOIN exams e ON er.exam_id = e.id
       WHERE e.created_by = $1 AND er.school_id = $2;`,
      [teacherId, context.schoolId]
    );

    const essayStats = essayStatsRes.rows[0];

    return {
      teacher: {
        id: teacher.id,
        name: teacher.full_name,
        nip: teacher.nip,
      },
      examsCreated: examsRes.rows.length,
      essayGradingWorkload: {
        totalEssayAnswers: parseInt(essayStats.total_essays || '0', 10),
        pendingReviewCount: parseInt(essayStats.pending_count || '0', 10),
        gradedCount: parseInt(essayStats.graded_count || '0', 10),
      },
    };
  }

  /**
   * 6. Analitik Presensi (getAttendanceAnalytics)
   */
  static async getAttendanceAnalytics(
    context: AnalyticsContext,
    filters?: { examId?: string; roomId?: string; dateFrom?: string; dateTo?: string }
  ) {
    AnalyticsAuthService.assertSchoolScope(context, context.schoolId || '');
    const schoolId = context.schoolId;

    let sql = `
      SELECT ar.status, COUNT(*) as count 
      FROM attendance_records ar
      WHERE ar.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (filters?.examId) {
      params.push(filters.examId);
      sql += ` AND ar.exam_id = $${params.length}`;
    }

    if (filters?.roomId) {
      params.push(filters.roomId);
      sql += ` AND ar.room_id = $${params.length}`;
    }

    sql += ` GROUP BY ar.status;`;

    const res = await queryPostgres(sql, params);

    const summary = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
    };

    for (const r of res.rows) {
      const c = parseInt(r.count, 10);
      summary.total += c;
      if (r.status === 'PRESENT') summary.present += c;
      else if (r.status === 'ABSENT') summary.absent += c;
      else if (r.status === 'LATE') summary.late += c;
      else if (r.status === 'EXCUSED') summary.excused += c;
    }

    const attendanceRate = summary.total > 0 ? Math.round((summary.present / summary.total) * 10000) / 100 : 0;

    return {
      attendanceSummary: summary,
      attendanceRatePercentage: attendanceRate,
    };
  }

  /**
   * 7. Analitik Pelanggaran (getViolationAnalytics)
   */
  static async getViolationAnalytics(
    context: AnalyticsContext,
    filters?: { examId?: string; severity?: string }
  ) {
    AnalyticsAuthService.assertSchoolScope(context, context.schoolId || '');
    const schoolId = context.schoolId;

    let sql = `
      SELECT type, severity, COUNT(*) as count 
      FROM exam_session_violations 
      WHERE school_id = $1
    `;
    const params: any[] = [schoolId];

    if (filters?.examId) {
      params.push(filters.examId);
      sql += ` AND exam_id = $${params.length}`;
    }

    if (filters?.severity) {
      params.push(filters.severity);
      sql += ` AND severity = $${params.length}`;
    }

    sql += ` GROUP BY type, severity ORDER BY count DESC;`;

    const res = await queryPostgres(sql, params);

    let total = 0;
    const severityCounts = { INFO: 0, WARNING: 0, CRITICAL: 0 };
    const typeCounts: Record<string, number> = {};

    for (const r of res.rows) {
      const c = parseInt(r.count, 10);
      total += c;
      if (r.severity === 'CRITICAL') severityCounts.CRITICAL += c;
      else if (r.severity === 'WARNING') severityCounts.WARNING += c;
      else severityCounts.INFO += c;

      typeCounts[r.type] = (typeCounts[r.type] || 0) + c;
    }

    return {
      totalViolations: total,
      severityCounts,
      breakdownByType: Object.keys(typeCounts).map((type) => ({
        type,
        count: typeCounts[type],
        percentage: total > 0 ? Math.round((typeCounts[type] / total) * 10000) / 100 : 0,
      })),
    };
  }

  /**
   * 8. Analitik Sekolah (getSchoolAnalytics)
   */
  static async getSchoolAnalytics(context: AnalyticsContext) {
    AnalyticsAuthService.assertSchoolScope(context, context.schoolId || '');
    const schoolId = context.schoolId;

    const schoolRes = await queryPostgres(`SELECT id, name FROM schools WHERE id = $1;`, [schoolId]);
    const school = schoolRes.rows[0];

    // Metrik ringkasan sekolah
    const countsRes = await queryPostgres(
      `SELECT 
         (SELECT COUNT(*) FROM students WHERE school_id = $1) as student_count,
         (SELECT COUNT(*) FROM users WHERE school_id = $1 AND role = 'GURU') as teacher_count,
         (SELECT COUNT(*) FROM class_rooms WHERE school_id = $1) as class_count,
         (SELECT COUNT(*) FROM exams WHERE school_id = $1) as exam_count,
         (SELECT COUNT(*) FROM exam_participants WHERE school_id = $1) as participant_count,
         (SELECT COUNT(*) FROM exam_results WHERE school_id = $1 AND status IN ('PUBLISHED', 'GRADED')) as evaluated_count;`,
      [schoolId]
    );

    const counts = countsRes.rows[0];

    // Rata-rata nilai sekolah
    const avgScoreRes = await queryPostgres(
      `SELECT AVG(final_score) as avg_score 
       FROM exam_results 
       WHERE school_id = $1 AND status IN ('PUBLISHED', 'GRADED');`,
      [schoolId]
    );

    const overallAvgScore = avgScoreRes.rows[0]?.avg_score
      ? Math.round(parseFloat(avgScoreRes.rows[0].avg_score) * 100) / 100
      : 0;

    return {
      school: {
        id: school.id,
        name: school.name,
      },
      kpis: {
        totalStudents: parseInt(counts.student_count || '0', 10),
        totalTeachers: parseInt(counts.teacher_count || '0', 10),
        totalClasses: parseInt(counts.class_count || '0', 10),
        totalExams: parseInt(counts.exam_count || '0', 10),
        totalExamParticipants: parseInt(counts.participant_count || '0', 10),
        totalEvaluatedResults: parseInt(counts.evaluated_count || '0', 10),
        overallAverageScore: overallAvgScore,
      },
    };
  }

  /**
   * 9. Analitik Platform Superadmin (getPlatformAnalytics)
   */
  static async getPlatformAnalytics(context: AnalyticsContext) {
    if (context.role !== 'SUPER_ADMIN') {
      throw new Error('Akses ditolak: Hanya Superadmin yang dapat mengakses analitik platform.');
    }

    const platformRes = await queryPostgres(`
      SELECT 
        (SELECT COUNT(*) FROM schools) as total_schools,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM students) as total_students,
        (SELECT COUNT(*) FROM exams) as total_exams,
        (SELECT COUNT(*) FROM exam_sessions) as total_sessions,
        (SELECT COUNT(*) FROM exam_sessions WHERE status = 'SUBMITTED') as completed_sessions,
        (SELECT COUNT(*) FROM exam_session_violations) as total_violations;
    `);

    const r = platformRes.rows[0];
    const totalSessions = parseInt(r.total_sessions || '0', 10);
    const completedSessions = parseInt(r.completed_sessions || '0', 10);
    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 10000) / 100 : 0;

    return {
      platform: {
        totalSchools: parseInt(r.total_schools || '0', 10),
        totalUsers: parseInt(r.total_users || '0', 10),
        totalStudents: parseInt(r.total_students || '0', 10),
        totalExams: parseInt(r.total_exams || '0', 10),
        totalSessions,
        completedSessions,
        platformCompletionRate: completionRate,
        totalSecurityViolations: parseInt(r.total_violations || '0', 10),
      },
    };
  }
}
