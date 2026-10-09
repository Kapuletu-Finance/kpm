'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type AuthUser = { id: string; email?: string | null; name?: string | null };

type AuthContextType = {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  memberProfile: any | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberProfile, setMemberProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/v1/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (res.ok) return res.json();
        // The cookie is still present but the server rejected it (password changed elsewhere,
        // account deactivated). Clear it, or the proxy keeps treating the browser as signed in.
        const body = await res.json().catch(() => ({}));
        if (!cancelled && (body.reason === 'revoked' || body.reason === 'deactivated')) {
          await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
          window.location.href = body.reason === 'deactivated' ? '/login?error=Account+deactivated' : '/login';
        }
        return { user: null, memberProfile: null };
      })
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setMemberProfile(data.memberProfile);
      })
      .catch((error) => console.error('Error fetching session:', error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session: user ? { user } : null, memberProfile, isLoading }}>
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
