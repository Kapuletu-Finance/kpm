'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

export function useLoginMutation() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (credentials: any) => {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to login');
      }

      return response.json();
    },
    onSuccess: () => {
      router.push('/workspace');
    },
  });
}

export function useSignupMutation() {
  return useMutation({
    mutationFn: async (userData: any) => {
      const response = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign up');
      }

      return response.json();
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      return response.json();
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send recovery email');
      }

      return response.json();
    },
  });
}
