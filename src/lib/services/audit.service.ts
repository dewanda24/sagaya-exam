import { queryPostgres } from '../core/postgres';

export interface AuditEventPayload {
  userId?: string | null;
  role?: string | null;
  schoolId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  details?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogFilter {
  startDate?: string;
  endDate?: string;
  actorId?: string;
  role?: string;
  schoolId?: string;
  action?: string;
  resourceType?: string;
  severity?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Mencatat event audit secara immutable ke tabel audit_logs.
 */
export async function logAuditEvent(payload: AuditEventPayload): Promise<string> {
  try {
    const res = await queryPostgres(
      `INSERT INTO audit_logs (
        user_id, role, school_id, action, details_json, 
        ip_address, user_agent, resource_type, resource_id, severity, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id;`,
      [
        payload.userId || null,
        payload.role || null,
        payload.schoolId || null,
        payload.action,
        JSON.stringify(payload.details || {}),
        payload.ipAddress || null,
        payload.userAgent || null,
        payload.resourceType || null,
        payload.resourceId || null,
        payload.severity || 'INFO',
      ]
    );

    return res.rows[0]?.id || '';
  } catch (err: any) {
    console.error('Failed to log audit event:', err);
    return '';
  }
}

/**
 * Membaca audit logs dengan filter lengkap dan pagination (Read-Only).
 */
export async function getAuditLogs(filter: AuditLogFilter = {}) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = ['1=1'];
  let params: any[] = [];

  if (filter.startDate) {
    params.push(filter.startDate);
    whereClauses.push(`a.created_at >= $${params.length}::timestamptz`);
  }

  if (filter.endDate) {
    params.push(filter.endDate);
    whereClauses.push(`a.created_at <= $${params.length}::timestamptz`);
  }

  if (filter.actorId) {
    params.push(filter.actorId);
    whereClauses.push(`a.user_id = $${params.length}`);
  }

  if (filter.role && filter.role !== 'ALL') {
    params.push(filter.role);
    whereClauses.push(`a.role = $${params.length}`);
  }

  if (filter.schoolId && filter.schoolId !== 'ALL') {
    params.push(filter.schoolId);
    whereClauses.push(`a.school_id = $${params.length}`);
  }

  if (filter.action && filter.action !== 'ALL') {
    params.push(`%${filter.action}%`);
    whereClauses.push(`a.action ILIKE $${params.length}`);
  }

  if (filter.resourceType && filter.resourceType !== 'ALL') {
    params.push(filter.resourceType);
    whereClauses.push(`a.resource_type = $${params.length}`);
  }

  if (filter.severity && filter.severity !== 'ALL') {
    params.push(filter.severity);
    whereClauses.push(`a.severity = $${params.length}`);
  }

  if (filter.search) {
    params.push(`%${filter.search}%`);
    whereClauses.push(
      `(a.action ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR s.name ILIKE $${params.length} OR a.resource_id ILIKE $${params.length})`
    );
  }

  const whereSql = whereClauses.join(' AND ');

  const countQuery = `
    SELECT COUNT(*) as total
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN schools s ON a.school_id = s.id
    WHERE ${whereSql};
  `;

  const totalRes = await queryPostgres(countQuery, params);
  const total = parseInt(totalRes.rows[0]?.total || '0', 10);

  const dataQuery = `
    SELECT 
      a.id,
      a.user_id as "userId",
      COALESCE(u.full_name, 'Sistem / Anonim') as "actorName",
      a.role as "actorRole",
      a.school_id as "schoolId",
      COALESCE(s.name, 'Platform Global') as "schoolName",
      a.action,
      a.resource_type as "resourceType",
      a.resource_id as "resourceId",
      a.severity,
      a.details_json as "details",
      a.ip_address as "ipAddress",
      a.user_agent as "userAgent",
      a.created_at as "createdAt"
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN schools s ON a.school_id = s.id
    WHERE ${whereSql}
    ORDER BY a.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  const dataRes = await queryPostgres(dataQuery, [...params, limit, offset]);

  // Clean sensitive keys from details if any exist
  const logs = dataRes.rows.map((row) => {
    const details = { ...(row.details || {}) };
    delete details.password;
    delete details.passwordHash;
    delete details.secret;
    delete details.token;
    delete details.tempPassword;
    return {
      ...row,
      details,
    };
  });

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export const AuditService = {
  log: logAuditEvent,
  logAuditEvent,
  createLog: async (params: {
    action: string;
    schoolId?: string;
    actor?: { id: string; username?: string; role?: string };
    resourceType?: string;
    resourceId?: string;
    details?: any;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  }) => {
    return logAuditEvent({
      action: params.action,
      schoolId: params.schoolId,
      userId: params.actor?.id,
      role: params.actor?.role,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: params.details,
      severity: params.severity || 'INFO',
    });
  },
  getAuditLogs,
};
