'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useResetPasswordMutation } from '@/hooks/useAuth';
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
  const resetMutation = useResetPasswordMutation();
  const router = useRouter();

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
      await resetMutation.mutateAsync({ password: data.password });
      toast.success('Account activated successfully');
      router.push('/workspace');
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
