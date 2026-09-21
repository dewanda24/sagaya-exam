import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/core/tokens';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protected route prefixes
  const isSuperAdminPage = pathname.startsWith('/superadmin');
  const isAdminPage = pathname.startsWith('/admin');
  const isGuruPage = pathname.startsWith('/guru');
  const isPengawasPage = pathname.startsWith('/pengawas');
  const isAccountPage = pathname.startsWith('/account');

  // Protected API route prefixes
  const isApiSuperAdmin = pathname.startsWith('/api/superadmin');
  const isApiAdmin = pathname.startsWith('/api/admin');
  const isApiGuru = pathname.startsWith('/api/guru');
  const isApiProctor = pathname.startsWith('/api/proctor');
  const isApiAuthProtected =
    pathname.startsWith('/api/auth/sessions') ||
    pathname === '/api/auth/change-password';

  const isProtectedApi = isApiSuperAdmin || isApiAdmin || isApiGuru || isApiProctor || isApiAuthProtected;
  const isProtectedPage = isSuperAdminPage || isAdminPage || isGuruPage || isPengawasPage || isAccountPage;

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  // 1. CSRF Protection for state mutations on protected APIs
  if (isProtectedApi && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host.toLowerCase();
        if (originHost !== host.toLowerCase()) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: CSRF validation failed (Origin mismatch).' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Forbidden: CSRF validation failed (Invalid Origin header).' },
          { status: 403 }
        );
      }
    }
  }

  const token = req.cookies.get('sagaya_session')?.value;

  // 2. Check Token Existence
  if (!token) {
    if (isProtectedApi) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Sesi tidak ditemukan atau telah kedaluwarsa.' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Verify Session Token (Signature & Expiration)
  const user = await verifySessionToken(token);

  if (!user) {
    if (isProtectedApi) {
      const res = NextResponse.json(
        { success: false, error: 'Unauthorized: Sesi tidak valid atau telah berakhir.' },
        { status: 401 }
      );
      res.cookies.delete('sagaya_session');
      return res;
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('sagaya_session');
    return res;
  }

  // 4. Account pages & auth sessions are accessible by ANY authenticated staff user
  if (isAccountPage || isApiAuthProtected) {
    return NextResponse.next();
  }

  // 5. SUPER_ADMIN specific checks for /superadmin and /api/superadmin
  if (isSuperAdminPage || isApiSuperAdmin) {
    if (user.role !== 'SUPER_ADMIN') {
      if (isApiSuperAdmin) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Endpoint ini khusus Super Administrator (Dinas Pendidikan).' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // 6. SUPER_ADMIN has full access everywhere else
  if (user.role === 'SUPER_ADMIN') {
    return NextResponse.next();
  }

  // 7. Role authorization for API routes
  if (isProtectedApi) {
    if (isApiAdmin) {
      // Global context endpoints needed by SchoolSwitcher in AdminHeader for all logged-in roles
      const isGlobalContextApi =
        pathname === '/api/admin/active-school' ||
        pathname === '/api/admin/schools';

      if (isGlobalContextApi) {
        return NextResponse.next();
      }

      // Allow GURU for questions, scores, subjects, item-analysis, upload, and read-only classes & exams
      if (user.role === 'GURU') {
        const isGuruAllowedApi =
          pathname.startsWith('/api/admin/questions') ||
          pathname.startsWith('/api/admin/scores') ||
          pathname.startsWith('/api/admin/subjects') ||
          pathname.startsWith('/api/admin/item-analysis') ||
          pathname.startsWith('/api/admin/upload') ||
          (pathname.startsWith('/api/admin/classes') && req.method === 'GET') ||
          (pathname.startsWith('/api/admin/exams') && (req.method === 'GET' || req.method === 'POST'));

        if (!isGuruAllowedApi) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Guru tidak diizinkan mengakses endpoint admin ini.' },
            { status: 403 }
          );
        }
        return NextResponse.next();
      }

      // Allow PENGAWAS for print-cards
      if (user.role === 'PENGAWAS') {
        const isPengawasAllowedApi = pathname.startsWith('/api/admin/print-cards');
        if (!isPengawasAllowedApi) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Pengawas tidak diizinkan mengakses endpoint admin ini.' },
            { status: 403 }
          );
        }
        return NextResponse.next();
      }

      // Only ADMIN is allowed for general /api/admin
      if (user.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Hanya Administrator yang dapat mengakses resource ini.' },
          { status: 403 }
        );
      }
    }

    if (isApiGuru) {
      if (user.role !== 'ADMIN' && user.role !== 'GURU') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Hanya Guru dan Administrator yang dapat mengakses resource guru.' },
          { status: 403 }
        );
      }
    }

    if (isApiProctor) {
      if (user.role !== 'ADMIN' && user.role !== 'PENGAWAS') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Hanya Pengawas atau Admin yang dapat mengakses resource pengawas.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  }

  // 8. Role authorization for Frontend Pages
  // /admin routes
  if (isAdminPage && user.role !== 'ADMIN') {
    if (pathname.startsWith('/admin/berita-acara') && user.role === 'PENGAWAS') {
      return NextResponse.next();
    }
    if (user.role === 'GURU') {
      return NextResponse.redirect(new URL('/guru/dashboard', req.url));
    }
    if (user.role === 'PENGAWAS') {
      return NextResponse.redirect(new URL('/pengawas', req.url));
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'unauthorized_role');
    return NextResponse.redirect(loginUrl);
  }

  // /guru routes
  if (isGuruPage && user.role !== 'ADMIN' && user.role !== 'GURU') {
    if (user.role === 'PENGAWAS') {
      return NextResponse.redirect(new URL('/pengawas', req.url));
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'unauthorized_role');
    return NextResponse.redirect(loginUrl);
  }

  // /pengawas routes
  if (isPengawasPage && user.role !== 'ADMIN' && user.role !== 'PENGAWAS') {
    if (user.role === 'GURU') {
      return NextResponse.redirect(new URL('/guru/dashboard', req.url));
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'unauthorized_role');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/superadmin/:path*',
    '/admin/:path*',
    '/guru/:path*',
    '/pengawas/:path*',
    '/account/:path*',
    '/api/superadmin/:path*',
    '/api/admin/:path*',
    '/api/guru/:path*',
    '/api/proctor/:path*',
    '/api/auth/sessions/:path*',
    '/api/auth/change-password',
  ],
};
