import { cookies } from 'next/headers';
import { SessionUser } from './auth';

export interface TenantContext {
  schoolId: string | null; // null means all schools (SUPER_ADMIN view)
  isSuperAdmin: boolean;
}

export async function getTenantContext(user: SessionUser | null, searchParams?: URLSearchParams): Promise<TenantContext> {
  if (!user) {
    return { schoolId: null, isSuperAdmin: false };
  }

  if (user.role !== 'SUPER_ADMIN') {
    return {
      schoolId: user.schoolId || null,
      isSuperAdmin: false,
    };
  }

  // Super Admin can switch via searchParams, or cookie
  const querySchoolId = searchParams?.get('schoolId');
  if (querySchoolId && querySchoolId !== 'ALL') {
    return { schoolId: querySchoolId, isSuperAdmin: true };
  }

  const cookieStore = await cookies();
  const activeCookie = cookieStore.get('sagaya_active_school_id')?.value;

  if (activeCookie && activeCookie !== 'ALL') {
    return { schoolId: activeCookie, isSuperAdmin: true };
  }

  return { schoolId: null, isSuperAdmin: true };
}
