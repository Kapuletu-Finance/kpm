'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLoginMutation } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const loginMutation = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await loginMutation.mutateAsync(data);
      toast.success('Login successful');
    } catch (error: any) {
      setIsSubmitting(false);
      // Our API returns 'requireVerification' mapped in the error object if we threw it,
      // but useLoginMutation just throws new Error(error.error).
      // We can check the error message string.
      if (error.message.includes('Email not confirmed')) {
        setShowVerificationModal(true);
      } else {
        toast.error(error.message || 'Failed to login');
      }
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Enter your credentials to access your workspace</p>
        </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            {...register('email')}
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            {...register('password')}
            className={errors.password ? 'border-destructive' : ''}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        Don't have an organization?{' '}
        <Link href="/signup" className="text-primary hover:underline">
          Create one now
        </Link>
      </div>
    </div>

      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailCheck className="h-6 w-6 text-primary" />
              Verify your email
            </DialogTitle>
            <DialogDescription className="pt-2">
              Your email address has not been verified yet. Please check your inbox and click the secure link to activate your account before logging in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowVerificationModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
