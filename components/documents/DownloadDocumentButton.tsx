'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export type DocumentType =
  | 'project-status'
  | 'portfolio'
  | 'team-performance'
  | 'sprint-report'
  | 'meeting-minutes'
  | 'standup-digest'
  | 'member-report'
  | 'release-notes'
  | 'branding-preview';

/** The URL that issues an official PDF. */
export function documentUrl(type: DocumentType, params: Record<string, string | undefined | null> = {}, inline = false) {
  const query = new URLSearchParams(
    Object.entries({ ...params, inline: inline ? '1' : undefined }).filter(([, v]) => v) as [string, string][],
  ).toString();
  return `/api/v1/documents/${type}${query ? `?${query}` : ''}`;
}

/** File name from Content-Disposition (prefers the UTF-8 form). */
function filenameFrom(header: string | null, fallback: string) {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain?.[1] ?? fallback;
}

/**
 * Issues and downloads an official PDF on the organization's letterhead.
 * Fetches first so permission or validation errors show as a message instead of a broken download.
 */
export function DownloadDocumentButton({
  type,
  params,
  label,
  variant = 'outline',
  size = 'sm',
  className,
}: {
  type: DocumentType;
  params?: Record<string, string | undefined | null>;
  label: string;
  variant?: 'outline' | 'default' | 'secondary' | 'ghost';
  size?: 'sm' | 'default';
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(documentUrl(type, params));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not generate the document');
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filenameFrom(res.headers.get('Content-Disposition'), `${type}.pdf`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      const reference = res.headers.get('X-Document-Reference');
      toast.success(reference ? `Document issued · ${reference}` : 'Document downloaded');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={download} disabled={busy} className={className}>
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
}
