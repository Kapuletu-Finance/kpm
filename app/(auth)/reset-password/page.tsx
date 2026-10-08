'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useResetPasswordMutation } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const resetMutation = useResetPasswordMutation();
  const [isDone, setIsDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    try {
      await resetMutation.mutateAsync({ token, password: data.password });
      setIsDone(true);
      toast.success('Password updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col space-y-4 text-center lg:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Reset link required</h1>
        <p className="text-sm text-muted-foreground">Open the link from your password reset email, or request a new one.</p>
        <Link href="/forgot-password" className="text-primary hover:underline text-sm font-medium">Request a reset link</Link>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="flex flex-col space-y-4 text-center lg:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Password updated</h1>
        <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
        <Link href="/login" className="text-primary hover:underline text-sm font-medium">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center lg:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Enter a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
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

        <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
          {resetMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Password...
            </>
          ) : (
            'Update Password'
          )}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
