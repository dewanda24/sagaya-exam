import { queryPostgres, withTransaction } from '../core/postgres';

export interface SnapshotMetadata {
  examTitle: string;
  durationMinutes: number;
  navigationPolicy: 'FREE_NAVIGATION' | 'LINEAR_NAVIGATION';
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  passingGrade?: number;
  totalQuestions: number;
  allowedAttempts: number;
}

export interface SnapshotQuestionItem {
  id: string; // Question Bank ID or unique question identifier
  questionVersionId?: string;
  position: number;
  section: string;
  points: number;
  type: string;
  questionText: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  options?: any[];
  answerKey: any;
  rubric?: any;
  weight?: number;
  explanation?: string;
  [key: string]: any;
}

export class ExamSnapshotService {
  /**
   * Menjamin opsi jawaban memiliki stable ID (bukan sekadar index atau 'A', 'B', 'C')
   * untuk mendukung option randomization yang deterministik dan konsisten.
   */
  static normalizeQuestionOptions(options: any[]): any[] {
    if (!Array.isArray(options)) return [];
    return options.map((opt, idx) => {
      if (typeof opt === 'string') {
        return {
          id: `opt_${idx + 1}`,
          text: opt,
          originalIndex: idx,
        };
      }
      if (typeof opt === 'object' && opt !== null) {
        return {
          ...opt,
          id: opt.id || opt.key || `opt_${idx + 1}`,
          text: opt.text || opt.label || '',
          originalIndex: typeof opt.originalIndex === 'number' ? opt.originalIndex : idx,
        };
      }
      return { id: `opt_${idx + 1}`, text: String(opt), originalIndex: idx };
    });
  }

  /**
   * Membuat atau mengunci (freeze) Snapshot Ujian secara atomik dan immutable.
   * Setelah snapshot dibuat, perubahan bank soal di masa depan TIDAK BOLEH mengubah snapshot.
   */
  static async createOrLockSnapshot(examId: string, actorUserId?: string) {
    return await withTransaction(async (client) => {
      // 1. Ambil exam live
      const examRes = await client.query(
        `SELECT e.*, s.id as school_id
         FROM exams e
         JOIN schools s ON e.school_id = s.id
         WHERE e.id = $1
         FOR UPDATE;`,
        [examId]
      );

      if (examRes.rows.length === 0) {
        throw new Error(`Ujian dengan ID '${examId}' tidak ditemukan.`);
      }

      const exam = examRes.rows[0];

      // 2. Ambil butir-butir soal
      // Prioritas 1: Dari question_snapshot_json jika sudah disiapkan
      // Prioritas 2: Dari exam_questions join question_banks
      let questionsToFreeze: SnapshotQuestionItem[] = [];

      if (Array.isArray(exam.question_snapshot_json) && exam.question_snapshot_json.length > 0) {
        questionsToFreeze = exam.question_snapshot_json.map((q: any, idx: number) => ({
          id: q.id,
          questionVersionId: q.questionVersionId || q.id,
          position: typeof q.position === 'number' ? q.position : idx + 1,
          section: q.section || 'MAIN',
          points: Number(q.weight || q.points || 1.0),
          type: q.type || 'PILIHAN_GANDA',
          questionText: q.question_text || q.questionText || '',
          mediaUrl: q.media_url || q.mediaUrl || null,
          mediaType: q.media_type || q.mediaType || 'NONE',
          options: this.normalizeQuestionOptions(q.options_json || q.options || []),
          answerKey: q.answer_key_json !== undefined ? q.answer_key_json : q.answerKey,
          rubric: q.rubric_json || q.rubric || {},
          weight: Number(q.weight || 1.0),
          explanation: q.explanation || '',
        }));
      } else {
        // Query dari exam_questions join question_banks
        const eqRes = await client.query(
          `SELECT COALESCE(eq.order_index, 0) as position, eq.weight as eq_weight,
                  qb.*
           FROM exam_questions eq
           JOIN question_banks qb ON eq.question_id = qb.id
           WHERE eq.exam_id = $1
           ORDER BY eq.order_index ASC;`,
          [examId]
        );

        if (eqRes.rows.length > 0) {
          questionsToFreeze = eqRes.rows.map((row: any, idx: number) => ({
            id: row.id,
            questionVersionId: row.id,
            position: typeof row.position === 'number' ? row.position : idx + 1,
            section: 'MAIN',
            points: Number(row.eq_weight || row.weight || 1.0),
            type: row.type,
            questionText: row.question_text,
            mediaUrl: row.media_url,
            mediaType: row.media_type,
            options: this.normalizeQuestionOptions(row.options_json || []),
            answerKey: row.answer_key_json,
            rubric: row.rubric_json || {},
            weight: Number(row.eq_weight || row.weight || 1.0),
            explanation: row.explanation || '',
          }));
        }
      }

      if (questionsToFreeze.length === 0) {
        throw new Error('Gagal membuat snapshot: Ujian tidak memiliki butir soal.');
      }

      // 3. Tentukan version baru
      const verRes = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 as next_ver
         FROM exam_snapshots
         WHERE exam_id = $1;`,
        [examId]
      );
      const nextVersion = Number(verRes.rows[0]?.next_ver || 1);

      // 4. Bangun metadata snapshot
      const metadata: SnapshotMetadata = {
        examTitle: exam.title,
        durationMinutes: Number(exam.duration_minutes || 90),
        navigationPolicy: (exam.navigation_policy as any) || 'FREE_NAVIGATION',
        randomizeQuestions: exam.randomize_questions ?? true,
        randomizeOptions: exam.randomize_options ?? true,
        passingGrade: Number(exam.passing_grade || 75),
        totalQuestions: questionsToFreeze.length,
        allowedAttempts: 1,
      };

      // 5. Insert exam_snapshots
      const snapRes = await client.query(
        `INSERT INTO exam_snapshots (
           id, exam_id, school_id, version, metadata_json, created_by, locked_at, created_at
         ) VALUES (
           uuid_generate_v4(), $1, $2, $3, $4, $5, NOW(), NOW()
         ) RETURNING *;`,
        [examId, exam.school_id, nextVersion, JSON.stringify(metadata), actorUserId || null]
      );
      const snapshot = snapRes.rows[0];

      // 6. Insert exam_snapshot_questions (Immutable Question Items)
      for (const q of questionsToFreeze) {
        const frozenConfig = {
          id: q.id,
          type: q.type,
          questionText: q.questionText,
          mediaUrl: q.mediaUrl,
          mediaType: q.mediaType,
          options: q.options,
          answerKey: q.answerKey,
          rubric: q.rubric,
          weight: q.points,
          explanation: q.explanation,
        };

        await client.query(
          `INSERT INTO exam_snapshot_questions (
             id, snapshot_id, question_id, question_version_id, position, section, points, configuration_json, created_at
           ) VALUES (
             uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, NOW()
           );`,
          [
            snapshot.id,
            q.id,
            q.questionVersionId || q.id,
            q.position,
            q.section,
            q.points,
            JSON.stringify(frozenConfig),
          ]
        );
      }

      // 7. Update exams active_snapshot_id & sync question_snapshot_json for backward compatibility
      await client.query(
        `UPDATE exams
         SET active_snapshot_id = $1,
             question_snapshot_json = $2
         WHERE id = $3;`,
        [snapshot.id, JSON.stringify(questionsToFreeze), examId]
      );

      return {
        success: true,
        snapshotId: snapshot.id,
        version: snapshot.version,
        totalQuestions: questionsToFreeze.length,
        lockedAt: snapshot.locked_at,
      };
    });
  }

  /**
   * Mengambil snapshot aktif dari sebuah ujian. Jika belum ada snapshot terdaftar tetapi
   * ujian sudah memiliki butir soal, buatkan snapshot awal secara otomatis.
   */
  static async getActiveSnapshotForExam(examId: string) {
    const res = await queryPostgres(
      `SELECT s.*
       FROM exam_snapshots s
       JOIN exams e ON e.active_snapshot_id = s.id
       WHERE e.id = $1
       LIMIT 1;`,
      [examId]
    );

    if (res.rows.length > 0) {
      return res.rows[0];
    }

    // Jika belum ada active_snapshot_id, coba cari snapshot terbaru
    const latestRes = await queryPostgres(
      `SELECT * FROM exam_snapshots WHERE exam_id = $1 ORDER BY version DESC LIMIT 1;`,
      [examId]
    );

    if (latestRes.rows.length > 0) {
      const snap = latestRes.rows[0];
      await queryPostgres(`UPDATE exams SET active_snapshot_id = $1 WHERE id = $2;`, [snap.id, examId]);
      return snap;
    }

    // Buat snapshot baru jika ada soal di ujian
    const created = await this.createOrLockSnapshot(examId);
    const newSnap = await queryPostgres(`SELECT * FROM exam_snapshots WHERE id = $1;`, [created.snapshotId]);
    return newSnap.rows[0];
  }

  /**
   * Mengambil butir-butir soal beku dari snapshot tertentu.
   */
  static async getSnapshotQuestions(snapshotId: string) {
    const res = await queryPostgres(
      `SELECT *
       FROM exam_snapshot_questions
       WHERE snapshot_id = $1
       ORDER BY position ASC;`,
      [snapshotId]
    );

    return res.rows.map((row) => ({
      id: row.id,
      snapshotId: row.snapshot_id,
      questionId: row.question_id,
      questionVersionId: row.question_version_id,
      position: row.position,
      section: row.section,
      points: Number(row.points),
      configuration: row.configuration_json,
    }));
  }
}
