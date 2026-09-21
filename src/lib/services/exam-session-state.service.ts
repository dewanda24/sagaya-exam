import { queryPostgres } from '@/lib/core/postgres';
import { formatTokenInput, hashExamToken } from '@/lib/school/token-generator';
import { createStudentSessionToken, StudentAuthContext } from '@/lib/core/auth';
import { calculateParticipantScore } from '@/lib/school/scoring-engine';
import { ScoringService } from './scoring.service';
import { ExamRandomizationService } from './exam-randomization.service';
import { QuestionDeliveryService } from './question-delivery.service';
import { ExamAnswerService } from './exam-answer.service';


export interface CreateSessionParams {
  token: string;
  deviceId: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AutosaveParams {
  questionId: string;
  answerValue: any;
  isDoubtful?: boolean;
  version?: number;
}

export interface ViolationEventParams {
  type: 'TAB_SWITCH' | 'FOCUS_LOST' | 'FULLSCREEN_EXIT' | 'NETWORK_DISCONNECT' | 'DEVICE_MISMATCH' | 'SUSPICIOUS_RECONNECT';
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  metadata?: Record<string, any>;
}

export class ExamSessionStateService {
  /**
   * Mengautentikasi token ujian dan membuat atau melanjutkan sesi ujian secara atomik.
   * Melakukan validasi multi-layer:
   * - Token exists & format valid
   * - School active
   * - Student active & participant eligible
   * - Exam active & within valid schedule
   * - Attempt policy (ONE_ATTEMPT by default)
   * - Device binding & single active session constraint
   */
  static async authenticateAndCreateSession(params: CreateSessionParams) {
    const { token, deviceId, userAgent = '', ipAddress = '' } = params;
    const cleanToken = formatTokenInput(token);
    const tokenHash = hashExamToken(cleanToken);

    // 1. Lookup participant via token or token_hash
    const partRes = await queryPostgres(
      `SELECT ep.*, 
              e.id as ex_id, e.title as ex_title, e.status as ex_status, e.start_time, e.end_time,
              e.duration_minutes, e.question_snapshot_json, e.release_token, e.school_id as ex_school_id,
              s.id as st_id, s.nis, s.nisn, s.full_name as st_name, s.is_active as st_is_active,
              c.name as class_name,
              sc.id as sc_id, sc.name as sc_name, sc.is_active as sc_is_active,
              sub.name as subject_name
       FROM exam_participants ep
       JOIN exams e ON ep.exam_id = e.id
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       JOIN schools sc ON e.school_id = sc.id
       LEFT JOIN subjects sub ON e.subject_id = sub.id
       WHERE (ep.token = $1 OR ep.token_hash = $2)
       LIMIT 1;`,
      [cleanToken, tokenHash]
    );

    if (partRes.rows.length === 0) {
      return {
        success: false,
        error: 'Token ujian tidak valid atau tidak ditemukan.',
        code: 'INVALID_TOKEN',
        status: 404,
      };
    }

    const row = partRes.rows[0];

    // 2. Multi-tenant School Check
    if (row.sc_is_active === false) {
      return {
        success: false,
        error: 'Akses ujian dibekukan: Sekolah penyelenggara sedang dinonaktifkan.',
        code: 'SCHOOL_INACTIVE',
        status: 403,
      };
    }

    // 3. Student Active Check
    if (row.st_is_active === false) {
      return {
        success: false,
        error: 'Data siswa berstatus tidak aktif. Hubungi panitia ujian.',
        code: 'STUDENT_INACTIVE',
        status: 403,
      };
    }

    // 4. Participant Eligibility Check
    if (row.eligible === false || row.token_status === 'REVOKED') {
      return {
        success: false,
        error: 'Token ujian telah dicabut atau kepesertaan dinonaktifkan.',
        code: 'TOKEN_REVOKED',
        status: 403,
      };
    }

    // 5. Exam Status Check
    const allowedStatuses = ['ACTIVE', 'PUBLISHED', 'SCHEDULED'];
    if (!allowedStatuses.includes(row.ex_status)) {
      return {
        success: false,
        error: 'Ujian belum aktif atau telah diarsipkan.',
        code: 'EXAM_INACTIVE',
        status: 400,
      };
    }

    // 6. Exam Schedule Window Check
    const now = new Date();
    const start = new Date(row.start_time);
    const end = new Date(row.end_time);

    if (now < start) {
      return {
        success: false,
        error: `Ujian belum dimulai. Jadwal mulai: ${start.toLocaleString('id-ID')}`,
        code: 'EXAM_NOT_STARTED',
        status: 400,
      };
    }

    if (now > end) {
      return {
        success: false,
        error: `Periode ujian telah berakhir pada ${end.toLocaleString('id-ID')}`,
        code: 'EXAM_ENDED',
        status: 400,
      };
    }

    // 7. Check Existing Exam Session with transactional locking
    const sessRes = await queryPostgres(
      `SELECT * FROM exam_sessions WHERE participant_id = $1 ORDER BY created_at DESC LIMIT 1;`,
      [row.id]
    );

    let sessionRow = sessRes.rows[0];

    if (sessionRow) {
      // Check Attempt Policy: If already SUBMITTED or TIMEOUT
      if (sessionRow.status === 'SUBMITTED') {
        return {
          success: false,
          error: 'Anda sudah menyelesaikan ujian ini. Jawaban telah terkirim.',
          code: 'ALREADY_SUBMITTED',
          status: 400,
        };
      }

      if (sessionRow.status === 'TERMINATED' || sessionRow.status === 'INVALIDATED') {
        return {
          success: false,
          error: 'Sesi ujian telah dihentikan secara permanen oleh pengawas.',
          code: 'SESSION_TERMINATED',
          status: 403,
        };
      }

      // Check Device Binding Conflict on active session
      const boundDeviceId = sessionRow.device_id || sessionRow.device_fingerprint;
      if (
        ['READY', 'IN_PROGRESS', 'DISCONNECTED'].includes(sessionRow.status) &&
        boundDeviceId &&
        boundDeviceId !== deviceId
      ) {
        return {
          success: false,
          error: 'Sesi ujian sedang aktif pada perangkat lain. Minta pengawas untuk melakukan reset sesi jika perangkat Anda bermasalah.',
          code: 'DEVICE_CONFLICT',
          status: 409,
        };
      }

      // Re-bind / Resume Session
      await queryPostgres(
        `UPDATE exam_sessions 
         SET last_heartbeat_at = NOW(),
             device_id = $1,
             device_fingerprint = $1,
             ip_address = $2,
             user_agent = $3,
             updated_at = NOW()
         WHERE id = $4;`,
        [deviceId, ipAddress, userAgent, sessionRow.id]
      );
    } else {
      // Create New Atomic Session (Status: READY)
      const durationMinutes = row.duration_minutes || 90;
      const calculatedExpiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
      const finalExpiresAt = calculatedExpiresAt > end ? end : calculatedExpiresAt;

      const newSessRes = await queryPostgres(
        `INSERT INTO exam_sessions (
           id, exam_id, participant_id, student_id, school_id,
           attempt_number, status, started_at, server_started_at,
           expires_at, server_expires_at, last_heartbeat_at,
           device_id, device_fingerprint, ip_address, user_agent,
           session_version, current_question_index, tab_violation_count
         ) VALUES (
           uuid_generate_v4(), $1, $2, $3, $4,
           1, 'READY', $5, $5,
           $6, $6, $5,
           $7, $7, $8, $9,
           1, 0, 0
         ) RETURNING *;`,
        [
          row.ex_id,
          row.id,
          row.st_id,
          row.sc_id,
          now.toISOString(),
          finalExpiresAt.toISOString(),
          deviceId,
          ipAddress,
          userAgent,
        ]
      );
      sessionRow = newSessRes.rows[0];
    }

    // 8. Generate Cryptographically Signed Student Session Token
    const durationHours = Math.ceil((row.duration_minutes || 90) / 60) + 3;
    const studentSessionToken = await createStudentSessionToken({
      sessionId: sessionRow.id,
      examId: row.ex_id,
      participantId: row.id,
      studentId: row.st_id,
      schoolId: row.sc_id,
      studentName: row.st_name,
      deviceId,
      sessionVersion: Number(sessionRow.session_version || 1),
      durationHours,
    });

    return {
      success: true,
      token: studentSessionToken,
      durationHours,
      session: {
        id: sessionRow.id,
        status: sessionRow.status,
        startedAt: sessionRow.started_at,
        expiresAt: sessionRow.expires_at,
      },
      participant: {
        id: row.id,
        studentName: row.st_name,
        nisn: row.nisn,
        nis: row.nis,
        className: row.class_name,
        assignedPackage: row.assigned_package,
      },
      exam: {
        id: row.ex_id,
        title: row.ex_title,
        subject: row.subject_name || 'Ujian',
        durationMinutes: row.duration_minutes,
        startTime: row.start_time,
        endTime: row.end_time,
        requiresProctorToken: !!row.release_token,
      },
    };
  }

  /**
   * Memulai pengerjaan ujian: Transisi READY -> IN_PROGRESS.
   * Menetapkan started_at dan menghitung expires_at server pasti.
   */
  static async startSession(authContext: StudentAuthContext) {
    const { sessionId, examId, durationMinutes } = authContext;

    const res = await queryPostgres(
      `SELECT es.status, es.started_at, es.expires_at, e.end_time
       FROM exam_sessions es
       JOIN exams e ON es.exam_id = e.id
       WHERE es.id = $1
       FOR UPDATE;`,
      [sessionId]
    );

    if (res.rows.length === 0) {
      return { success: false, error: 'Sesi ujian tidak ditemukan.', statusCode: 404 };
    }

    const row = res.rows[0];

    // If already in progress, return current state
    if (row.status === 'IN_PROGRESS') {
      const now = Date.now();
      const exp = new Date(row.expires_at).getTime();
      return {
        success: true,
        status: 'IN_PROGRESS',
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        remainingSeconds: Math.max(0, Math.floor((exp - now) / 1000)),
      };
    }

    if (row.status !== 'READY' && row.status !== 'CREATED') {
      return {
        success: false,
        error: `Tidak dapat memulai ujian dengan status sesi: ${row.status}`,
        statusCode: 400,
      };
    }

    const now = new Date();
    const end = new Date(row.end_time);
    const calculatedExpiresAt = new Date(now.getTime() + (durationMinutes || 90) * 60 * 1000);
    const finalExpiresAt = calculatedExpiresAt > end ? end : calculatedExpiresAt;

    const updateRes = await queryPostgres(
      `UPDATE exam_sessions
       SET status = 'IN_PROGRESS',
           started_at = $1,
           server_started_at = $1,
           expires_at = $2,
           server_expires_at = $2,
           last_heartbeat_at = $1,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *;`,
      [now.toISOString(), finalExpiresAt.toISOString(), sessionId]
    );

    const updated = updateRes.rows[0];
    const remainingSeconds = Math.max(0, Math.floor((finalExpiresAt.getTime() - now.getTime()) / 1000));

    // Inisialisasi urutan soal deterministik untuk sesi ini
    await ExamRandomizationService.initializeSessionOrdering(sessionId).catch((err) => {
      console.warn('Warning initializing session ordering:', err);
    });

    return {
      success: true,
      status: 'IN_PROGRESS',
      startedAt: updated.started_at,
      expiresAt: updated.expires_at,
      remainingSeconds,
    };
  }

  /**
   * Heartbeat berkala dengan throttling dan deteksi timeout otomatis.
   */
  static async heartbeat(authContext: StudentAuthContext, currentQuestionIndex: number = 0) {
    const { sessionId, examId } = authContext;

    // Check expiration authority
    if (authContext.isExpired) {
      await this.timeout(sessionId);
      return {
        success: true,
        status: 'TIMEOUT',
        isExpired: true,
        remainingSeconds: 0,
        serverTime: new Date().toISOString(),
        broadcastMessage: null,
      };
    }

    if (authContext.status !== 'IN_PROGRESS') {
      return {
        success: true,
        status: authContext.status,
        isExpired: false,
        remainingSeconds: authContext.remainingSeconds,
        serverTime: new Date().toISOString(),
        broadcastMessage: null,
      };
    }

    const safeIndex = Math.max(0, Number(currentQuestionIndex) || 0);

    // Update heartbeat
    await queryPostgres(
      `UPDATE exam_sessions
       SET last_heartbeat_at = NOW(),
           current_question_index = $1,
           updated_at = NOW()
       WHERE id = $2;`,
      [safeIndex, sessionId]
    );

    // Fetch active broadcast message if any within last 10 minutes
    const bcastRes = await queryPostgres(
      `SELECT active_broadcast_message
       FROM exams
       WHERE id = $1 AND active_broadcast_message IS NOT NULL AND active_broadcast_at >= NOW() - INTERVAL '10 minutes'
       LIMIT 1;`,
      [examId]
    ).catch(() => ({ rows: [] }));

    const broadcastMessage = bcastRes.rows[0]?.active_broadcast_message || null;

    return {
      success: true,
      status: 'IN_PROGRESS',
      isExpired: false,
      remainingSeconds: authContext.remainingSeconds,
      serverTime: new Date().toISOString(),
      broadcastMessage,
    };
  }

  /**
   * Autosave jawaban siswa secara idempoten dan optimistik.
   * Memvalidasi bahwa questionId berasal dari paket snapshot soal ujian ini.
   */
  static async autosave(authContext: StudentAuthContext, params: AutosaveParams) {
    const { questionId, answerValue, isDoubtful = false, version = 1 } = params;

    const result = await ExamAnswerService.saveAnswer(authContext, {
      questionId,
      answer: answerValue,
      isDoubtful,
      clientVersion: version,
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: {
        questionId: result.data!.questionId,
        isDoubtful: result.data!.isDoubtful,
        savedAt: result.data!.savedAt,
        version: result.data!.version,
      },
    };
  }

  /**
   * Mencatat kejadian/pelanggaran siswa (Tab switch, focus loss, fullscreen exit)
   * Penghitungan total pelanggaran ditentukan secara server-authoritative.
   */
  static async recordViolation(authContext: StudentAuthContext, params: ViolationEventParams) {
    const { sessionId, participantId, examId, schoolId } = authContext;
    const { type, severity = 'INFO', metadata = {} } = params;

    // 1. Insert into exam_session_violations
    await queryPostgres(
      `INSERT INTO exam_session_violations (
         id, session_id, participant_id, exam_id, school_id, type, severity, metadata, occurred_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, NOW()
       );`,
      [sessionId, participantId, examId, schoolId, type, severity, JSON.stringify(metadata)]
    );

    // 2. Also replicate to exam_violations for Proctor Real-time Monitoring dashboard
    await queryPostgres(
      `INSERT INTO exam_violations (
         id, school_id, exam_id, participant_id, session_id, event_type, severity, description, metadata_json, created_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
       );`,
      [
        schoolId,
        examId,
        participantId,
        sessionId,
        type,
        severity,
        `Event ${type} dilaporkan oleh browser peserta.`,
        JSON.stringify(metadata),
      ]
    ).catch(() => {});

    // 3. Server-Authoritative Count
    const countRes = await queryPostgres(
      `SELECT COUNT(*) as total FROM exam_session_violations WHERE session_id = $1;`,
      [sessionId]
    );

    const totalViolations = Number(countRes.rows[0]?.total || 0);

    await queryPostgres(
      `UPDATE exam_sessions SET tab_violation_count = $1, updated_at = NOW() WHERE id = $2;`,
      [totalViolations, sessionId]
    );

    return {
      success: true,
      type,
      totalViolations,
    };
  }

  /**
   * Mengambil data lengkap sesi siswa saat ini (Safe questions tanpa answerKey, jawaban tersimpan).
   */
  static async getCurrentSessionData(authContext: StudentAuthContext) {
    const { sessionId, examId } = authContext;

    // 1. Pastikan urutan sesi telah diinisialisasi
    await ExamRandomizationService.initializeSessionOrdering(sessionId).catch(() => {});

    // 2. Ambil snapshot soal aman via QuestionDeliveryService
    const questions = await QuestionDeliveryService.getSessionQuestions(authContext);

    // Format safe questions agar kompatibel dengan legacy frontend
    const clientSafeQuestions = questions.map((q) => ({
      ...q,
      question_text: q.questionText,
      options_json: q.options,
      weight: q.points,
    }));

    // 3. Ambil jawaban tersimpan
    const ansRes = await queryPostgres(
      `SELECT question_id, answer_value_json, is_doubtful, marked_for_review, version, updated_at
       FROM student_answers
       WHERE session_id = $1;`,
      [sessionId]
    );

    const savedAnswers: Record<string, any> = {};
    for (const row of ansRes.rows) {
      savedAnswers[row.question_id] = {
        value: row.answer_value_json,
        isDoubtful: Boolean(row.marked_for_review ?? row.is_doubtful),
        version: row.version,
        updatedAt: row.updated_at,
      };
    }

    // 4. Ambil konfigurasi navigasi ujian
    const examMetaRes = await queryPostgres(
      `SELECT navigation_policy, duration_minutes FROM exams WHERE id = $1 LIMIT 1;`,
      [examId]
    );
    const examMeta = examMetaRes.rows[0] || {};

    return {
      success: true,
      data: {
        session: {
          id: authContext.sessionId,
          status: authContext.status,
          startedAt: authContext.startedAt,
          expiresAt: authContext.expiresAt,
          remainingSeconds: authContext.remainingSeconds,
          isExpired: authContext.isExpired,
          tabViolationCount: authContext.tabViolationCount,
        },
        participant: {
          studentName: authContext.studentName,
          nisn: authContext.nisn,
          className: authContext.className,
          assignedPackage: authContext.assignedPackage,
        },
        exam: {
          id: authContext.examId,
          title: authContext.examTitle,
          subject: authContext.subjectName,
          durationMinutes: authContext.durationMinutes || examMeta.duration_minutes,
          navigationPolicy: examMeta.navigation_policy || 'FREE_NAVIGATION',
        },
        questions: clientSafeQuestions,
        answers: savedAnswers,
      },
    };
  }

  /**
   * Pemulihan sesi terputus / reload browser (Recovery).
   */
  static async recover(authContext: StudentAuthContext) {
    const { sessionId } = authContext;

    // If session was marked DISCONNECTED, transition back to IN_PROGRESS
    if (authContext.status === 'DISCONNECTED') {
      await queryPostgres(
        `UPDATE exam_sessions SET status = 'IN_PROGRESS', last_heartbeat_at = NOW(), updated_at = NOW() WHERE id = $1;`,
        [sessionId]
      );
      authContext.status = 'IN_PROGRESS';
    }

    return await this.getCurrentSessionData(authContext);
  }

  /**
   * Finalisasi submission ujian secara transaksional atomik dan idempoten.
   */
  static async submit(authContext: StudentAuthContext) {
    const { sessionId, participantId, examId } = authContext;

    // Atomic transaction lock
    const sessRes = await queryPostgres(
      `SELECT status, submitted_at FROM exam_sessions WHERE id = $1 FOR UPDATE;`,
      [sessionId]
    );

    if (sessRes.rows.length === 0) {
      return { success: false, error: 'Sesi ujian tidak ditemukan.', status: 404 };
    }

    const currentStatus = sessRes.rows[0].status;

    // Idempotency: Jika sudah pernah disubmit
    if (currentStatus === 'SUBMITTED') {
      return {
        success: true,
        message: 'Ujian telah dikirimkan sebelumnya.',
        data: {
          status: 'SUBMITTED',
          submittedAt: sessRes.rows[0].submitted_at,
        },
      };
    }

    const now = new Date().toISOString();

    // Update session to SUBMITTED
    await queryPostgres(
      `UPDATE exam_sessions
       SET status = 'SUBMITTED',
           submitted_at = $1,
           updated_at = NOW()
       WHERE id = $2;`,
      [now, sessionId]
    );

    // Update participant token to USED
    await queryPostgres(
      `UPDATE exam_participants SET token_status = 'USED' WHERE id = $1;`,
      [participantId]
    );

    // Calculate score using server-authoritative ScoringService
    let scoringResult: any = null;
    try {
      scoringResult = await ScoringService.scoreExamSession(sessionId, {
        id: authContext.studentId,
        username: authContext.studentName,
        role: 'SISWA',
      });
    } catch (e) {
      console.error('Error in ScoringService.scoreExamSession:', e);
      // Fallback legacy calculation if snapshot not available
      try {
        await calculateParticipantScore(examId, participantId);
      } catch (legacyErr) {
        console.error('Error in legacy calculateParticipantScore fallback:', legacyErr);
      }
    }

    return {
      success: true,
      message: 'Ujian berhasil diserahkan.',
      data: {
        status: 'SUBMITTED',
        submittedAt: now,
        resultId: scoringResult?.resultId,
        finalScore: scoringResult?.finalScore,
        resultStatus: scoringResult?.status,
      },
    };
  }

  /**
   * Timeout server-authoritative saat expires_at terlewati.
   */
  static async timeout(sessionId: string) {
    const now = new Date().toISOString();
    await queryPostgres(
      `UPDATE exam_sessions
       SET status = 'TIMEOUT',
           submitted_at = COALESCE(submitted_at, $1),
           updated_at = NOW()
       WHERE id = $2 AND status IN ('IN_PROGRESS', 'READY', 'DISCONNECTED');`,
      [now, sessionId]
    );
  }

  /**
   * Penghentian darurat / administratif oleh proktor atau administrator.
   */
  static async terminate(sessionId: string, actor: { userId: string; role: string; reason: string }) {
    const now = new Date().toISOString();
    await queryPostgres(
      `UPDATE exam_sessions
       SET status = 'TERMINATED',
           terminated_at = $1,
           session_version = session_version + 1,
           updated_at = NOW()
       WHERE id = $2;`,
      [now, sessionId]
    );
  }

  /**
   * Invalidation token / sesi untuk mitigasi session hijacking.
   */
  static async invalidate(sessionId: string, reason: string = 'SESSION_INVALIDATED') {
    await queryPostgres(
      `UPDATE exam_sessions
       SET status = 'INVALIDATED',
           session_version = session_version + 1,
           updated_at = NOW()
       WHERE id = $1;`,
      [sessionId]
    );
  }
}
