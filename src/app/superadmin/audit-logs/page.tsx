import { redirect } from 'next/navigation';

export default function SuperAdminAuditLogsRedirect() {
  redirect('/superadmin/audit');
}
