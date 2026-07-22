import { createClient } from '@/lib/supabase/client';

export const authService = {
  async getSession() {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async getUser() {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  async getMemberProfile(userId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('members')
      .select('*, organization:organizations(*)')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }
};
