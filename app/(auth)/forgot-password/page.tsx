'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForgotPasswordMutation } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const forgotPasswordMutation = useForgotPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await forgotPasswordMutation.mutateAsync(data);
      setIsSuccess(true);
      toast.success('Recovery email sent');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send recovery email');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          We have sent a secure password recovery link to your email address.
        </p>
        <Link href="/login" className="text-primary hover:underline mt-4 text-sm font-medium">
          Return to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center lg:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Forgot Password</h1>
        <p className="text-sm text-muted-foreground">Enter your email address and we will send you a recovery link.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            {...register('email')}
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending link...
            </>
          ) : (
            'Send Recovery Link'
          )}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground pt-2">
        <Link href="/login" className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
