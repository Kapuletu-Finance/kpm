'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>;

export default function AcceptInvitePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Manual Token Hydration:
    // Bypass Next.js/Supabase SSR race conditions by manually establishing the session
    const hash = window.location.hash;
    if (hash) {
      // The hash might start with #, we need to treat it like query params
      const paramsString = hash.startsWith('#') ? hash.substring(1) : hash;
      const params = new URLSearchParams(paramsString);
      
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      
      if (access_token && refresh_token) {
        const supabase = createClient();
        // Force the session into existence immediately
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (error) {
            console.error('Manual hydration error:', error);
          }
        });
      }
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
  });

  const onSubmit = async (data: AcceptInviteFormValues) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      
      // Update password directly on the client to ensure we use the session from the URL hash fragment
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password
      });

      if (updateError) throw updateError;
      
      // Update member status from 'Invited' to 'Active'
      const activateRes = await fetch('/api/v1/auth/activate', { method: 'POST' });
      if (!activateRes.ok) {
        throw new Error('Failed to activate member status');
      }
      
      toast.success('Account activated successfully');
      window.location.href = '/workspace';
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate account');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center lg:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Accept Invitation</h1>
        <p className="text-sm text-muted-foreground">Set your password to activate your account and join the workspace.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Create Password</Label>
          <Input
            id="password"
            type="password"
            {...register('password')}
            className={errors.password ? 'border-destructive' : ''}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword')}
            className={errors.confirmPassword ? 'border-destructive' : ''}
          />
          {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Activating Account...
            </>
          ) : (
            'Activate Account'
          )}
        </Button>
      </form>
    </div>
  );
}
