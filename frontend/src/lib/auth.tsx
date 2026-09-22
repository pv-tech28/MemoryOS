'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import { saveGoogleTokens, checkAuthStatus, getCookie, getMe } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemoUser: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInAsDemoUser: () => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
}

const DEMO_USER: User = {
  id: 'demo-user-id',
  app_metadata: { provider: 'demo' },
  user_metadata: {
    full_name: 'Demo User',
    username: 'demouser',
  },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'demo@evolve.ai',
} as User;

function backendUserToSupabaseUser(me: import('./api').BackendMeResponse): User {
  return {
    id: me.id,
    app_metadata: { provider: 'backend_google' },
    user_metadata: {
      full_name: me.full_name || '',
      username: me.username || '',
      avatar_url: me.avatar_url || '',
    },
    aud: 'authenticated',
    created_at: me.created_at || new Date().toISOString(),
    email: me.email || undefined,
  } as User;
}

function clearBackendAuthCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'evolve_auth_token=; path=/; max-age=0; SameSite=Lax';
  }
}

function setDemoSessionCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'evolve_demo_session=true; path=/; max-age=604800; SameSite=Lax';
  }
}

function clearDemoSessionCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'evolve_demo_session=; path=/; max-age=0; SameSite=Lax';
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoUser, setIsDemoUser] = useState(false);

  useEffect(() => {
    // Check if demo user is already stored locally
    if (typeof window !== 'undefined') {
      const storedDemo = localStorage.getItem('evolve_demo_user');
      if (storedDemo) {
        try {
          const parsed = JSON.parse(storedDemo);
          setUser(parsed);
          setIsDemoUser(true);
          setDemoSessionCookie();
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem('evolve_demo_user');
        }
      }
    }

    const hydrateBackendCookieUser = async (): Promise<boolean> => {
      if (typeof window === 'undefined') return false;
      const token = getCookie('evolve_auth_token');
      if (!token || token === 'null' || token === 'undefined') return false;
      try {
        const me = await getMe();
        if (me) {
          console.log('[Auth] Hydrated user from backend JWT cookie:', me.email);
          setUser(backendUserToSupabaseUser(me));
          setIsDemoUser(false);
          return true;
        }
      } catch (err) {
        console.warn('[Auth] Failed to hydrate backend cookie user:', err);
        clearBackendAuthCookie();
      }
      return false;
    };

    const SAVE_GOOGLE_TOKENS_MAX_ATTEMPTS = 100; // 5s at 50ms intervals

    const attemptSaveGoogleTokens = async (
      provider_token: string,
      provider_refresh_token: string,
      provider_scopes?: string[],
    ): Promise<boolean> => {
      try {
        await saveGoogleTokens(
          provider_token,
          provider_refresh_token,
          provider_scopes || [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/calendar.readonly'
          ]
        );
        console.log('[Auth] Google provider tokens saved successfully');
        return true;
      } catch (err) {
        console.warn('[Auth] Failed attempt to save Google provider tokens:', err);
        return false;
      }
    };

    const captureAndSaveGoogleTokensFromSession = async (session: any) => {
      const provider_token = session?.provider_token;
      const provider_refresh_token = session?.provider_refresh_token || "";
      const scopes = session?.user?.app_metadata?.provider_scopes;
      if (!provider_token) return false;
      return await attemptSaveGoogleTokens(provider_token, provider_refresh_token, scopes);
    };

    // Aggressive polling loop: immediately re-reads the session up to N times,
    // because Supabase briefly exposes provider/refresh tokens right after PKCE
    // hydration before clearing them out. If we hit them in that window, we save.
    const startGoogleTokenPoll = async () => {
      for (let i = 0; i < SAVE_GOOGLE_TOKENS_MAX_ATTEMPTS; i++) {
        try {
          const { data } = await supabase.auth.getSession();
          const session = data.session;
          const provider = session?.user?.app_metadata?.provider;
          if (provider === 'google' && session?.provider_token) {
            const saved = await captureAndSaveGoogleTokensFromSession(session);
            if (saved) return;
          }
        } catch (err) {
          // ignore transient errors, keep polling
        }
        await new Promise((res) => setTimeout(res, 50));
      }
      // Polling timed out. Now check if backend already has credentials by some other path.
      try {
        const status = await checkAuthStatus();
        if (status?.has_google) {
          console.log('[Auth] Tokens were not visible in session but backend already has them (OK)');
        } else {
          console.warn('[Auth] Google user in Supabase but provider tokens were never visible in session. Backend may need reconnect prompt.');
        }
      } catch (_) { /* noop */ }
    };

    let tokenPollStarted = false;
    const ensureGoogleTokenPollStarted = () => {
      if (tokenPollStarted) return;
      tokenPollStarted = true;
      startGoogleTokenPoll();
    };

    const handleAuthStateChange = async (_event: string, session: any) => {
      console.log('[Auth] Auth state changed:', _event);
      if (session?.user) {
        setUser(session.user);
        setIsDemoUser(false);
      } else {
        // Try backend JWT cookie as fallback before clearing
        const hydrated = await hydrateBackendCookieUser();
        if (!hydrated) {
          const storedDemo = typeof window !== 'undefined' ? localStorage.getItem('evolve_demo_user') : null;
          if (!storedDemo) {
            setUser(null);
            setIsDemoUser(false);
          }
        }
      }
      setLoading(false);

      // Critical: Save Google provider tokens IMMEDIATELY from the session param.
      // Supabase's PKCE flow exposes them only very briefly in the callback parameter
      // before asynchronously clearing them from getSession() results.
      const provider = session?.user?.app_metadata?.provider;
      if (provider === 'google') {
        const synced = await captureAndSaveGoogleTokensFromSession(session);
        if (!synced) {
          // Tokens were already gone by the time this handler ran — launch the
          // aggressive 50ms polling loop to catch the next brief window.
          ensureGoogleTokenPollStarted();
        }
      }
    };

    // Check URL for google_connected param to trigger a user re-hydrate after backend OAuth redirect
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('google_connected') === '1') {
        // Delay slightly to let the cookie settle, then hydrate
        setTimeout(async () => {
          const hydrated = await hydrateBackendCookieUser();
          if (hydrated) setLoading(false);
        }, 300);
      }
    }

    // First try backend JWT cookie for a known user
    hydrateBackendCookieUser().then((hydrated) => {
      if (hydrated) {
        setLoading(false);
        return;
      }

      // Check active Supabase session safely
      try {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          await handleAuthStateChange('', session);
          // If we loaded an existing Google user, also start aggressive polling
          // to catch any short-lived provider tokens from a recent redirect.
          if (session?.user?.app_metadata?.provider === 'google') {
            ensureGoogleTokenPollStarted();
          }
        }).catch((err) => {
          console.warn('[Auth] Supabase getSession failed:', err);
          setLoading(false);
        });
      } catch (err) {
        console.warn('[Auth] Supabase getSession error:', err);
        setLoading(false);
      }
    });

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const result = supabase.auth.onAuthStateChange(handleAuthStateChange);
      subscription = result.data.subscription;
    } catch (err) {
      console.warn('[Auth] Supabase onAuthStateChange unavailable:', err);
    }

    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'AuthRetryableFetchError') {
        throw new Error('AUTH_SERVER_UNREACHABLE');
      }
      throw err;
    }
  };

  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, username },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'AuthRetryableFetchError') {
        throw new Error('AUTH_SERVER_UNREACHABLE');
      }
      throw err;
    }
  };

  const signInAsDemoUser = async () => {
    setUser(DEMO_USER);
    setIsDemoUser(true);
    setDemoSessionCookie();
    if (typeof window !== 'undefined') {
      localStorage.setItem('evolve_demo_user', JSON.stringify(DEMO_USER));
    }
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    const finalRedirectTo = redirectTo || `${window.location.origin}/dashboard`;
    console.log("[Auth] Starting Google sign in via Supabase OAuth (PKCE)...");
    console.log("[Auth] Redirect URL:", finalRedirectTo);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: finalRedirectTo,
          scopes: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/calendar.readonly",
          ].join(" "),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          skipBrowserRedirect: false,
        },
      });
      if (error) {
        console.error("[Auth] Google sign in error:", error);
        throw error;
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'AuthRetryableFetchError') {
        throw new Error('AUTH_SERVER_UNREACHABLE');
      }
      throw err;
    }
  };

  const signOut = async () => {
    clearDemoSessionCookie();
    clearBackendAuthCookie();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('evolve_demo_user');
    }
    setUser(null);
    setIsDemoUser(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] Supabase signOut error:', err);
    }
  };

  const resetPasswordForEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'AuthRetryableFetchError') {
        throw new Error('AUTH_SERVER_UNREACHABLE');
      }
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoUser,
        signInWithPassword,
        signUp,
        signInWithGoogle,
        signInAsDemoUser,
        signOut,
        logout: signOut,
        resetPasswordForEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
