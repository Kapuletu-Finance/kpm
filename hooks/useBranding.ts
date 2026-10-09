'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type DocumentBrandingSettings = {
  enabled: boolean;
  display_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  website: string | null;
  registration_number: string | null;
  primary_color: string;
  template: 'classic' | 'modern' | 'minimal';
  footer_text: string | null;
  confidentiality_notice: string | null;
  show_kpm_attribution: boolean;
  updated_at?: string;
};

const KEY = ['organization', 'branding'];

async function parse<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || fallback);
  }
  return res.json();
}

export function useDocumentBranding() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () =>
      parse<{ organization_name: string; branding: DocumentBrandingSettings }>(await fetch('/api/v1/organization/branding'), 'Failed to load branding'),
  });
}

export function useSaveDocumentBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<DocumentBrandingSettings, 'logo_url' | 'updated_at'>) =>
      parse<DocumentBrandingSettings>(
        await fetch('/api/v1/organization/branding', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        'Failed to save branding',
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUploadBrandingLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return parse<DocumentBrandingSettings>(await fetch('/api/v1/organization/branding/logo', { method: 'POST', body: form }), 'Failed to upload logo');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveBrandingLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => parse(await fetch('/api/v1/organization/branding/logo', { method: 'DELETE' }), 'Failed to remove logo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
