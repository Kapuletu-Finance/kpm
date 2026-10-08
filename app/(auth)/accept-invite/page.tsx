'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>;

function AcceptInviteForm() {
  const token = useSearchParams().get('token') ?? '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(token ? null : 'This invitation link is missing its token.');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/auth/activate?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json();
        if (res.ok) setInvitedEmail(body.email);
        else setLinkError(body.error || 'This invitation link is invalid or has expired.');
      })
      .catch(() => setLinkError('Could not verify the invitation link.'));
  }, [token]);

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
      const res = await fetch('/api/v1/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to activate account');
      }

      toast.success('Account activated successfully');
      window.location.href = '/workspace';
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate account');
      setIsSubmitting(false);
    }
  };

  if (linkError) {
    return (
      <div className="flex flex-col space-y-4 text-center lg:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invitation unavailable</h1>
        <p className="text-sm text-muted-foreground">{linkError} Ask your organization admin to resend the invitation.</p>
        <Link href="/login" className="text-primary hover:underline text-sm font-medium">Return to login</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center lg:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Accept Invitation</h1>
        <p className="text-sm text-muted-foreground">
          Set your password to activate your account and join the workspace.
          {invitedEmail && <> Signing in as <span className="font-medium text-foreground">{invitedEmail}</span>.</>}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Create Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
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
            autoComplete="new-password"
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

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}>
      <AcceptInviteForm />
    </Suspense>
  );
}
