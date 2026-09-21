import {
  User,
  ClassRoom,
  Subject,
  Student,
  QuestionBankItem,
  Exam,
  ExamParticipant,
  ExamSession,
  StudentAnswer,
  ExamCardData,
} from '../core/types';
import { queryPostgres } from '../core/postgres';
import { evaluateQuestionAnswer } from './scoring-engine';

export const db = {
  // 1. Students & Card Access
  async getStudentByNisnOrCode(query: string): Promise<Student | null> {
    const clean = query.trim().toUpperCase();
    const res = await queryPostgres(
      `SELECT s.*, c.name as class_room_name 
       FROM students s 
       LEFT JOIN class_rooms c ON s.class_room_id = c.id 
       WHERE s.nisn = $1 OR s.nis = $1 OR UPPER(s.card_access_code) = $1 
       LIMIT 1;`,
      [clean]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    return {
      id: row.id,
      nis: row.nis,
      nisn: row.nisn,
      fullName: row.full_name,
      gender: row.gender,
      classRoomId: row.class_room_id,
      classRoomName: row.class_room_name || 'Kelas Tidak Diketahui',
      cardAccessCode: row.card_access_code,
      photoUrl: row.photo_url,
      isActive: row.is_active,
    };
  },

  async getStudentCardData(studentId: string): Promise<ExamCardData | null> {
    // Get student details
    const studentRes = await queryPostgres(
      `SELECT s.*, c.name as class_room_name 
       FROM students s 
       LEFT JOIN class_rooms c ON s.class_room_id = c.id 
       WHERE s.id = $1 LIMIT 1;`,
      [studentId]
    );
    if (studentRes.rows.length === 0) return null;
    const sRow = studentRes.rows[0];

    const student: Student = {
      id: sRow.id,
      nis: sRow.nis,
      nisn: sRow.nisn,
      fullName: sRow.full_name,
      gender: sRow.gender,
      classRoomId: sRow.class_room_id,
      classRoomName: sRow.class_room_name,
      cardAccessCode: sRow.card_access_code,
      isActive: sRow.is_active,
    };

    // Get assigned exams & tokens
    const examsRes = await queryPostgres(
      `SELECT ep.*, e.id as exam_id, e.title as exam_title, e.start_time, e.end_time, 
              e.duration_minutes, e.status as exam_status, sub.name as subject_name,
              es.status as session_status
       FROM exam_participants ep
       JOIN exams e ON ep.exam_id = e.id
       JOIN subjects sub ON e.subject_id = sub.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       WHERE ep.student_id = $1;`,
      [studentId]
    );

    const exams = examsRes.rows.map((r: any) => ({
      examId: r.exam_id,
      examTitle: r.exam_title,
      subjectName: r.subject_name,
      startTime: r.start_time,
      endTime: r.end_time,
      durationMinutes: r.duration_minutes,
      room: 'Ruang Lab CBT 1',
      token: r.token,
      tokenActive: r.exam_status === 'ACTIVE' && r.token_status === 'ACTIVE',
      sessionStatus: r.session_status,
    }));

    return { student, exams };
  },

  // 2. Token Validation & Session Binding
  async validateTokenAndGetExam(token: string, deviceFingerprint: string): Promise<{
    success: boolean;
    error?: string;
    code?: string;
    participant?: ExamParticipant;
    session?: ExamSession;
    exam?: Exam;
  }> {
    const cleanToken = token.trim().toUpperCase();

    // Query participant by token with school freeze status
    const partRes = await queryPostgres(
      `SELECT ep.*, s.full_name as student_name, s.nisn, c.name as class_name,
              e.id as ex_id, e.title as ex_title, e.start_time, e.end_time, e.duration_minutes,
              e.status as exam_status, e.question_snapshot_json, sub.name as subject_name,
              e.release_token, e.token_released_at, e.token_expires_at,
              COALESCE(sc.is_active, true) as is_school_active
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       JOIN exams e ON ep.exam_id = e.id
       JOIN subjects sub ON e.subject_id = sub.id
       LEFT JOIN schools sc ON e.school_id = sc.id
       WHERE ep.token = $1;`,
      [cleanToken]
    );

    if (partRes.rows.length === 0) {
      return { success: false, error: 'Token ujian tidak valid atau tidak ditemukan.', code: 'INVALID_TOKEN' };
    }

    const row = partRes.rows[0];

    // Pillar 1: Enforce school freeze
    if (row.is_school_active === false) {
      return {
        success: false,
        error: 'Akses ujian dibekukan: Satuan pendidikan penyelenggara sedang dinonaktifkan / dibekukan oleh Dinas Pendidikan.',
        code: 'SCHOOL_FROZEN',
      };
    }

    if (row.token_status === 'REVOKED') {
      return { success: false, error: 'Token ini telah dicabut oleh pengawas/admin.', code: 'TOKEN_REVOKED' };
    }

    // Check Exam Window
    const now = new Date();
    const start = new Date(row.start_time);
    const end = new Date(row.end_time);

    if (now < start) {
      return {
        success: false,
        error: `Ujian belum dimulai. Waktu mulai: ${start.toLocaleString('id-ID')}`,
        code: 'EXAM_NOT_STARTED',
      };
    }

    if (now > end) {
      return {
        success: false,
        error: `Periode ujian telah berakhir pada ${end.toLocaleString('id-ID')}`,
        code: 'EXAM_ENDED',
      };
    }

    // Check Existing Session
    const sessRes = await queryPostgres(
      `SELECT * FROM exam_sessions WHERE participant_id = $1 LIMIT 1;`,
      [row.id]
    );

    let sessionRow = sessRes.rows[0];

    if (sessionRow) {
      if (sessionRow.status === 'SUBMITTED') {
        return {
          success: false,
          error: 'Anda sudah menyelesaikan ujian ini. Jawaban telah terkirim.',
          code: 'ALREADY_SUBMITTED',
        };
      }

      // Check device binding conflict
      if (
        sessionRow.status === 'IN_PROGRESS' &&
        sessionRow.device_fingerprint &&
        sessionRow.device_fingerprint !== deviceFingerprint
      ) {
        return {
          success: false,
          error:
            'Token sedang aktif di perangkat lain! Jika perangkat Anda sebelumnya mengalami masalah, silakan minta Pengawas untuk melakukan Reset Sesi (Recovery).',
          code: 'DEVICE_CONFLICT',
        };
      }

      // Resume session: update heartbeat and bind if device was reset
      await queryPostgres(
        `UPDATE exam_sessions 
         SET last_heartbeat_at = NOW(), 
             device_fingerprint = CASE WHEN device_fingerprint = '' THEN $1 ELSE device_fingerprint END
         WHERE id = $2;`,
        [deviceFingerprint, sessionRow.id]
      );
    } else {
      // Create New Session
      const serverStartedAt = now.toISOString();
      const calculatedExpiresAt = new Date(now.getTime() + row.duration_minutes * 60 * 1000);
      const finalExpiresAt = calculatedExpiresAt > end ? end : calculatedExpiresAt;

      const newSessRes = await queryPostgres(
        `INSERT INTO exam_sessions (
           id, participant_id, device_fingerprint, server_started_at, server_expires_at,
           status, current_question_index, last_heartbeat_at, tab_violation_count
         ) VALUES (
           uuid_generate_v4(), $1, $2, $3, $4, 'IN_PROGRESS', 0, $3, 0
         ) RETURNING *;`,
        [row.id, deviceFingerprint, serverStartedAt, finalExpiresAt.toISOString()]
      );
      sessionRow = newSessRes.rows[0];
    }

    const participant: ExamParticipant = {
      id: row.id,
      examId: row.ex_id,
      studentId: row.student_id,
      token: row.token,
      tokenStatus: row.token_status,
      assignedPackage: row.assigned_package,
      gradedStatus: row.graded_status,
      student: {
        id: row.student_id,
        nis: row.nis || '',
        nisn: row.nisn,
        fullName: row.student_name,
        gender: 'L',
        classRoomId: '',
        classRoomName: row.class_name,
        cardAccessCode: '',
        isActive: true,
      },
    };

    const session: ExamSession = {
      id: sessionRow.id,
      participantId: sessionRow.participant_id,
      deviceFingerprint: sessionRow.device_fingerprint,
      serverStartedAt: sessionRow.server_started_at,
      serverExpiresAt: sessionRow.server_expires_at,
      status: sessionRow.status,
      currentQuestionIndex: sessionRow.current_question_index,
      lastHeartbeatAt: sessionRow.last_heartbeat_at,
      tabViolationCount: sessionRow.tab_violation_count || 0,
      participant,
    };

    const exam: Exam = {
      id: row.ex_id,
      title: row.ex_title,
      subjectId: '',
      subjectName: row.subject_name,
      status: row.exam_status,
      windowMode: 'FLEXIBLE',
      startTime: row.start_time,
      endTime: row.end_time,
      durationMinutes: row.duration_minutes,
      randomizeQuestions: true,
      randomizeOptions: true,
      showScorePolicy: 'AFTER_ALL_DONE',
      ipRestricted: false,
      questionSnapshotJson: row.question_snapshot_json || [],
      releaseToken: row.release_token || undefined,
      tokenReleasedAt: row.token_released_at || undefined,
      tokenExpiresAt: row.token_expires_at || undefined,
    };

    return { success: true, participant, session, exam };
  },

  // 3. Session & Answers
  async getSessionById(sessionId: string): Promise<ExamSession | null> {
    const res = await queryPostgres(
      `SELECT es.*, ep.token, ep.assigned_package, ep.final_score,
              s.full_name as student_name, s.nisn, c.name as class_name,
              e.id as ex_id, e.title as ex_title, sub.name as subject_name,
              e.duration_minutes, e.question_snapshot_json
       FROM exam_sessions es
       JOIN exam_participants ep ON es.participant_id = ep.id
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       JOIN exams e ON ep.exam_id = e.id
       JOIN subjects sub ON e.subject_id = sub.id
       WHERE es.id = $1 LIMIT 1;`,
      [sessionId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const participant: ExamParticipant = {
      id: r.participant_id,
      examId: r.ex_id,
      studentId: '',
      token: r.token,
      tokenStatus: 'ACTIVE',
      assignedPackage: r.assigned_package,
      finalScore: r.final_score,
      gradedStatus: 'PENDING',
      student: {
        id: '',
        nis: '',
        nisn: r.nisn,
        fullName: r.student_name,
        gender: 'L',
        classRoomId: '',
        classRoomName: r.class_name,
        cardAccessCode: '',
        isActive: true,
      },
      exam: {
        id: r.ex_id,
        title: r.ex_title,
        subjectId: '',
        subjectName: r.subject_name,
        status: 'ACTIVE',
        windowMode: 'FLEXIBLE',
        startTime: '',
        endTime: '',
        durationMinutes: r.duration_minutes,
        randomizeQuestions: true,
        randomizeOptions: true,
        showScorePolicy: 'AFTER_ALL_DONE',
        ipRestricted: false,
        questionSnapshotJson: r.question_snapshot_json || [],
      },
    };

    return {
      id: r.id,
      participantId: r.participant_id,
      deviceFingerprint: r.device_fingerprint,
      serverStartedAt: r.server_started_at,
      serverExpiresAt: r.server_expires_at,
      submittedAt: r.submitted_at,
      status: r.status,
      currentQuestionIndex: r.current_question_index,
      lastHeartbeatAt: r.last_heartbeat_at,
      tabViolationCount: r.tab_violation_count || 0,
      participant,
    };
  },

  async getAnswersBySessionId(sessionId: string): Promise<StudentAnswer[]> {
    const res = await queryPostgres(
      `SELECT * FROM student_answers WHERE session_id = $1;`,
      [sessionId]
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      questionId: r.question_id,
      answerValue: r.answer_value_json,
      isDoubtful: r.is_doubtful,
      autoScore: r.auto_score,
      manualScore: r.manual_score,
      feedback: r.feedback,
      updatedAt: r.updated_at,
    }));
  },

  async saveAnswer(
    sessionId: string,
    questionId: string,
    answerValue: any,
    isDoubtful: boolean = false
  ): Promise<StudentAnswer> {
    const res = await queryPostgres(
      `INSERT INTO student_answers (
         id, session_id, question_id, answer_value_json, is_doubtful, updated_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, $3::jsonb, $4, NOW()
       )
       ON CONFLICT (session_id, question_id) 
       DO UPDATE SET 
         answer_value_json = EXCLUDED.answer_value_json,
         is_doubtful = EXCLUDED.is_doubtful,
         updated_at = NOW()
       RETURNING *;`,
      [sessionId, questionId, JSON.stringify(answerValue), isDoubtful]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      sessionId: r.session_id,
      questionId: r.question_id,
      answerValue: r.answer_value_json,
      isDoubtful: r.is_doubtful,
      updatedAt: r.updated_at,
    };
  },

  async updateHeartbeat(
    sessionId: string,
    currentQuestionIndex: number,
    tabViolationsIncrement: number = 0
  ) {
    const res = await queryPostgres(
      `UPDATE exam_sessions 
       SET last_heartbeat_at = NOW(),
           current_question_index = $1,
           tab_violation_count = tab_violation_count + $2
       WHERE id = $3
       RETURNING *;`,
      [currentQuestionIndex, tabViolationsIncrement, sessionId]
    );

    return res.rows[0] || null;
  },

  // 4. Submit & Scoring
  async submitExam(sessionId: string) {
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('Sesi tidak ditemukan');

    const exam = session.participant?.exam;
    if (!exam) throw new Error('Ujian tidak ditemukan');

    const answers = await this.getAnswersBySessionId(sessionId);
    const questions = exam.questionSnapshotJson;

    const examRuleRes = await queryPostgres(
      `SELECT scoring_rules_json, passing_grade FROM exams WHERE id = $1;`,
      [exam.id]
    );
    const scoringRules = examRuleRes.rows[0]?.scoring_rules_json || {};

    let totalEarned = 0;
    let maxPossibleScore = 0;
    let hasEssay = false;

    let earnedObj = 0;
    let maxObj = 0;
    let earnedEssay = 0;
    let maxEssay = 0;

    for (const q of questions) {
      const qWeight = q.weight || 1.0;
      maxPossibleScore += qWeight;

      const ans = answers.find((a) => a.questionId === q.id);
      const evalResult = evaluateQuestionAnswer(q, ans?.answerValue);

      if (ans) {
        await queryPostgres(
          `UPDATE student_answers SET auto_score = $1 WHERE session_id = $2 AND question_id = $3;`,
          [evalResult.score, sessionId, q.id]
        );
      }
      totalEarned += evalResult.score;

      if (q.type === 'ESSAY') {
        hasEssay = true;
        maxEssay += qWeight;
        earnedEssay += evalResult.score;
      } else {
        maxObj += qWeight;
        earnedObj += evalResult.score;
      }
    }

    let percentage = 0;
    if (scoringRules?.mode === 'PROPORTIONAL' && scoringRules?.proportional) {
      const objPct = Number(scoringRules.proportional.objectivePercentage || 70);
      const essayPct = Number(scoringRules.proportional.essayPercentage || 30);
      if (maxObj > 0 && maxEssay > 0) {
        percentage = (earnedObj / maxObj) * objPct + (earnedEssay / maxEssay) * essayPct;
      } else if (maxObj > 0) {
        percentage = (earnedObj / maxObj) * 100;
      } else if (maxEssay > 0) {
        percentage = (earnedEssay / maxEssay) * 100;
      }
    } else {
      percentage = maxPossibleScore > 0 ? (totalEarned / maxPossibleScore) * 100 : 0;
    }

    percentage = Number(Math.min(100, Math.max(0, percentage)).toFixed(1));

    // Update Session status
    await queryPostgres(
      `UPDATE exam_sessions SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = $1;`,
      [sessionId]
    );

    // Update Participant Score
    await queryPostgres(
      `UPDATE exam_participants 
       SET final_score = $1, graded_status = $2 
       WHERE id = $3;`,
      [percentage, hasEssay ? 'PARTIAL' : 'GRADED', session.participantId]
    );

    return {
      success: true,
      finalScore: percentage,
      totalEarned,
      maxPossibleScore,
      needsManualGrading: hasEssay,
    };
  },

  // 5. Proctor Recovery Actions (Individual or Bulk)
  async resetSessionDevice(participantIdOrIds: string | string[]): Promise<{ count: number }> {
    const ids = Array.isArray(participantIdOrIds) ? participantIdOrIds : [participantIdOrIds];
    if (ids.length === 0) return { count: 0 };
    const res = await queryPostgres(
      `UPDATE exam_sessions 
       SET device_fingerprint = '', status = 'IN_PROGRESS', last_heartbeat_at = NOW() 
       WHERE participant_id = ANY($1::uuid[]) 
       RETURNING id;`,
      [ids]
    );
    return { count: res.rows.length };
  },

  async addSessionTime(
    participantIdOrIds: string | string[],
    additionalMinutes: number
  ): Promise<{ count: number; serverExpiresAt?: string }> {
    const ids = Array.isArray(participantIdOrIds) ? participantIdOrIds : [participantIdOrIds];
    if (ids.length === 0) return { count: 0 };
    const res = await queryPostgres(
      `UPDATE exam_sessions 
       SET server_expires_at = server_expires_at + ($1 || ' minutes')::interval,
           status = CASE WHEN status = 'EXPIRED' THEN 'IN_PROGRESS' ELSE status END
       WHERE participant_id = ANY($2::uuid[]) 
       RETURNING id, server_expires_at;`,
      [additionalMinutes, ids]
    );
    return {
      count: res.rows.length,
      serverExpiresAt: res.rows[0]?.server_expires_at,
    };
  },

  async forceSubmitSession(participantIdOrIds: string | string[]): Promise<{ count: number; results: any[] }> {
    const ids = Array.isArray(participantIdOrIds) ? participantIdOrIds : [participantIdOrIds];
    if (ids.length === 0) return { count: 0, results: [] };
    const res = await queryPostgres(
      `SELECT id, participant_id FROM exam_sessions WHERE participant_id = ANY($1::uuid[]);`,
      [ids]
    );
    const results: any[] = [];
    for (const row of res.rows) {
      try {
        const sub = await this.submitExam(row.id);
        results.push({ sessionId: row.id, participantId: row.participant_id, success: true, sub });
      } catch (err: any) {
        results.push({ sessionId: row.id, participantId: row.participant_id, success: false, error: err.message });
      }
    }
    return { count: results.filter((r) => r.success).length, results };
  },

  // 6. Proctor Monitoring List & Realtime Exam Controls
  async getProctorMonitoringData(
    examId?: string,
    roomId?: string,
    sessionNumber?: number | string,
    schoolId?: string,
    userId?: string
  ) {
    // 1. Fetch available exams in this school
    const examsRes = await queryPostgres(
      `SELECT id, title, status, start_time, end_time, duration_minutes,
              release_token, token_released_at, token_expires_at, active_broadcast_message, active_broadcast_at
       FROM exams
       WHERE ($1::uuid IS NULL OR school_id = $1)
       ORDER BY created_at DESC;`,
      [schoolId || null]
    );

    const availableExams = examsRes.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      startTime: r.start_time,
      endTime: r.end_time,
      durationMinutes: r.duration_minutes,
      releaseToken: r.release_token,
      tokenReleasedAt: r.token_released_at,
      tokenExpiresAt: r.token_expires_at,
      activeBroadcastMessage: r.active_broadcast_message,
      activeBroadcastAt: r.active_broadcast_at,
    }));

    // Find selected exam or fallback to the most recent active/first exam
    let exam = examId ? availableExams.find((e: any) => e.id === examId) : null;
    if (!exam && availableExams.length > 0) {
      exam = availableExams.find((e: any) => e.status === 'ACTIVE' || e.status === 'SCHEDULED') || availableExams[0];
    }

    if (!exam) {
      return {
        exam: null,
        availableExams: [],
        rooms: [],
        sessions: [],
        participants: [],
        stats: { total: 0, notStarted: 0, inProgress: 0, submitted: 0, disconnected: 0, expired: 0, tabViolationsTotal: 0 },
      };
    }

    // 2. Fetch available rooms in this school
    const roomsRes = await queryPostgres(
      `SELECT id, code, name, capacity FROM exam_rooms WHERE ($1::uuid IS NULL OR school_id = $1) ORDER BY code ASC;`,
      [schoolId || null]
    );
    const rooms = roomsRes.rows;

    // 3. Fetch distinct sessions for this exam
    const sessionsRes = await queryPostgres(
      `SELECT DISTINCT session_number FROM exam_participants WHERE exam_id = $1 AND session_number IS NOT NULL ORDER BY session_number ASC;`,
      [exam.id]
    );
    const sessions = sessionsRes.rows.map((r: any) => r.session_number);

    // 4. Get questions snapshot count
    const examDetailRes = await queryPostgres(
      `SELECT question_snapshot_json FROM exams WHERE id = $1;`,
      [exam.id]
    );
    const questionsSnapshot = examDetailRes.rows[0]?.question_snapshot_json || [];

    // 5. Get participants with rooms, sessions, and answered counts
    const parsedSession = sessionNumber !== undefined && sessionNumber !== '' && sessionNumber !== 'ALL'
      ? parseInt(String(sessionNumber), 10)
      : null;
    const parsedRoomId = roomId && roomId !== 'ALL' ? roomId : null;

    const partRes = await queryPostgres(
      `SELECT ep.*, s.full_name as student_name, s.nisn, c.name as class_name,
              er.name as room_name, er.code as room_code,
              es.id as session_id, es.status as session_status, es.current_question_index,
              es.server_started_at, es.server_expires_at, es.last_heartbeat_at,
              es.tab_violation_count,
              COALESCE(ans_stat.answered_count, 0) as answered_count
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       LEFT JOIN exam_rooms er ON ep.room_id = er.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       LEFT JOIN (
         SELECT session_id, count(*) as answered_count 
         FROM student_answers 
         WHERE answer_value_json IS NOT NULL AND answer_value_json::text NOT IN ('""', 'null', '[]', '{}')
         GROUP BY session_id
       ) ans_stat ON es.id = ans_stat.session_id
       WHERE ep.exam_id = $1
         AND ($2::uuid IS NULL OR ep.room_id = $2)
         AND ($3::integer IS NULL OR ep.session_number = $3)
       ORDER BY er.code ASC, ep.session_number ASC, ep.seat_number ASC, s.full_name ASC;`,
      [exam.id, parsedRoomId, parsedSession]
    );

    let tabViolationsTotal = 0;

    const participants = partRes.rows.map((r: any) => {
      let computedStatus = r.session_status || 'NOT_STARTED';

      if (r.session_status === 'IN_PROGRESS') {
        const now = Date.now();
        const lastPing = r.last_heartbeat_at ? new Date(r.last_heartbeat_at).getTime() : 0;
        const expireTime = r.server_expires_at ? new Date(r.server_expires_at).getTime() : 0;

        if (now > expireTime) {
          computedStatus = 'EXPIRED';
        } else if (now - lastPing > 25000) {
          computedStatus = 'DISCONNECTED';
        }
      }

      const vCount = r.tab_violation_count || 0;
      tabViolationsTotal += vCount;

      return {
        participantId: r.id,
        token: r.token,
        studentName: r.student_name,
        nisn: r.nisn,
        className: r.class_name,
        roomId: r.room_id,
        roomName: r.room_name || 'Belum Diatur',
        roomCode: r.room_code || '-',
        sessionNumber: r.session_number || 1,
        seatNumber: r.seat_number || '-',
        status: computedStatus,
        currentQuestionIndex: (r.current_question_index || 0) + 1,
        answeredCount: parseInt(r.answered_count, 10),
        totalQuestions: questionsSnapshot.length,
        serverStartedAt: r.server_started_at,
        serverExpiresAt: r.server_expires_at,
        lastHeartbeatAt: r.last_heartbeat_at,
        tabViolationCount: vCount,
        finalScore: r.final_score,
      };
    });

    const stats = {
      total: participants.length,
      notStarted: participants.filter((p) => p.status === 'NOT_STARTED').length,
      inProgress: participants.filter((p) => p.status === 'IN_PROGRESS').length,
      submitted: participants.filter((p) => p.status === 'SUBMITTED').length,
      disconnected: participants.filter((p) => p.status === 'DISCONNECTED').length,
      expired: participants.filter((p) => p.status === 'EXPIRED').length,
      tabViolationsTotal,
    };

    // Query assigned rooms for current logged in user (if proctor/teacher)
    let assignedRooms: any[] = [];
    if (userId && exam?.id) {
      try {
        const assignRes = await queryPostgres(
          `SELECT erp.room_id, erp.session_number, r.code as room_code, r.name as room_name
           FROM exam_room_proctors erp
           JOIN exam_rooms r ON erp.room_id = r.id
           WHERE erp.exam_id = $1 AND erp.proctor_id = $2
           ORDER BY erp.session_number ASC, r.code ASC;`,
          [exam.id, userId]
        );
        assignedRooms = assignRes.rows.map((r: any) => ({
          roomId: r.room_id,
          roomCode: r.room_code,
          roomName: r.room_name,
          sessionNumber: r.session_number,
        }));
      } catch (err) {
        console.error('Failed to query proctor assigned rooms:', err);
      }
    }

    return {
      exam,
      availableExams,
      rooms,
      sessions,
      participants,
      stats,
      assignedRooms,
    };
  },

  async releaseExamToken(examId: string, durationMinutes: number = 15) {
    const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }

    const res = await queryPostgres(
      `UPDATE exams 
       SET release_token = $1,
           token_released_at = NOW(),
           token_expires_at = NOW() + ($2 || ' minutes')::interval
       WHERE id = $3
       RETURNING id, title, release_token, token_released_at, token_expires_at;`,
      [token, durationMinutes, examId]
    );

    return res.rows[0] || null;
  },

  async broadcastExamAnnouncement(examId: string, message: string) {
    const res = await queryPostgres(
      `UPDATE exams 
       SET active_broadcast_message = $1,
           active_broadcast_at = NOW()
       WHERE id = $2
       RETURNING id, title, active_broadcast_message, active_broadcast_at;`,
      [message, examId]
    );

    return res.rows[0] || null;
  },

  // 7. Question Banks & Master Data
  async getQuestionBanks(schoolId?: string | null, teacherId?: string | null): Promise<QuestionBankItem[]> {
    let sql = `
      SELECT qb.*, s.name as subject_name, u.full_name as teacher_name
      FROM question_banks qb 
      LEFT JOIN subjects s ON qb.subject_id = s.id 
      LEFT JOIN users u ON qb.teacher_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (schoolId) {
      params.push(schoolId);
      sql += ` AND (qb.school_id = $${params.length} OR qb.is_shared = true OR qb.school_id IS NULL)`;
    }

    if (teacherId) {
      params.push(teacherId);
      sql += ` AND qb.teacher_id = $${params.length}`;
    }

    sql += ` ORDER BY qb.created_at ASC;`;

    const res = await queryPostgres(sql, params);

    return res.rows.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name || 'Tenaga Pendidik',
      topic: r.topic,
      difficulty: r.difficulty,
      type: r.type,
      questionText: r.question_text,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      options: r.options_json || [],
      answerKey: r.answer_key_json,
      rubric: r.rubric_json?.text || (typeof r.rubric_json === 'string' ? r.rubric_json : ''),
      weight: parseFloat(r.weight),
      tags: r.tags || [],
      isShared: r.is_shared,
      cognitiveLevel: r.cognitive_level || 'L2_PENERAPAN',
      competenceCode: r.competence_code || '',
      stimulusId: r.stimulus_id || r.rubric_json?.stimulusId || undefined,
      stimulusTitle: r.stimulus_title || r.rubric_json?.stimulusTitle || undefined,
      stimulusText: r.stimulus_text || r.rubric_json?.stimulusText || undefined,
      stimulusMediaUrl: r.stimulus_media_url || r.rubric_json?.stimulusMediaUrl || undefined,
    }));
  },

  async addQuestionBankItem(
    item: Omit<QuestionBankItem, 'id'>,
    schoolId?: string | null,
    teacherId?: string | null
  ): Promise<QuestionBankItem> {
    const rubricJson = {
      text: item.rubric || '',
      stimulusId: item.stimulusId || null,
      stimulusTitle: item.stimulusTitle || null,
      stimulusText: item.stimulusText || null,
      stimulusMediaUrl: item.stimulusMediaUrl || null,
    };

    const res = await queryPostgres(
      `INSERT INTO question_banks (
         id, subject_id, topic, difficulty, type, question_text, 
         options_json, answer_key_json, weight, tags, school_id, teacher_id, is_shared,
         media_url, media_type, rubric_json, cognitive_level, competence_code,
         stimulus_id, stimulus_title, stimulus_text, stimulus_media_url
       ) VALUES (
         uuid_generate_v4(), $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12,
         $13, $14, $15::jsonb, $16, $17, $18, $19, $20, $21
       ) RETURNING *;`,
      [
        item.subjectId || 'b1111111-1111-1111-1111-111111111111',
        item.topic,
        item.difficulty,
        item.type,
        item.questionText,
        JSON.stringify(item.options || []),
        JSON.stringify(item.answerKey),
        item.weight,
        item.tags || [],
        schoolId || null,
        teacherId || null,
        !!item.isShared,
        item.mediaUrl || null,
        item.mediaType || 'NONE',
        JSON.stringify(rubricJson),
        item.cognitiveLevel || 'L2_PENERAPAN',
        item.competenceCode || null,
        item.stimulusId || null,
        item.stimulusTitle || null,
        item.stimulusText || null,
        item.stimulusMediaUrl || null,
      ]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      schoolId: r.school_id,
      subjectId: r.subject_id,
      teacherId: r.teacher_id,
      topic: r.topic,
      difficulty: r.difficulty,
      type: r.type,
      questionText: r.question_text,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      options: r.options_json,
      answerKey: r.answer_key_json,
      rubric: r.rubric_json?.text || '',
      weight: parseFloat(r.weight),
      tags: r.tags,
      isShared: r.is_shared,
      cognitiveLevel: r.cognitive_level,
      competenceCode: r.competence_code,
      stimulusId: r.stimulus_id || r.rubric_json?.stimulusId || undefined,
      stimulusTitle: r.stimulus_title || r.rubric_json?.stimulusTitle || undefined,
      stimulusText: r.stimulus_text || r.rubric_json?.stimulusText || undefined,
      stimulusMediaUrl: r.stimulus_media_url || r.rubric_json?.stimulusMediaUrl || undefined,
    };
  },

  async updateQuestionBankItem(
    id: string,
    updates: Partial<QuestionBankItem>,
    schoolId?: string | null,
    teacherId?: string | null
  ): Promise<QuestionBankItem | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.subjectId !== undefined) {
      fields.push(`subject_id = $${idx++}`);
      values.push(updates.subjectId);
    }
    if (updates.topic !== undefined) {
      fields.push(`topic = $${idx++}`);
      values.push(updates.topic);
    }
    if (updates.difficulty !== undefined) {
      fields.push(`difficulty = $${idx++}`);
      values.push(updates.difficulty);
    }
    if (updates.type !== undefined) {
      fields.push(`type = $${idx++}`);
      values.push(updates.type);
    }
    if (updates.questionText !== undefined) {
      fields.push(`question_text = $${idx++}`);
      values.push(updates.questionText);
    }
    if (updates.options !== undefined) {
      fields.push(`options_json = $${idx++}::jsonb`);
      values.push(JSON.stringify(updates.options));
    }
    if (updates.answerKey !== undefined) {
      fields.push(`answer_key_json = $${idx++}::jsonb`);
      values.push(JSON.stringify(updates.answerKey));
    }
    if (updates.weight !== undefined) {
      fields.push(`weight = $${idx++}`);
      values.push(updates.weight);
    }
    if (updates.tags !== undefined) {
      fields.push(`tags = $${idx++}`);
      values.push(updates.tags);
    }
    if (updates.mediaUrl !== undefined) {
      fields.push(`media_url = $${idx++}`);
      values.push(updates.mediaUrl);
    }
    if (updates.mediaType !== undefined) {
      fields.push(`media_type = $${idx++}`);
      values.push(updates.mediaType);
    }
    if (updates.rubric !== undefined) {
      fields.push(`rubric_json = $${idx++}::jsonb`);
      values.push(updates.rubric ? JSON.stringify({ text: updates.rubric }) : null);
    }
    if (updates.cognitiveLevel !== undefined) {
      fields.push(`cognitive_level = $${idx++}`);
      values.push(updates.cognitiveLevel);
    }
    if (updates.competenceCode !== undefined) {
      fields.push(`competence_code = $${idx++}`);
      values.push(updates.competenceCode);
    }
    if (updates.isShared !== undefined) {
      fields.push(`is_shared = $${idx++}`);
      values.push(updates.isShared);
    }
    if (updates.stimulusId !== undefined) {
      fields.push(`stimulus_id = $${idx++}`);
      values.push(updates.stimulusId || null);
    }
    if (updates.stimulusTitle !== undefined) {
      fields.push(`stimulus_title = $${idx++}`);
      values.push(updates.stimulusTitle || null);
    }
    if (updates.stimulusText !== undefined) {
      fields.push(`stimulus_text = $${idx++}`);
      values.push(updates.stimulusText || null);
    }
    if (updates.stimulusMediaUrl !== undefined) {
      fields.push(`stimulus_media_url = $${idx++}`);
      values.push(updates.stimulusMediaUrl || null);
    }

    if (fields.length === 0) return null;

    let sql = `UPDATE question_banks SET ${fields.join(', ')} WHERE id = $${idx++}`;
    values.push(id);

    if (schoolId) {
      sql += ` AND (school_id = $${idx++} OR school_id IS NULL)`;
      values.push(schoolId);
    }

    if (teacherId) {
      sql += ` AND (teacher_id = $${idx++} OR teacher_id IS NULL)`;
      values.push(teacherId);
    }

    sql += ` RETURNING *;`;

    const res = await queryPostgres(sql, values);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      id: r.id,
      schoolId: r.school_id,
      subjectId: r.subject_id,
      teacherId: r.teacher_id,
      topic: r.topic,
      difficulty: r.difficulty,
      type: r.type,
      questionText: r.question_text,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      options: r.options_json,
      answerKey: r.answer_key_json,
      rubric: r.rubric_json?.text || '',
      weight: parseFloat(r.weight),
      tags: r.tags,
      isShared: r.is_shared,
      cognitiveLevel: r.cognitive_level,
      competenceCode: r.competence_code,
      stimulusId: r.stimulus_id || r.rubric_json?.stimulusId || undefined,
      stimulusTitle: r.stimulus_title || r.rubric_json?.stimulusTitle || undefined,
      stimulusText: r.stimulus_text || r.rubric_json?.stimulusText || undefined,
      stimulusMediaUrl: r.stimulus_media_url || r.rubric_json?.stimulusMediaUrl || undefined,
    };
  },

  async deleteQuestionBankItem(id: string, schoolId?: string | null, teacherId?: string | null): Promise<boolean> {
    let sql = `DELETE FROM question_banks WHERE id = $1`;
    const params: any[] = [id];

    if (schoolId) {
      sql += ` AND (school_id = $${params.length + 1} OR school_id IS NULL)`;
      params.push(schoolId);
    }

    if (teacherId) {
      sql += ` AND (teacher_id = $${params.length + 1} OR teacher_id IS NULL)`;
      params.push(teacherId);
    }

    const res = await queryPostgres(sql, params);
    return (res.rowCount || 0) > 0;
  },

  async getAllStudents(): Promise<Student[]> {
    const res = await queryPostgres(
      `SELECT s.*, c.name as class_room_name 
       FROM students s 
       LEFT JOIN class_rooms c ON s.class_room_id = c.id 
       ORDER BY s.full_name ASC;`
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      nis: r.nis,
      nisn: r.nisn,
      fullName: r.full_name,
      gender: r.gender,
      classRoomId: r.class_room_id,
      classRoomName: r.class_room_name,
      cardAccessCode: r.card_access_code,
      isActive: r.is_active,
    }));
  },
};
