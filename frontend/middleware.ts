import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wzizsmdsyemhejupbacg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_2ZIEQZ5Oqi4_6YEDoVjfEg_ETtw6NKW';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;
  const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/reset-password'];

  // Check for active demo session cookie
  const demoCookie = req.cookies.get('evolve_demo_session');
  if (demoCookie?.value === 'true') {
    if (path === '/' || path === '/login' || path === '/signup') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return res;
  }

  let session = null;
  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Refresh session if expired - required for Server Components
    const { data } = await supabase.auth.getSession();
    session = data?.session;
  } catch (err) {
    // If Supabase host is unreachable or paused, do not crash middleware
    console.error('[Middleware] Supabase session check error:', err);
  }

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
