import { queryPostgres, withTransaction } from '../core/postgres';
import { AuditService } from './audit.service';
import { StudentAuthContext } from '../core/auth';
import { ScoringService } from './scoring.service';
import * as XLSX from 'xlsx';

export class ExamResultService {
  /**
   * Sanitasi string untuk proteksi CSV / Formula Injection.
   * Menolak atau prefix single quote jika nilai diawali karakter berbahaya: =, +, -, @, \t, \r
   */
  static sanitizeForFormulaInjection(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Mengambil daftar hasil ujian siswa berdasarkan exam_results dengan statistik performa.
   */
  static async getExamResults(
    schoolId: string,
    examId: string,
    filters?: { classId?: string; search?: string; status?: string }
  ) {
    const examRes = await queryPostgres(
      `SELECT e.*, s.name as subject_name 
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       WHERE e.id = $1 AND e.school_id = $2;`,
      [examId, schoolId]
    );

    if (examRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan di sekolah ini.');
    }
    const exam = examRes.rows[0];
    const passingGrade = parseFloat(exam.passing_grade || '75');

    let sql = `
      SELECT ep.id as participant_id, ep.token,
             s.id as student_id, s.full_name as student_name, s.nisn, s.nis, s.gender,
             c.name as class_room_name,
             es.id as session_id, es.status as session_status, 
             es.server_started_at, es.submitted_at, es.tab_violation_count,
             er.id as result_id, er.raw_score, er.max_score, er.normalized_score,
             er.final_score, er.percentage, er.status as result_status,
             er.graded_at, er.published_at, er.scoring_version, er.breakdown_json
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      LEFT JOIN exam_results er ON es.id = er.session_id
      WHERE ep.exam_id = $1 AND ep.school_id = $2
    `;
    const params: any[] = [examId, schoolId];

    if (filters?.classId) {
      params.push(filters.classId);
      sql += ` AND s.class_room_id = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (s.full_name ILIKE $${params.length} OR s.nisn ILIKE $${params.length} OR s.nis ILIKE $${params.length})`;
    }

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND er.status = $${params.length}`;
    }

    sql += ` ORDER BY er.final_score DESC NULLS LAST, s.full_name ASC;`;

    const res = await queryPostgres(sql, params);
    const rows = res.rows;

    let totalScore = 0;
    let scoredCount = 0;
    let highest = 0;
    let lowest = 100;
    let passedCount = 0;

    const scoreDistribution = {
      gradeA: 0, // 85 - 100
      gradeB: 0, // 70 - 84
      gradeC: 0, // 55 - 69
      gradeD: 0, // < 55
    };

    const statusCounts = {
      pending: 0,
      partiallyGraded: 0,
      graded: 0,
      reviewed: 0,
      published: 0,
      void: 0,
    };

    const participants = rows.map((r: any) => {
      const score = r.final_score !== null ? parseFloat(r.final_score) : null;
      const status = r.result_status || (r.session_status === 'SUBMITTED' ? 'PENDING' : 'NOT_STARTED');

      if (score !== null) {
        totalScore += score;
        scoredCount++;
        if (score > highest) highest = score;
        if (score < lowest) lowest = score;
        if (score >= passingGrade) passedCount++;

        if (score >= 85) scoreDistribution.gradeA++;
        else if (score >= 70) scoreDistribution.gradeB++;
        else if (score >= 55) scoreDistribution.gradeC++;
        else scoreDistribution.gradeD++;
      }

      if (status === 'PENDING') statusCounts.pending++;
      else if (status === 'PARTIALLY_GRADED') statusCounts.partiallyGraded++;
      else if (status === 'GRADED') statusCounts.graded++;
      else if (status === 'REVIEWED') statusCounts.reviewed++;
      else if (status === 'PUBLISHED') statusCounts.published++;
      else if (status === 'VOID') statusCounts.void++;

      return {
        participantId: r.participant_id,
        studentId: r.student_id,
        studentName: r.student_name,
        nisn: r.nisn,
        nis: r.nis,
        gender: r.gender,
        className: r.class_room_name || 'Belum Ada Kelas',
        sessionId: r.session_id,
        sessionStatus: r.session_status || 'NOT_STARTED',
        startedAt: r.server_started_at,
        submittedAt: r.submitted_at,
        tabViolationCount: r.tab_violation_count || 0,
        resultId: r.result_id,
        rawScore: r.raw_score !== null ? parseFloat(r.raw_score) : null,
        maxScore: r.max_score !== null ? parseFloat(r.max_score) : null,
        finalScore: score,
        percentage: r.percentage !== null ? parseFloat(r.percentage) : null,
        isPassed: score !== null ? score >= passingGrade : null,
        status,
        gradedAt: r.graded_at,
        publishedAt: r.published_at,
        scoringVersion: r.scoring_version || 'v1.0',
        breakdown: r.breakdown_json || {},
      };
    });

    const average = scoredCount > 0 ? parseFloat((totalScore / scoredCount).toFixed(2)) : 0;

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        subjectName: exam.subject_name,
        passingGrade,
        showScorePolicy: exam.show_score_policy || 'AFTER_ALL_DONE',
      },
      statistics: {
        totalParticipants: rows.length,
        scoredParticipants: scoredCount,
        completionRate: rows.length > 0 ? parseFloat(((scoredCount / rows.length) * 100).toFixed(1)) : 0,
        averageScore: average,
        highestScore: scoredCount > 0 ? highest : 0,
        lowestScore: scoredCount > 0 ? lowest : 0,
        passedCount,
        passedRate: scoredCount > 0 ? parseFloat(((passedCount / scoredCount) * 100).toFixed(1)) : 0,
        distribution: scoreDistribution,
        statusCounts,
      },
      participants,
    };
  }

  /**
   * Mengambil detail hasil ujian tunggal beserta breakdown butir soal
   */
  static async getResultDetail(resultId: string, schoolId: string) {
    const res = await queryPostgres(
      `SELECT er.*, e.title as exam_title, s.name as subject_name, e.passing_grade,
              st.full_name as student_name, st.nis, st.nisn, c.name as class_name,
              es.server_started_at, es.submitted_at
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       JOIN students st ON er.student_id = st.id
       LEFT JOIN class_rooms c ON st.class_room_id = c.id
       JOIN exam_sessions es ON er.session_id = es.id
       WHERE er.id = $1 AND er.school_id = $2;`,
      [resultId, schoolId]
    );

    if (res.rows.length === 0) {
      throw new Error('Hasil ujian tidak ditemukan.');
    }

    const result = res.rows[0];

    const qRes = await queryPostgres(
      `SELECT eqr.*, esq.position, esq.configuration_json
       FROM exam_question_results eqr
       LEFT JOIN exam_sessions es ON er_session.id = eqr.result_id
       LEFT JOIN exam_snapshot_questions esq ON eqr.question_id = esq.question_id
       CROSS JOIN (SELECT session_id FROM exam_results WHERE id = $1) er_session
       WHERE eqr.result_id = $1
       ORDER BY esq.position ASC NULLS LAST;`,
      [resultId]
    );

    // Fallback jika join snapshot question menggunakan query langsung
    const questionsRes = await queryPostgres(
      `SELECT eqr.*
       FROM exam_question_results eqr
       WHERE eqr.result_id = $1
       ORDER BY eqr.created_at ASC;`,
      [resultId]
    );

    return {
      result: {
        id: result.id,
        examId: result.exam_id,
        examTitle: result.exam_title,
        subjectName: result.subject_name,
        studentId: result.student_id,
        studentName: result.student_name,
        nis: result.nis,
        nisn: result.nisn,
        className: result.class_name,
        rawScore: parseFloat(result.raw_score),
        maxScore: parseFloat(result.max_score),
        normalizedScore: parseFloat(result.normalized_score),
        finalScore: parseFloat(result.final_score),
        percentage: parseFloat(result.percentage),
        status: result.status,
        passingGrade: parseFloat(result.passing_grade || '75'),
        isPassed: parseFloat(result.final_score) >= parseFloat(result.passing_grade || '75'),
        scoringVersion: result.scoring_version,
        gradedAt: result.graded_at,
        publishedAt: result.published_at,
        breakdown: result.breakdown_json,
      },
      questions: questionsRes.rows.map((q) => ({
        id: q.id,
        questionId: q.question_id,
        questionVersionId: q.question_version_id,
        answer: q.answer,
        score: parseFloat(q.score),
        maxScore: parseFloat(q.max_score),
        scoreStatus: q.score_status,
        feedback: q.feedback,
        teacherInternalNote: q.teacher_internal_note,
        rubricScores: q.rubric_scores_json,
      })),
    };
  }

  /**
   * Mengambil detail lembar jawaban siswa untuk koreksi manual essay
   */
  static async getStudentAnswersForGrading(schoolId: string, examId: string, participantId: string) {
    const check = await queryPostgres(
      `SELECT ep.id, ep.final_score, ep.graded_status, s.full_name as student_name, s.nisn,
              es.id as session_id, e.title as exam_title, er.id as result_id
       FROM exam_participants ep
       JOIN exams e ON ep.exam_id = e.id
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       LEFT JOIN exam_results er ON es.id = er.session_id
       WHERE ep.id = $1 AND ep.exam_id = $2 AND e.school_id = $3;`,
      [participantId, examId, schoolId]
    );

    if (check.rows.length === 0) {
      throw new Error('Peserta ujian tidak ditemukan di sekolah ini.');
    }
    const participant = check.rows[0];

    if (!participant.session_id) {
      throw new Error('Peserta ini belum memulai atau tidak memiliki sesi ujian.');
    }

    const answersRes = await queryPostgres(
      `SELECT sa.*, qb.question_text, qb.type as question_type, qb.weight, qb.rubric_json, qb.topic
       FROM student_answers sa
       JOIN question_banks qb ON sa.question_id = qb.id::text
       WHERE sa.session_id = $1;`,
      [participant.session_id]
    );

    return {
      participant: {
        id: participant.id,
        studentName: participant.student_name,
        nisn: participant.nisn,
        finalScore: participant.final_score !== null ? parseFloat(participant.final_score) : null,
        gradedStatus: participant.graded_status,
        resultId: participant.result_id,
      },
      answers: answersRes.rows.map((a: any) => ({
        id: a.id,
        questionId: a.question_id,
        questionText: a.question_text,
        questionType: a.question_type,
        topic: a.topic,
        maxWeight: parseFloat(a.weight || '1.0'),
        rubric: a.rubric_json?.rubric || a.rubric_json,
        answerValue: a.answer_value_json,
        autoScore: a.auto_score !== null ? parseFloat(a.auto_score) : null,
        manualScore: a.manual_score !== null ? parseFloat(a.manual_score) : null,
        feedback: a.feedback,
        teacherInternalNote: a.teacher_internal_note,
      })),
    };
  }

  /**
   * Melakukan review hasil ujian (Transisi GRADED -> REVIEWED)
   */
  static async reviewResult(
    resultId: string,
    schoolId: string,
    actor: { id: string; username: string; role: string }
  ) {
    return await withTransaction(async (client) => {
      const res = await client.query(
        `SELECT id, status, exam_id, student_id FROM exam_results WHERE id = $1 AND school_id = $2 FOR UPDATE;`,
        [resultId, schoolId]
      );

      if (res.rows.length === 0) {
        throw new Error('Hasil ujian tidak ditemukan.');
      }

      const current = res.rows[0];
      if (current.status === 'PUBLISHED') {
        throw new Error('Hasil ujian telah dipublikasikan dan tidak dapat direview kembali.');
      }
      if (current.status === 'VOID') {
        throw new Error('Hasil ujian telah dibatalkan (VOID).');
      }

      await client.query(
        `UPDATE exam_results SET status = 'REVIEWED', updated_at = NOW() WHERE id = $1;`,
        [resultId]
      );

      await AuditService.createLog({
        action: 'RESULT_REVIEWED',
        schoolId,
        actor,
        resourceType: 'EXAM_RESULT',
        resourceId: resultId,
        details: { oldStatus: current.status, newStatus: 'REVIEWED' },
      });

      return { success: true, resultId, status: 'REVIEWED' };
    });
  }

  /**
   * Mempublikasikan hasil ujian (Transisi GRADED / REVIEWED -> PUBLISHED)
   */
  static async publishResults(
    examId: string,
    schoolId: string,
    actor: { id: string; username: string; role: string },
    resultIds?: string[]
  ) {
    return await withTransaction(async (client) => {
      let sql = `
        UPDATE exam_results
        SET status = 'PUBLISHED',
            published_at = NOW(),
            updated_at = NOW()
        WHERE exam_id = $1 AND school_id = $2 AND status IN ('GRADED', 'REVIEWED')
      `;
      const params: any[] = [examId, schoolId];

      if (Array.isArray(resultIds) && resultIds.length > 0) {
        params.push(resultIds);
        sql += ` AND id = ANY($${params.length})`;
      }

      sql += ` RETURNING id, participant_id;`;

      const updRes = await client.query(sql, params);

      // Sinkronisasi status publikasi pada exam_participants
      if (updRes.rows.length > 0) {
        const pIds = updRes.rows.map((r) => r.participant_id);
        await client.query(
          `UPDATE exam_participants SET publication_status = 'PUBLISHED' WHERE id = ANY($1);`,
          [pIds]
        );
      }

      await AuditService.createLog({
        action: 'RESULT_PUBLISHED',
        schoolId,
        actor,
        resourceType: 'EXAM_RESULT',
        resourceId: examId,
        details: { publishedCount: updRes.rows.length, targetResultIds: resultIds },
      });

      return {
        success: true,
        publishedCount: updRes.rows.length,
      };
    });
  }

  /**
   * Koreksi nilai hasil ujian (Result Correction dengan catatan audit dan alasan wajib)
   */
  static async correctResult(
    resultId: string,
    schoolId: string,
    newScore: number,
    reason: string,
    actor: { id: string; username: string; role: string }
  ) {
    if (!reason || !reason.trim()) {
      throw new Error('Alasan koreksi nilai wajib diisi.');
    }

    if (newScore < 0 || newScore > 100) {
      throw new Error('Skor hasil koreksi harus berada di rentang 0 hingga 100.');
    }

    return await withTransaction(async (client) => {
      const res = await client.query(
        `SELECT id, final_score, max_score, raw_score, exam_id, participant_id, status
         FROM exam_results
         WHERE id = $1 AND school_id = $2
         FOR UPDATE;`,
        [resultId, schoolId]
      );

      if (res.rows.length === 0) {
        throw new Error('Hasil ujian tidak ditemukan.');
      }

      const current = res.rows[0];
      const oldScore = parseFloat(current.final_score);

      // Catat ke result_corrections
      await client.query(
        `INSERT INTO result_corrections (
           id, result_id, school_id, old_score, new_score, reason, corrected_by, created_at
         ) VALUES (
           uuid_generate_v4(), $1, $2, $3, $4, $5, $6, NOW()
         );`,
        [resultId, schoolId, oldScore, newScore, reason.trim(), actor.id]
      );

      // Perbarui exam_results
      const roundedNew = ScoringService.roundScore(newScore);
      await client.query(
        `UPDATE exam_results SET
           final_score = $1,
           normalized_score = $1,
           percentage = $1,
           updated_at = NOW()
         WHERE id = $2;`,
        [roundedNew, resultId]
      );

      // Perbarui exam_participants
      await client.query(
        `UPDATE exam_participants SET final_score = $1 WHERE id = $2;`,
        [roundedNew, current.participant_id]
      );

      // Audit Log
      await AuditService.createLog({
        action: 'RESULT_CORRECTED',
        schoolId,
        actor,
        resourceType: 'EXAM_RESULT',
        resourceId: resultId,
        details: {
          oldScore,
          newScore: roundedNew,
          reason: reason.trim(),
        },
      });

      return {
        success: true,
        resultId,
        oldScore,
        newScore: roundedNew,
      };
    });
  }

  /**
   * Pembatalan hasil ujian (Result Void)
   */
  static async voidResult(
    resultId: string,
    schoolId: string,
    reason: string,
    actor: { id: string; username: string; role: string }
  ) {
    if (!reason || !reason.trim()) {
      throw new Error('Alasan pembatalan (VOID) hasil ujian wajib diisi.');
    }

    return await withTransaction(async (client) => {
      const res = await client.query(
        `SELECT id, status, participant_id FROM exam_results WHERE id = $1 AND school_id = $2 FOR UPDATE;`,
        [resultId, schoolId]
      );

      if (res.rows.length === 0) {
        throw new Error('Hasil ujian tidak ditemukan.');
      }

      const current = res.rows[0];

      await client.query(
        `UPDATE exam_results SET
           status = 'VOID',
           voided_at = NOW(),
           void_reason = $1,
           voided_by = $2,
           updated_at = NOW()
         WHERE id = $3;`,
        [reason.trim(), actor.id, resultId]
      );

      await AuditService.createLog({
        action: 'RESULT_VOIDED',
        schoolId,
        actor,
        resourceType: 'EXAM_RESULT',
        resourceId: resultId,
        details: { oldStatus: current.status, reason: reason.trim() },
      });

      return { success: true, resultId, status: 'VOID' };
    });
  }

  /**
   * Regrading massal untuk seluruh peserta sebuah ujian
   */
  static async regradeExam(
    examId: string,
    schoolId: string,
    reason: string,
    actor: { id: string; username: string; role: string }
  ) {
    if (!reason || !reason.trim()) {
      throw new Error('Alasan pelaksanaan regrading wajib dicantumkan.');
    }

    // Ambil seluruh sesi ujian yang relevan
    const sessionsRes = await queryPostgres(
      `SELECT es.id as session_id
       FROM exam_sessions es
       JOIN exam_participants ep ON es.participant_id = ep.id
       WHERE ep.exam_id = $1 AND ep.school_id = $2 AND es.status IN ('SUBMITTED', 'COMPLETED', 'TIMEOUT');`,
      [examId, schoolId]
    );

    const sessions = sessionsRes.rows;
    let affectedCount = 0;

    for (const s of sessions) {
      try {
        await ScoringService.scoreExamSession(s.session_id, actor);
        affectedCount++;
      } catch (err) {
        console.error(`Error regrading session ${s.session_id}:`, err);
      }
    }

    // Catat ke regrade_jobs
    await queryPostgres(
      `INSERT INTO regrade_jobs (
         id, exam_id, school_id, old_scoring_version, new_scoring_version, reason, status, affected_count, created_by, created_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, 'v1.0', 'v1.0', $3, 'COMPLETED', $4, $5, NOW()
       );`,
      [examId, schoolId, reason.trim(), affectedCount, actor.id]
    );

    await AuditService.createLog({
      action: 'RESULT_RECALCULATED',
      schoolId,
      actor,
      resourceType: 'EXAM',
      resourceId: examId,
      details: { affectedSessionsCount: affectedCount, reason: reason.trim() },
    });

    return {
      success: true,
      examId,
      affectedCount,
    };
  }

  /**
   * Mengambil hasil ujian siswa terpublikasi dengan otentikasi identitas siswa dan zero answer key leakage
   */
  static async getStudentPublishedResult(
    resultId: string,
    authContext: { studentId: string; schoolId: string } | StudentAuthContext
  ) {
    const res = await queryPostgres(
      `SELECT er.*, e.title as exam_title, s.name as subject_name, e.passing_grade, e.show_score_policy,
              st.full_name as student_name, st.nis, st.nisn, c.name as class_name
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       JOIN students st ON er.student_id = st.id
       LEFT JOIN class_rooms c ON st.class_room_id = c.id
       WHERE er.id = $1 AND er.school_id = $2;`,
      [resultId, authContext.schoolId]
    );

    if (res.rows.length === 0) {
      throw new Error('Hasil ujian tidak ditemukan.');
    }

    const result = res.rows[0];

    // IDOR Check: Memastikan hanya siswa pemilik akun yang dapat mengakses
    if (result.student_id !== authContext.studentId) {
      throw new Error('Akses ditolak: Anda hanya dapat mengakses hasil ujian Anda sendiri.');
    }

    // Visibility Check: Status harus PUBLISHED kecuali show_score_policy = IMMEDIATELY
    const isImmediately = result.show_score_policy === 'IMMEDIATELY';
    if (result.status !== 'PUBLISHED' && !isImmediately) {
      throw new Error('Hasil ujian belum dipublikasikan oleh pihak sekolah.');
    }

    // Ambil question results tersanitasi (zero answer key leakage, zero internal notes)
    const qRes = await queryPostgres(
      `SELECT eqr.question_id, eqr.score, eqr.max_score, eqr.feedback, eqr.score_status,
              esq.position, esq.configuration_json
       FROM exam_question_results eqr
       LEFT JOIN exam_snapshot_questions esq ON eqr.question_id = esq.question_id
       WHERE eqr.result_id = $1
       ORDER BY esq.position ASC NULLS LAST;`,
      [resultId]
    );

    const safeBreakdown = qRes.rows.map((row, idx) => {
      const qConf = row.configuration_json || {};
      return {
        number: row.position || idx + 1,
        questionText: qConf.questionText || '',
        score: parseFloat(row.score),
        maxScore: parseFloat(row.max_score),
        feedback: row.feedback || null,
        // ZERO ANSWER KEY LEAKAGE: answerKey, rubric internal, teacher_internal_note dibuang mutlak!
      };
    });

    const passingGrade = parseFloat(result.passing_grade || '75');
    const finalScore = parseFloat(result.final_score);

    return {
      exam: {
        title: result.exam_title,
        subjectName: result.subject_name,
        passingGrade,
      },
      student: {
        name: result.student_name,
        nisn: result.nisn,
        className: result.class_name,
      },
      score: {
        rawScore: parseFloat(result.raw_score),
        maxScore: parseFloat(result.max_score),
        finalScore,
        percentage: parseFloat(result.percentage),
        isPassed: finalScore >= passingGrade,
        status: result.status,
        publishedAt: result.published_at,
      },
      breakdown: safeBreakdown,
    };
  }

  /**
   * Ekspor hasil ujian server-side dalam format CSV atau XLSX dengan Formula Injection Protection
   */
  static async exportResults(examId: string, schoolId: string, format: 'csv' | 'xlsx' = 'xlsx') {
    const data = await this.getExamResults(schoolId, examId);
    const exam = data.exam;
    const participants = data.participants;

    const rows = participants.map((p, idx) => ({
      No: idx + 1,
      NIS: this.sanitizeForFormulaInjection(p.nis),
      NISN: this.sanitizeForFormulaInjection(p.nisn),
      'Nama Siswa': this.sanitizeForFormulaInjection(p.studentName),
      Kelas: this.sanitizeForFormulaInjection(p.className),
      'Nilai Akhir': p.finalScore !== null ? p.finalScore : 'Belum Ada Nilai',
      Persentase: p.percentage !== null ? `${p.percentage}%` : '-',
      Status: p.status,
      Keterangan: p.isPassed === true ? 'LULUS' : p.isPassed === false ? 'TIDAK LULUS' : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return {
        data: Buffer.from(csv, 'utf8'),
        filename: `rekap_nilai_${exam.title.replace(/\s+/g, '_')}.csv`,
        contentType: 'text/csv',
      };
    } else {
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return {
        data: buffer,
        filename: `rekap_nilai_${exam.title.replace(/\s+/g, '_')}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
  }

  /**
   * Submit manual score for an essay answer (Admin / Teacher manual scoring)
   */
  static async submitManualScore(
    schoolId: string,
    examId: string,
    participantId: string,
    questionId: string,
    score: number,
    feedback?: string,
    actor?: { id: string; username: string; role: string }
  ) {
    const answerRes = await queryPostgres(
      `SELECT sa.id, sa.session_id, sa.version
       FROM student_answers sa
       JOIN exam_sessions es ON sa.session_id = es.id
       JOIN exam_participants ep ON es.participant_id = ep.id
       WHERE ep.id = $1 AND ep.exam_id = $2 AND ep.school_id = $3 AND sa.question_id = $4;`,
      [participantId, examId, schoolId, questionId]
    );

    if (answerRes.rows.length === 0) {
      throw new Error('Jawaban siswa tidak ditemukan.');
    }

    const answer = answerRes.rows[0];
    const { TeacherGradingService } = await import('./teacher-grading.service');
    return await TeacherGradingService.gradeEssay(
      schoolId,
      actor?.id || 'admin',
      answer.id,
      {
        manualScore: score,
        feedback,
        clientVersion: answer.version,
      },
      actor || { id: 'admin', username: 'admin', role: 'ADMIN' }
    );
  }
}
