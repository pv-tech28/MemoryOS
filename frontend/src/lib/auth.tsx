'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import { saveGoogleTokens } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthStateChange = async (_event: string, session: any) => {
      console.log('[Auth] Auth state changed:', _event);
      setUser(session?.user ?? null);
      setLoading(false);

      // If we have a session with provider tokens, save them to our backend
      if (session?.provider_token && session?.provider_refresh_token) {
        try {
          console.log('[Auth] Saving Google provider tokens to backend');
          await saveGoogleTokens(
            session.provider_token,
            session.provider_refresh_token,
            // Extract scopes from session or use default
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

    // Check active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await handleAuthStateChange('', session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
      },
    });
    if (error) throw error;
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    const finalRedirectTo = redirectTo || `${window.location.origin}/dashboard`;
    console.log("[Auth] Starting Google sign in...");
    console.log("[Auth] Using provider:", "google");
    console.log("[Auth] Redirect URL:", finalRedirectTo);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: finalRedirectTo,
        scopes: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly",
      },
    });
    
    console.log("[Auth] signInWithOAuth response:", { data, error });
    
    if (error) {
      console.error("[Auth] Google sign in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithPassword,
        signUp,
        signInWithGoogle,
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
