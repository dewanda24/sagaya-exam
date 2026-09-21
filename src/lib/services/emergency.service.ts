import { queryPostgres } from '../core/postgres';
import { logAuditEvent } from './audit.service';
import { changeSchoolStatus } from './school.service';

export type EmergencyActionType =
  | 'PAUSE_EXAM'
  | 'RESUME_EXAM'
  | 'STOP_EXAM'
  | 'EXTEND_EXAM_TIME'
  | 'FORCE_SUBMIT_SESSION'
  | 'REVOKE_PARTICIPANT_TOKEN'
  | 'SUSPEND_SCHOOL'
  | 'BROADCAST_EMERGENCY_ALERT';

export interface EmergencyActionPayload {
  action: EmergencyActionType;
  targetId: string;
  reason: string;
  minutesToExtend?: number;
  broadcastMessage?: string;
}

/**
 * Menjalankan operasi tanggap darurat platform dengan validasi server-side ketat dan audit event.
 */
export async function executeEmergencyOperation(
  payload: EmergencyActionPayload,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const { action, targetId, reason } = payload;

  if (!reason || reason.trim().length < 5) {
    throw new Error('Alasan tindakan darurat (Reason) wajib disertakan minimal 5 karakter.');
  }

  if (!targetId && action !== 'BROADCAST_EMERGENCY_ALERT') {
    throw new Error('Target operasi darurat wajib ditentukan.');
  }

  let resultDetails: Record<string, any> = {};

  switch (action) {
    case 'PAUSE_EXAM': {
      const examRes = await queryPostgres(`SELECT id, title, status FROM exams WHERE id = $1;`, [targetId]);
      if (examRes.rows.length === 0) throw new Error('Ujian tidak ditemukan.');
      await queryPostgres(
        `UPDATE exams SET active_broadcast_message = $1, active_broadcast_at = NOW() WHERE id = $2;`,
        [`[DARURAT: UJIAN DIHENTIKAN SEMENTARA] ${reason.trim()}`, targetId]
      );
      resultDetails = { examTitle: examRes.rows[0].title, status: 'PAUSED' };
      break;
    }

    case 'RESUME_EXAM': {
      const examRes = await queryPostgres(`SELECT id, title FROM exams WHERE id = $1;`, [targetId]);
      if (examRes.rows.length === 0) throw new Error('Ujian tidak ditemukan.');
      await queryPostgres(
        `UPDATE exams SET active_broadcast_message = NULL, active_broadcast_at = NULL WHERE id = $1;`,
        [targetId]
      );
      resultDetails = { examTitle: examRes.rows[0].title, status: 'RESUMED' };
      break;
    }

    case 'STOP_EXAM': {
      const examRes = await queryPostgres(`SELECT id, title FROM exams WHERE id = $1;`, [targetId]);
      if (examRes.rows.length === 0) throw new Error('Ujian tidak ditemukan.');
      await queryPostgres(
        `UPDATE exams SET status = 'COMPLETED', end_time = NOW() WHERE id = $1;`,
        [targetId]
      );
      // Auto-submit all in-progress student sessions for this exam
      await queryPostgres(
        `UPDATE exam_sessions SET status = 'SUBMITTED', submitted_at = NOW()
         WHERE participant_id IN (SELECT id FROM exam_participants WHERE exam_id = $1)
           AND status = 'IN_PROGRESS';`,
        [targetId]
      );
      resultDetails = { examTitle: examRes.rows[0].title, status: 'FORCE_STOPPED' };
      break;
    }

    case 'EXTEND_EXAM_TIME': {
      const minutes = payload.minutesToExtend || 15;
      if (minutes < 1 || minutes > 180) {
        throw new Error('Perpanjangan waktu harus antara 1 hingga 180 menit.');
      }
      const examRes = await queryPostgres(`SELECT id, title, duration_minutes, end_time FROM exams WHERE id = $1;`, [targetId]);
      if (examRes.rows.length === 0) throw new Error('Ujian tidak ditemukan.');
      
      await queryPostgres(
        `UPDATE exams SET 
          duration_minutes = duration_minutes + $1,
          end_time = end_time + ($1 || ' minutes')::interval
         WHERE id = $2;`,
        [minutes, targetId]
      );

      // Extend active student sessions server_expires_at
      await queryPostgres(
        `UPDATE exam_sessions SET 
          server_expires_at = server_expires_at + ($1 || ' minutes')::interval
         WHERE participant_id IN (SELECT id FROM exam_participants WHERE exam_id = $2)
           AND status = 'IN_PROGRESS';`,
        [minutes, targetId]
      );

      resultDetails = { examTitle: examRes.rows[0].title, extendedMinutes: minutes };
      break;
    }

    case 'FORCE_SUBMIT_SESSION': {
      const sessionRes = await queryPostgres(`SELECT id, status FROM exam_sessions WHERE id = $1;`, [targetId]);
      if (sessionRes.rows.length === 0) throw new Error('Sesi ujian peserta tidak ditemukan.');
      await queryPostgres(
        `UPDATE exam_sessions SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = $1;`,
        [targetId]
      );
      resultDetails = { sessionId: targetId, status: 'FORCE_SUBMITTED' };
      break;
    }

    case 'REVOKE_PARTICIPANT_TOKEN': {
      const partRes = await queryPostgres(`SELECT id, token FROM exam_participants WHERE id = $1;`, [targetId]);
      if (partRes.rows.length === 0) throw new Error('Peserta ujian tidak ditemukan.');
      await queryPostgres(
        `UPDATE exam_participants SET token_status = 'REVOKED' WHERE id = $1;`,
        [targetId]
      );
      resultDetails = { participantId: targetId, tokenStatus: 'REVOKED' };
      break;
    }

    case 'SUSPEND_SCHOOL': {
      await changeSchoolStatus(targetId, 'SUSPENDED', reason.trim(), actor);
      resultDetails = { schoolId: targetId, status: 'SUSPENDED' };
      break;
    }

    case 'BROADCAST_EMERGENCY_ALERT': {
      const msg = payload.broadcastMessage || reason;
      // Insert into broadcast_announcements if table exists or update system_settings
      await queryPostgres(
        `INSERT INTO system_settings (key, value_json, description, updated_at)
         VALUES ('emergency_broadcast', $1::jsonb, 'Pesan Siaran Darurat Platform', NOW())
         ON CONFLICT (key) DO UPDATE SET
           value_json = EXCLUDED.value_json,
           updated_at = NOW();`,
        [JSON.stringify({ message: msg, active: true, timestamp: new Date().toISOString() })]
      );
      resultDetails = { message: msg, status: 'BROADCASTED' };
      break;
    }

    default:
      throw new Error(`Aksi darurat '${action}' tidak dikenal.`);
  }

  // Audit event with high severity
  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    action: `EMERGENCY_${action}`,
    resourceType: 'emergency_action',
    resourceId: targetId || 'global',
    severity: 'CRITICAL',
    details: {
      action,
      targetId,
      reason: reason.trim(),
      operator: actor.fullName,
      result: resultDetails,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return {
    success: true,
    action,
    targetId,
    details: resultDetails,
    message: `Aksi darurat ${action} berhasil dieksekusi.`,
  };
}
