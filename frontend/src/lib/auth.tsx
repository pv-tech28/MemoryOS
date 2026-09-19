'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import { saveGoogleTokens } from './api';

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

    const handleAuthStateChange = async (_event: string, session: any) => {
      console.log('[Auth] Auth state changed:', _event);
      if (session?.user) {
        setUser(session.user);
        setIsDemoUser(false);
      } else {
        const storedDemo = typeof window !== 'undefined' ? localStorage.getItem('evolve_demo_user') : null;
        if (!storedDemo) {
          setUser(null);
          setIsDemoUser(false);
        }
      }
      setLoading(false);

      // If we have a session with provider tokens, save them to our backend
      if (session?.provider_token && session?.provider_refresh_token) {
        try {
          console.log('[Auth] Saving Google provider tokens to backend');
          await saveGoogleTokens(
            session.provider_token,
            session.provider_refresh_token,
            session.user?.app_metadata?.provider_scopes || [
              'https://www.googleapis.com/auth/gmail.readonly',
              'https://www.googleapis.com/auth/drive.readonly',
              'https://www.googleapis.com/auth/calendar.readonly'
            ]
          );
          console.log('[Auth] Google provider tokens saved successfully');
        } catch (err) {
          console.error('[Auth] Failed to save Google provider tokens:', err);
        }
      }
    };

    // Check active session safely
    try {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        await handleAuthStateChange('', session);
      }).catch((err) => {
        console.warn('[Auth] Supabase getSession failed:', err);
        setLoading(false);
      });
    } catch (err) {
      console.warn('[Auth] Supabase getSession error:', err);
      setLoading(false);
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => subscription.unsubscribe();
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
    console.log("[Auth] Starting Google sign in...");
    console.log("[Auth] Redirect URL:", finalRedirectTo);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: finalRedirectTo,
          scopes: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly",
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
