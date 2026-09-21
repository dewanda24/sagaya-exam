import { queryPostgres } from '../core/postgres';
import { AnalyticsContext, AnalyticsAuthService } from '../core/analytics-auth';
import { logAuditEvent } from './audit.service';

export interface CreateReportSnapshotParams {
  reportType: string;
  scope?: string;
  filters?: Record<string, any>;
  dataPayload: Record<string, any>;
  dataVersion?: string;
  scoringVersion?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  storageReference?: string;
}

export class ReportSnapshotService {
  /**
   * Membuat salinan laporan resmi yang dibekukan secara permanen (Snapshot)
   */
  static async createSnapshot(
    context: AnalyticsContext,
    params: CreateReportSnapshotParams
  ) {
    if (!context.schoolId) {
      throw new Error('Konteks sekolah tidak valid.');
    }

    const {
      reportType,
      scope = 'SCHOOL',
      filters = {},
      dataPayload,
      dataVersion = 'v1.0',
      scoringVersion = 'v1.0',
      status = 'PUBLISHED',
      storageReference = null,
    } = params;

    const res = await queryPostgres(
      `INSERT INTO report_snapshots (
         school_id, report_type, scope, filters, data_payload,
         data_version, scoring_version, status, storage_reference,
         generated_by, generated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *;`,
      [
        context.schoolId,
        reportType,
        scope,
        JSON.stringify(filters),
        JSON.stringify(dataPayload),
        dataVersion,
        scoringVersion,
        status,
        storageReference,
        context.userId,
      ]
    );

    const snapshot = res.rows[0];

    // Audit log
    await logAuditEvent({
      schoolId: context.schoolId,
      userId: context.userId,
      action: 'REPORT_SNAPSHOT_CREATED',
      role: context.role,
      resourceType: 'REPORT_SNAPSHOT',
      resourceId: snapshot.id,
      details: {
        reportType,
        scope,
        dataVersion,
        status,
      },
    }).catch(() => {});

    return snapshot;
  }

  /**
   * Mengambil snapshot laporan tertentu dengan verifikasi isolasi tenant
   */
  static async getSnapshot(context: AnalyticsContext, snapshotId: string) {
    const res = await queryPostgres(
      `SELECT rs.*, u.full_name as generator_name 
       FROM report_snapshots rs
       LEFT JOIN users u ON rs.generated_by = u.id
       WHERE rs.id = $1 LIMIT 1;`,
      [snapshotId]
    );

    if (res.rows.length === 0) {
      throw new Error('Snapshot laporan tidak ditemukan.');
    }

    const snapshot = res.rows[0];
    AnalyticsAuthService.assertSchoolScope(context, snapshot.school_id);

    return snapshot;
  }

  /**
   * Mengambil daftar snapshot laporan di sekolah
   */
  static async listSnapshots(
    context: AnalyticsContext,
    filters?: { reportType?: string; status?: string }
  ) {
    if (!context.schoolId) {
      throw new Error('Konteks sekolah tidak valid.');
    }

    let sql = `
      SELECT rs.id, rs.school_id, rs.report_type, rs.scope, rs.filters,
             rs.data_version, rs.scoring_version, rs.status, rs.storage_reference,
             rs.generated_at, u.full_name as generator_name
      FROM report_snapshots rs
      LEFT JOIN users u ON rs.generated_by = u.id
      WHERE rs.school_id = $1
    `;
    const params: any[] = [context.schoolId];

    if (filters?.reportType) {
      params.push(filters.reportType);
      sql += ` AND rs.report_type = $${params.length}`;
    }

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND rs.status = $${params.length}`;
    }

    sql += ` ORDER BY rs.generated_at DESC;`;

    const res = await queryPostgres(sql, params);
    return res.rows;
  }
}
