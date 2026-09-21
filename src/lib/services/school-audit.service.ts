import { queryPostgres } from '../core/postgres';

export class SchoolAuditService {
  /**
   * Mengambil log audit yang strictly terikat ke schoolId milik admin yang login.
   * Log bersifat IMMUTABLE (hanya dapat dibaca, tidak dapat diubah/dihapus).
   */
  static async listSchoolAuditLogs(
    schoolId: string,
    filters?: {
      action?: string;
      role?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    let countSql = `SELECT COUNT(*) as total FROM audit_logs WHERE school_id = $1`;
    let sql = `
      SELECT al.*, 
             u.full_name as actor_name, 
             u.username as actor_username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (filters?.action) {
      params.push(filters.action);
      sql += ` AND al.action = $${params.length}`;
      countSql += ` AND action = $${params.length}`;
    }

    if (filters?.role) {
      params.push(filters.role);
      sql += ` AND al.role = $${params.length}`;
      countSql += ` AND role = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      const sClause = ` AND (al.action ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
      sql += sClause;
      countSql += ` AND action ILIKE $${params.length}`;
    }

    sql += ` ORDER BY al.created_at DESC`;

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    params.push(limit);
    sql += ` LIMIT $${params.length}`;

    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const [countRes, dataRes] = await Promise.all([
      queryPostgres(countSql, params.slice(0, filters?.action || filters?.role || filters?.search ? -2 : 1)),
      queryPostgres(sql, params),
    ]);

    return {
      total: parseInt(countRes.rows[0]?.total || '0', 10),
      logs: dataRes.rows.map((r: any) => ({
        id: r.id,
        schoolId: r.school_id,
        action: r.action,
        role: r.role,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        actorName: r.actor_name || 'System / Platform',
        actorUsername: r.actor_username || 'system',
        details: r.details_json,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        severity: r.severity || 'INFO',
        createdAt: r.created_at,
      })),
    };
  }
}
