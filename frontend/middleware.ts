import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(
    'https://jhzkjlfmiycpzczujzzu.supabase.co',
    'sb_publishable_UT66j0qs7YLBQL7LSxjhZQ_Uok2gg-B',
    { req, res }
  );

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;
  const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/reset-password'];

  if (!session && !publicPaths.includes(path)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (session && (path === '/' || path === '/login' || path === '/signup')) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
