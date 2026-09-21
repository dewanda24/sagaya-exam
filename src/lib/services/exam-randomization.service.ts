import crypto from 'crypto';
import { queryPostgres, withTransaction } from '../core/postgres';
import { ExamSnapshotService } from './exam-snapshot.service';

/**
 * Algoritma Mulberry32: PRNG deterministik berkecepatan tinggi berbasis 32-bit integer seed.
 * Menghasilkan sequence angka pseudo-random [0, 1) yang 100% konsisten berdasarkan seed awal.
 */
export function createMulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle deterministik menggunakan generator PRNG.
 */
export function deterministicShuffle<T>(array: T[], prng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export class ExamRandomizationService {
  /**
   * Menghasilkan seed 32-bit deterministik berbasis identitas sesi, ujian, dan partisipan.
   */
  static generateSeed(sessionId: string, examId: string, participantId: string, salt: string = ''): number {
    const hash = crypto
      .createHash('sha256')
      .update(`${sessionId}:${examId}:${participantId}:${salt}`)
      .digest();
    return hash.readUInt32BE(0);
  }

  /**
   * Menginisialisasi urutan soal dan opsi untuk suatu sesi ujian.
   * Bersifat idempoten: jika urutan sudah pernah digenerate untuk sesi ini,
   * ambil dari database tanpa melakukan pengacakan ulang.
   */
  static async initializeSessionOrdering(sessionId: string) {
    return await withTransaction(async (client) => {
      // 1. Ambil detail sesi
      const sessRes = await client.query(
        `SELECT s.id, s.exam_id, s.participant_id, s.snapshot_id, s.random_seed,
                e.randomize_questions, e.randomize_options, e.active_snapshot_id
         FROM exam_sessions s
         JOIN exams e ON s.exam_id = e.id
         WHERE s.id = $1
         LIMIT 1;`,
        [sessionId]
      );

      if (sessRes.rows.length === 0) {
        throw new Error(`Sesi ujian dengan ID '${sessionId}' tidak ditemukan.`);
      }

      const session = sessRes.rows[0];

      // 2. Periksa apakah sudah ada mapping question_order_maps
      const existingQMaps = await client.query(
        `SELECT qm.*, sq.position as snapshot_position, sq.configuration_json
         FROM question_order_maps qm
         JOIN exam_snapshot_questions sq ON qm.snapshot_question_id = sq.id
         WHERE qm.session_id = $1
         ORDER BY qm.display_position ASC;`,
        [sessionId]
      );

      if (existingQMaps.rows.length > 0) {
        // Sudah ada urutan tersimpan, ambil juga option_order_maps
        const existingOptMaps = await client.query(
          `SELECT * FROM option_order_maps WHERE session_id = $1 ORDER BY question_id, display_position ASC;`,
          [sessionId]
        );

        return {
          isNew: false,
          questionOrder: existingQMaps.rows,
          optionOrder: existingOptMaps.rows,
        };
      }

      // 3. Ambil snapshot aktif
      let snapshotId = session.snapshot_id || session.active_snapshot_id;
      if (!snapshotId) {
        const snap = await ExamSnapshotService.getActiveSnapshotForExam(session.exam_id);
        snapshotId = snap.id;
        await client.query(`UPDATE exam_sessions SET snapshot_id = $1 WHERE id = $2;`, [snapshotId, sessionId]);
      }

      // 4. Ambil butir-butir soal dari snapshot
      const snapQRes = await client.query(
        `SELECT * FROM exam_snapshot_questions WHERE snapshot_id = $1 ORDER BY position ASC;`,
        [snapshotId]
      );

      const snapshotQuestions = snapQRes.rows;
      if (snapshotQuestions.length === 0) {
        throw new Error('Snapshot ujian tidak memiliki butir soal yang dapat dikerjakan.');
      }

      // 5. Bangun seed deterministik
      const baseSeed = this.generateSeed(sessionId, session.exam_id, session.participant_id);
      await client.query(`UPDATE exam_sessions SET random_seed = $1 WHERE id = $2;`, [String(baseSeed), sessionId]);

      // 6. Urutkan soal: acak jika randomize_questions aktif, atau pertahankan urutan snapshot
      let orderedQuestions = [...snapshotQuestions];
      if (session.randomize_questions) {
        const qPrng = createMulberry32(baseSeed);
        orderedQuestions = deterministicShuffle(snapshotQuestions, qPrng);
      }

      // Simpan ke question_order_maps
      const createdQMaps: any[] = [];
      for (let i = 0; i < orderedQuestions.length; i++) {
        const q = orderedQuestions[i];
        const insRes = await client.query(
          `INSERT INTO question_order_maps (
             id, session_id, snapshot_question_id, question_id, display_position, created_at
           ) VALUES (
             uuid_generate_v4(), $1, $2, $3, $4, NOW()
           ) RETURNING *;`,
          [sessionId, q.id, q.question_id || q.id, i + 1]
        );
        createdQMaps.push({
          ...insRes.rows[0],
          snapshot_position: q.position,
          configuration_json: q.configuration_json,
        });
      }

      // 7. Urutkan opsi jika randomize_options aktif
      const createdOptMaps: any[] = [];
      for (const q of orderedQuestions) {
        const config = q.configuration_json || {};
        const options = Array.isArray(config.options) ? config.options : [];

        if (options.length > 0) {
          let orderedOptions = [...options];
          if (session.randomize_options) {
            const optSeed = this.generateSeed(sessionId, session.exam_id, session.participant_id, q.id);
            const optPrng = createMulberry32(optSeed);
            orderedOptions = deterministicShuffle(options, optPrng);
          }

          for (let j = 0; j < orderedOptions.length; j++) {
            const opt = orderedOptions[j];
            const optId = opt.id || `opt_${j + 1}`;
            const optInsRes = await client.query(
              `INSERT INTO option_order_maps (
                 id, session_id, question_id, option_id, display_position, created_at
               ) VALUES (
                 uuid_generate_v4(), $1, $2, $3, $4, NOW()
               ) RETURNING *;`,
              [sessionId, q.question_id || q.id, optId, j + 1]
            );
            createdOptMaps.push(optInsRes.rows[0]);
          }
        }
      }

      return {
        isNew: true,
        questionOrder: createdQMaps,
        optionOrder: createdOptMaps,
      };
    });
  }

  /**
   * Mengambil mapping urutan soal yang sudah persisten untuk sesi ini.
   */
  static async getSessionQuestionOrder(sessionId: string) {
    const res = await queryPostgres(
      `SELECT qm.display_position, qm.question_id, qm.snapshot_question_id,
              sq.section, sq.points, sq.position as snapshot_position,
              sq.configuration_json
       FROM question_order_maps qm
       JOIN exam_snapshot_questions sq ON qm.snapshot_question_id = sq.id
       WHERE qm.session_id = $1
       ORDER BY qm.display_position ASC;`,
      [sessionId]
    );

    if (res.rows.length === 0) {
      // Lazy init jika belum ada
      const initResult = await this.initializeSessionOrdering(sessionId);
      return initResult.questionOrder;
    }

    return res.rows;
  }

  /**
   * Mengambil mapping opsi terurut untuk soal tertentu dalam sesi.
   */
  static async getSessionOptionOrder(sessionId: string, questionId: string) {
    const res = await queryPostgres(
      `SELECT option_id, display_position
       FROM option_order_maps
       WHERE session_id = $1 AND question_id = $2
       ORDER BY display_position ASC;`,
      [sessionId, questionId]
    );
    return res.rows;
  }
}
