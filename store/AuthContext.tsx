'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { authService } from '@/services/auth.service';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  memberProfile: any | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [memberProfile, setMemberProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchSession = async () => {
      try {
        const currentSession = await authService.getSession();
        setSession(currentSession);
        
        if (currentSession?.user) {
          setUser(currentSession.user);
          const profile = await authService.getMemberProfile(currentSession.user.id);
          setMemberProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          try {
             const profile = await authService.getMemberProfile(currentSession.user.id);
             setMemberProfile(profile);
          } catch(e) {}
        } else {
          setMemberProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, memberProfile, isLoading }}>
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
