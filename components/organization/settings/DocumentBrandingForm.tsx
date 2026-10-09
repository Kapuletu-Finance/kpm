'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, FileText, ImageUp, Loader2, Save, Trash2 } from 'lucide-react';
import {
  useDocumentBranding, useRemoveBrandingLogo, useSaveDocumentBranding, useUploadBrandingLogo, type DocumentBrandingSettings,
} from '@/hooks/useBranding';
import { documentUrl } from '@/components/documents/DownloadDocumentButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const TEMPLATES: { id: DocumentBrandingSettings['template']; name: string; description: string }[] = [
  { id: 'classic', name: 'Classic', description: 'Logo left, details right, a brand-color rule' },
  { id: 'modern', name: 'Modern', description: 'A full-width band in your brand color' },
  { id: 'minimal', name: 'Minimal', description: 'Small logo, hairline rule, color only in headings' },
];

/** A thumbnail sketch of each letterhead template. */
function TemplateSketch({ id, color }: { id: string; color: string }) {
  return (
    <div className="h-20 w-full rounded border bg-white p-2 flex flex-col gap-1.5" aria-hidden>
      {id === 'modern' ? (
        <div className="h-5 -mx-2 -mt-2 rounded-t flex items-center justify-between px-2" style={{ background: color }}>
          <div className="h-2.5 w-6 rounded-sm bg-white" />
          <div className="h-1 w-8 rounded bg-white/80" />
        </div>
      ) : (
        <div className="flex items-center justify-between pb-1" style={{ borderBottom: id === 'classic' ? `2px solid ${color}` : '1px solid #e5e7eb' }}>
          <div className={`rounded-sm bg-gray-300 ${id === 'minimal' ? 'h-2 w-5' : 'h-3 w-7'}`} />
          <div className="h-1 w-8 rounded bg-gray-200" />
        </div>
      )}
      <div className="h-1.5 w-12 rounded" style={{ background: id === 'minimal' ? '#374151' : color }} />
      <div className="h-1 w-full rounded bg-gray-100" />
      <div className="h-1 w-4/5 rounded bg-gray-100" />
    </div>
  );
}

export function DocumentBrandingForm() {
  const { data, isLoading, error } = useDocumentBranding();
  if (isLoading) return <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />;
  if (error || !data) return <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{(error as Error)?.message}</div>;
  // Re-mount when saved values change so the form starts from them
  return <BrandingEditor key={data.branding.updated_at ?? 'new'} saved={data.branding} organizationName={data.organization_name} />;
}

function BrandingEditor({ saved, organizationName }: { saved: DocumentBrandingSettings; organizationName: string }) {
  const save = useSaveDocumentBranding();
  const upload = useUploadBrandingLogo();
  const removeLogo = useRemoveBrandingLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(saved);

  const set = <K extends keyof DocumentBrandingSettings>(key: K, value: DocumentBrandingSettings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key: keyof DocumentBrandingSettings) => ({
    value: (form[key] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
  });
  const dirty = JSON.stringify({ ...form, logo_url: null, updated_at: null }) !== JSON.stringify({ ...saved, logo_url: null, updated_at: null });

  const handleSave = async () => {
    try {
      // The logo is managed by upload, and updated_at by the server
      const payload = Object.fromEntries(Object.entries(form).filter(([k]) => k !== 'logo_url' && k !== 'updated_at'));
      await save.mutateAsync(payload as Omit<DocumentBrandingSettings, 'logo_url' | 'updated_at'>);
      toast.success(form.enabled ? 'Document branding saved' : 'Documents will use the KPM letterhead');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return toast.error('Upload a PNG or JPEG image');
    if (file.size > 2 * 1024 * 1024) return toast.error('Logos must be 2 MB or smaller');
    try {
      await upload.mutateAsync(file);
      toast.success('Logo uploaded');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const name = form.display_name?.trim() || organizationName;
  const contacts = [form.contact_email, form.contact_phone, form.website].filter((v) => v?.trim()).join('  ·  ');

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Official documents</CardTitle>
        <CardDescription>
          Reports, minutes and release notes are issued as PDFs. By default they carry the KPM · Kapuletu Systems letterhead;
          turn on your own branding to issue them under your organization&apos;s name, logo and contact details.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="branding-enabled" className="text-base">Use my organization&apos;s branding</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {form.enabled ? `Documents are issued as ${name}.` : 'Documents use the default KPM letterhead.'}
            </p>
          </div>
          <Switch id="branding-enabled" checked={form.enabled} onCheckedChange={(v: boolean) => set('enabled', v)} />
        </div>

        <fieldset disabled={!form.enabled} className="space-y-8 disabled:opacity-60">
          {/* Identity */}
          <section className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-40 rounded-md border bg-white flex items-center justify-center overflow-hidden">
                  {saved.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL of the uploaded logo
                    <img src={saved.logo_url} alt={`${name} logo`} className="max-h-14 max-w-36 object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0])} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                    {upload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageUp className="w-4 h-4 mr-2" />}
                    {saved.logo_url ? 'Replace' : 'Upload'}
                  </Button>
                  {saved.logo_url && (
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => removeLogo.mutate()} disabled={removeLogo.isPending}>
                      <Trash2 className="w-4 h-4 mr-2" /> Remove
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PNG or JPEG, up to 2 MB. A wide logo on a transparent background prints best.</p>
            </div>

            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="b-name">Name on documents</Label>
                <Input id="b-name" placeholder={organizationName} maxLength={120} {...text('display_name')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-tagline">Tagline</Label>
                <Input id="b-tagline" placeholder="e.g. Engineering excellence since 2012" maxLength={160} {...text('tagline')} />
              </div>
            </div>
          </section>

          {/* Contacts */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-email">Contact email</Label>
              <Input id="b-email" type="email" placeholder="info@yourcompany.com" {...text('contact_email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-phone">Phone</Label>
              <Input id="b-phone" placeholder="+254 7xx xxx xxx" maxLength={40} {...text('contact_phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-web">Website</Label>
              <Input id="b-web" type="url" placeholder="https://yourcompany.com" {...text('website')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-reg">Registration / tax number</Label>
              <Input id="b-reg" placeholder="e.g. PVT-XXXX or KRA PIN" maxLength={60} {...text('registration_number')} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="b-address">Address</Label>
              <Input id="b-address" placeholder="Building, street, city, country" maxLength={300} {...text('address')} />
            </div>
          </section>

          {/* Look */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="b-color">Brand color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="b-color"
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => set('primary_color', e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border bg-background"
                  />
                  <Input
                    aria-label="Brand color hex value"
                    value={form.primary_color}
                    onChange={(e) => set('primary_color', e.target.value)}
                    className="w-28 font-mono"
                    maxLength={7}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for headings and rules; pick a darker shade so text stays readable.</p>
              </div>
            </div>

            <div role="radiogroup" aria-label="Letterhead template" className="grid gap-3 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={form.template === t.id}
                  onClick={() => set('template', t.id)}
                  className={`text-left rounded-lg border p-3 space-y-2 transition-colors ${form.template === t.id ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/50'}`}
                >
                  <TemplateSketch id={t.id} color={form.primary_color} />
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Footer */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-conf">Confidentiality notice</Label>
              <Textarea id="b-conf" rows={2} maxLength={400} placeholder="Confidential. Prepared for internal use by the organization named in this document." {...text('confidentiality_notice')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-footer">Footer line</Label>
              <Textarea id="b-footer" rows={2} maxLength={300} placeholder="e.g. Acme Ltd · Registered in Kenya · VAT No. 0000" {...text('footer_text')} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3 md:col-span-2">
              <div>
                <Label htmlFor="b-attr">Show &ldquo;Generated with KPM · Kapuletu Systems&rdquo;</Label>
                <p className="text-xs text-muted-foreground">A small line in the footer of each page.</p>
              </div>
              <Switch id="b-attr" checked={form.show_kpm_attribution} onCheckedChange={(v: boolean) => set('show_kpm_attribution', v)} />
            </div>
          </section>
        </fieldset>

        {/* Approximate on-screen preview of the letterhead */}
        {form.enabled && (
          <section className="space-y-2">
            <Label>Preview</Label>
            <div className="rounded-lg border bg-white text-gray-800 p-6 shadow-sm overflow-hidden">
              <div
                className={`flex items-center justify-between gap-4 ${form.template === 'modern' ? '-mx-6 -mt-6 px-6 py-4 mb-4 text-white' : 'pb-3 mb-4'}`}
                style={form.template === 'modern' ? { background: form.primary_color } : { borderBottom: form.template === 'classic' ? `2px solid ${form.primary_color}` : '1px solid #e5e7eb' }}
              >
                <div className={form.template === 'modern' && saved.logo_url ? 'bg-white rounded p-1' : ''}>
                  {saved.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL of the uploaded logo
                    <img src={saved.logo_url} alt="" className={form.template === 'minimal' ? 'h-7' : 'h-10'} />
                  ) : (
                    <span className="font-bold text-lg" style={{ color: form.template === 'modern' ? '#fff' : form.primary_color }}>{name}</span>
                  )}
                </div>
                <div className={`text-right text-[11px] leading-snug ${form.template === 'modern' ? 'text-white' : 'text-gray-500'}`}>
                  {saved.logo_url && <div className={`font-semibold text-xs ${form.template === 'modern' ? '' : 'text-gray-800'}`}>{name}</div>}
                  {form.tagline && <div>{form.tagline}</div>}
                  {form.address && <div>{form.address}</div>}
                  {contacts && <div>{contacts}</div>}
                  {form.registration_number && <div>Reg. {form.registration_number}</div>}
                </div>
              </div>
              <div className="text-xl font-bold" style={{ color: form.template === 'minimal' ? '#1f2937' : form.primary_color }}>Project Status Report</div>
              <div className="text-sm text-gray-500">Sample project</div>
              <div className="mt-6 pt-2 border-t text-[10px] text-gray-500 flex justify-between">
                <div>
                  <div>{form.confidentiality_notice || 'Confidential. Prepared for internal use by the organization named in this document.'}</div>
                  {form.footer_text && <div>{form.footer_text}</div>}
                  {form.show_kpm_attribution && <div className="text-[#097255]">Generated with KPM · Kapuletu Systems</div>}
                </div>
                <div>Page 1 of 1</div>
              </div>
            </div>
          </section>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap justify-between gap-3 border-t border-border pt-6">
        <a
          href={documentUrl('branding-preview', {}, true)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="w-4 h-4" /> Open a sample PDF{dirty ? ' (save first to see changes)' : ''}
        </a>
        <Button onClick={handleSave} disabled={!dirty || save.isPending}>
          {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save branding
        </Button>
      </CardFooter>
    </Card>
  );
}
