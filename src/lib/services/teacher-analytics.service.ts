import { queryPostgres } from '../core/postgres';

export class TeacherAnalyticsService {
  /**
   * Mengambil analitik soal dan evaluasi kelas yang secara spesifik diampu oleh guru.
   */
  static async getAnalytics(schoolId: string, teacherId: string) {
    // 1. Distribusi Soal per Tipe
    const typeRes = await queryPostgres(
      `SELECT type, COUNT(*) as count 
       FROM question_banks 
       WHERE school_id = $1 AND teacher_id = $2
       GROUP BY type;`,
      [schoolId, teacherId]
    );

    // 2. Distribusi Soal per Tingkat Kesulitan
    const diffRes = await queryPostgres(
      `SELECT difficulty, COUNT(*) as count 
       FROM question_banks 
       WHERE school_id = $1 AND teacher_id = $2
       GROUP BY difficulty;`,
      [schoolId, teacherId]
    );

    // 3. Analisis Butir Soal (Item Analysis) empiris
    const itemAnalysisRes = await queryPostgres(
      `SELECT qb.id, qb.topic, qb.type, qb.difficulty,
              COUNT(sa.id) as total_attempts,
              COUNT(*) FILTER (WHERE sa.auto_score > 0 OR sa.manual_score > 0) as correct_count,
              AVG(COALESCE(sa.manual_score, sa.auto_score, 0)) as avg_score,
              qb.weight as max_score
       FROM question_banks qb
       LEFT JOIN student_answers sa ON qb.id::text = sa.question_id
       WHERE qb.school_id = $1 AND qb.teacher_id = $2
       GROUP BY qb.id, qb.topic, qb.type, qb.difficulty, qb.weight
       ORDER BY total_attempts DESC
       LIMIT 20;`,
      [schoolId, teacherId]
    );

    // 4. Performa Rata-Rata per Kelas yang Diampu Guru
    const classPerformanceRes = await queryPostgres(
      `SELECT c.id as class_id, c.name as class_name,
              COUNT(DISTINCT ep.id) as total_participants,
              AVG(ep.final_score) as average_score,
              MAX(ep.final_score) as highest_score,
              MIN(ep.final_score) as lowest_score
       FROM teacher_classes tc
       JOIN class_rooms c ON tc.class_room_id = c.id
       JOIN students st ON c.id = st.class_room_id
       JOIN exam_participants ep ON st.id = ep.student_id
       WHERE tc.school_id = $1 AND tc.teacher_id = $2 AND ep.final_score IS NOT NULL
       GROUP BY c.id, c.name
       ORDER BY c.name ASC;`,
      [schoolId, teacherId]
    );

    return {
      typeDistribution: typeRes.rows.map((r) => ({
        type: r.type,
        count: parseInt(r.count || '0', 10),
      })),
      difficultyDistribution: diffRes.rows.map((r) => ({
        difficulty: r.difficulty || 'MEDIUM',
        count: parseInt(r.count || '0', 10),
      })),
      questionPerformance: itemAnalysisRes.rows.map((r) => {
        const attempts = parseInt(r.total_attempts || '0', 10);
        const correct = parseInt(r.correct_count || '0', 10);
        const correctRate = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
        const maxScore = parseFloat(r.max_score || '1.0');
        const avgScore = parseFloat(r.avg_score || '0');

        return {
          id: r.id,
          topic: r.topic,
          type: r.type,
          difficulty: r.difficulty,
          attempts,
          correctRate,
          averageScore: Math.round(avgScore * 100) / 100,
          maxScore,
        };
      }),
      classPerformance: classPerformanceRes.rows.map((r) => ({
        classId: r.class_id,
        className: r.class_name,
        totalParticipants: parseInt(r.total_participants || '0', 10),
        averageScore: Math.round(parseFloat(r.average_score || '0') * 100) / 100,
        highestScore: parseFloat(r.highest_score || '0'),
        lowestScore: parseFloat(r.lowest_score || '0'),
      })),
    };
  }
}
