'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSignupMutation } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const signupSchema = z.object({
  organizationName: z.string().min(2, 'Organization name is required'),
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const signupMutation = useSignupMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true);
    try {
      await signupMutation.mutateAsync(data);
      setShowVerificationModal(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create your Workspace</h1>
          <p className="text-sm text-muted-foreground">Setup your organization and get started</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization Name</Label>
            <Input
              id="organizationName"
              placeholder="Acme Corp"
              {...register('organizationName')}
              className={errors.organizationName ? 'border-destructive' : ''}
            />
            {errors.organizationName && <p className="text-sm text-destructive">{errors.organizationName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              {...register('fullName')}
              className={errors.fullName ? 'border-destructive' : ''}
            />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@acme.com"
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
                Creating Organization...
              </>
            ) : (
              'Create Organization'
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
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
              We've sent a secure verification link to your inbox. Please click the link to activate your organization workspace before logging in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <Button onClick={() => window.location.href = '/login'}>
              Go to Login
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
