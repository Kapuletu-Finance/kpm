import type { ReactNode } from 'react';
import { Document, Image, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { KPM_COLORS, type DocumentBranding } from './branding.server';
import { KPM_MARK_GREEN, KPM_MARK_ORANGE, KPM_MARK_VIEWBOX } from './kpm-logo-paths';

// Building blocks for KPM's official PDF documents: a letterhead in three templates,
// a running header and footer on every page, and layout primitives for the body.

const INK = '#1f2937';
const MUTED = '#6b7280';
const RULE = '#e5e7eb';
const TINT = '#f6f7f8';

export type DocumentMeta = {
  /** e.g. "Project Status Report" */
  title: string;
  /** e.g. the project name and period */
  subtitle?: string;
  reference: string;
  /** The organization the document is about / issued by */
  organizationName: string;
  generatedAt: Date;
  generatedBy: string;
  /** Extra key/value lines in the title block (period, project, sprint, ...) */
  details?: [string, string][];
};

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9.5, color: INK },
  running: { fontSize: 7.5, color: MUTED, marginBottom: 10, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MUTED },
  footerLeft: { maxWidth: '75%' },
  h1: { fontFamily: 'Helvetica-Bold', fontSize: 17, marginBottom: 2 },
  subtitle: { fontSize: 10.5, color: MUTED },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1 },
  small: { fontSize: 8, color: MUTED },
  bold: { fontFamily: 'Helvetica-Bold' },
});

// ---------------------------------------------------------------------------
// The KPM logo, drawn as vectors from public/logos/kpm/kpm-primary.svg
// ---------------------------------------------------------------------------

export function KpmLogo({ height = 34, light = false }: { height?: number; light?: boolean }) {
  const markWidth = (height * 835) / 1185;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg viewBox={KPM_MARK_VIEWBOX} style={{ width: markWidth, height }}>
        {KPM_MARK_GREEN.map((d, i) => <Path key={i} d={d} fill={light ? '#ffffff' : KPM_COLORS.green} />)}
        {KPM_MARK_ORANGE.map((d, i) => <Path key={i} d={d} fill={KPM_COLORS.orange} />)}
      </Svg>
      <View style={{ marginLeft: height * 0.22 }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: height * 0.52, color: light ? '#ffffff' : KPM_COLORS.navy, lineHeight: 1 }}>KPM</Text>
        <Text style={{ fontSize: height * 0.2, color: light ? '#ffffff' : KPM_COLORS.navy, opacity: 0.85, marginTop: 1 }}>by Kapuletu Systems</Text>
      </View>
    </View>
  );
}

function BrandLogo({ branding, height, light }: { branding: DocumentBranding; height: number; light?: boolean }) {
  if (branding.logo?.kind === 'kpm') return <KpmLogo height={height} light={light} />;
  if (branding.logo?.kind === 'image') {
    // react-pdf's Image is a PDF drawing, not an HTML <img>; it has no alt attribute
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image src={{ data: branding.logo.data, format: branding.logo.format }} style={{ height, maxWidth: 170, objectFit: 'contain' }} />;
  }
  // No usable logo: the organization's name set as a wordmark
  return <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: height * 0.5, color: light ? '#ffffff' : branding.primaryColor }}>{branding.name}</Text>;
}

/** Name, tagline and contact block shown beside the logo. */
function IssuerBlock({ branding, align = 'right', light = false }: { branding: DocumentBranding; align?: 'left' | 'right'; light?: boolean }) {
  const color = light ? '#ffffff' : MUTED;
  const showName = branding.source === 'organization' && branding.logo?.kind === 'image';
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start', maxWidth: 240 }}>
      {showName && <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: light ? '#ffffff' : INK }}>{branding.name}</Text>}
      {branding.tagline && <Text style={{ fontSize: 8, color, textAlign: align }}>{branding.tagline}</Text>}
      {branding.address && <Text style={{ fontSize: 7.5, color, textAlign: align }}>{branding.address}</Text>}
      {branding.contactLines.length > 0 && <Text style={{ fontSize: 7.5, color, textAlign: align }}>{branding.contactLines.join('  ·  ')}</Text>}
      {branding.registrationNumber && <Text style={{ fontSize: 7.5, color, textAlign: align }}>Reg. {branding.registrationNumber}</Text>}
    </View>
  );
}

/** First-page letterhead, in the organization's chosen template. */
function Letterhead({ branding }: { branding: DocumentBranding }) {
  if (branding.template === 'modern') {
    return (
      <View style={{ backgroundColor: branding.primaryColor, marginHorizontal: -40, marginTop: -36, paddingHorizontal: 40, paddingVertical: 18, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {branding.logo?.kind === 'image' ? (
          // Photos/logos sit on a white tile so they keep their own colors
          <View style={{ backgroundColor: '#ffffff', padding: 5, borderRadius: 3 }}>
            <BrandLogo branding={branding} height={30} />
          </View>
        ) : (
          <BrandLogo branding={branding} height={34} light />
        )}
        <IssuerBlock branding={branding} light />
      </View>
    );
  }
  if (branding.template === 'minimal') {
    return (
      <View style={{ marginBottom: 18, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: RULE, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <BrandLogo branding={branding} height={24} />
        <IssuerBlock branding={branding} />
      </View>
    );
  }
  // classic
  return (
    <View style={{ marginBottom: 18, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: branding.primaryColor, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <BrandLogo branding={branding} height={38} />
      <IssuerBlock branding={branding} />
    </View>
  );
}

/** A complete official document: letterhead, title block, body, and a running footer. */
export function OfficialDocument({ branding, meta, children }: { branding: DocumentBranding; meta: DocumentMeta; children: ReactNode }) {
  const issuedOn = meta.generatedAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  const issuer = branding.source === 'organization' ? branding.name : 'KPM';

  return (
    <Document
      title={`${meta.title}${meta.subtitle ? ` - ${meta.subtitle}` : ''}`}
      author={meta.organizationName}
      creator="KPM - Kapuletu Systems"
      producer="KPM - Kapuletu Systems"
      subject={meta.reference}
    >
      <Page size="A4" style={s.page}>
        {/* Running header from page 2 on */}
        <Text style={s.running} fixed render={({ pageNumber }) => (pageNumber > 1 ? `${issuer}  ·  ${meta.title}  ·  ${meta.reference}` : '')} />

        <Letterhead branding={branding} />

        {/* Title block */}
        <View style={{ marginBottom: 16 }}>
          <Text style={[s.h1, { color: branding.template === 'minimal' ? INK : branding.primaryColor }]}>{meta.title}</Text>
          {meta.subtitle && <Text style={s.subtitle}>{meta.subtitle}</Text>}
          <View style={{ marginTop: 10, padding: 8, backgroundColor: TINT, borderRadius: 3, flexDirection: 'row', flexWrap: 'wrap' }}>
            {[
              ['Organization', meta.organizationName] as [string, string],
              ...(meta.details ?? []),
              ['Reference', meta.reference] as [string, string],
              ['Issued', issuedOn] as [string, string],
              ['Prepared by', meta.generatedBy] as [string, string],
            ].map(([k, v]) => (
              <View key={k} style={{ width: '50%', flexDirection: 'row', marginVertical: 1.5 }}>
                <Text style={{ width: 70, fontSize: 8, color: MUTED }}>{k}</Text>
                <Text style={{ flex: 1, fontSize: 8.5 }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {children}

        {/* Footer on every page */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            <Text>{branding.confidentialityNotice}</Text>
            {branding.footerText && <Text>{branding.footerText}</Text>}
            {(branding.source === 'kpm' || branding.showAttribution) && (
              <Text style={{ color: KPM_COLORS.green }}>Generated with KPM · Kapuletu Systems</Text>
            )}
          </View>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Body primitives
// ---------------------------------------------------------------------------

export function Section({ title, color, children, breakBefore }: { title: string; color: string; children: ReactNode; breakBefore?: boolean }) {
  return (
    <View style={{ marginBottom: 14 }} break={breakBefore}>
      {/* Keep a heading with the start of its content */}
      <Text style={[s.sectionTitle, { color, borderBottomColor: color }]} minPresenceAhead={90}>{title}</Text>
      {children}
    </View>
  );
}

export function Paragraph({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={{ marginBottom: 4, color: muted ? MUTED : INK }}>{children}</Text>;
}

/** Labeled values in two columns. */
export function KeyValues({ items }: { items: [string, string | number | null | undefined][] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map(([k, v]) => (
        <View key={k} style={{ width: '50%', flexDirection: 'row', marginBottom: 3, paddingRight: 8 }} wrap={false}>
          <Text style={{ width: 95, color: MUTED, fontSize: 8.5 }}>{k}</Text>
          <Text style={{ flex: 1 }}>{v === null || v === undefined || v === '' ? '—' : String(v)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Headline numbers in boxes. */
export function StatGrid({ stats, color }: { stats: { label: string; value: string | number; note?: string }[]; color: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
      {stats.map((st) => (
        <View key={st.label} style={{ width: '25%', padding: 3 }} wrap={false}>
          <View style={{ borderWidth: 0.5, borderColor: RULE, borderTopWidth: 2, borderTopColor: color, padding: 6, minHeight: 46 }}>
            <Text style={{ fontSize: 7.5, color: MUTED }}>{st.label}</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 15, marginTop: 1 }}>{String(st.value)}</Text>
            {st.note && <Text style={{ fontSize: 7, color: MUTED }}>{st.note}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

export type Column = { label: string; width: number; align?: 'left' | 'right' | 'center' };

/** A table whose header repeats on each page; rows never split across pages. */
export function DataTable({ columns, rows, color, empty = 'Nothing to show.' }: { columns: Column[]; rows: (string | number | null | undefined)[][]; color: string; empty?: string }) {
  if (rows.length === 0) return <Paragraph muted>{empty}</Paragraph>;
  const cell = (c: Column) => ({ width: `${c.width}%`, paddingHorizontal: 4, paddingVertical: 3, textAlign: c.align ?? 'left' }) as const;
  return (
    <View>
      <View style={{ flexDirection: 'row', backgroundColor: TINT, borderBottomWidth: 1, borderBottomColor: color }} fixed>
        {columns.map((c) => (
          <Text key={c.label} style={[cell(c), { fontFamily: 'Helvetica-Bold', fontSize: 8, color: INK }]}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: RULE }} wrap={false}>
          {columns.map((c, j) => (
            <Text key={c.label} style={[cell(c), { fontSize: 8.5 }]}>{r[j] === null || r[j] === undefined || r[j] === '' ? '—' : String(r[j])}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Lines of plain text (e.g. converted Markdown), keeping bullets and paragraphs. */
export function TextBlock({ text, empty = 'Not recorded.' }: { text: string; empty?: string }) {
  if (!text.trim()) return <Paragraph muted>{empty}</Paragraph>;
  return (
    <View>
      {text.split('\n').map((line, i) =>
        line.trim() === '' ? <View key={i} style={{ height: 4 }} /> : <Text key={i} style={{ marginBottom: 1.5 }}>{line}</Text>,
      )}
    </View>
  );
}

/** Signature lines for formal documents such as minutes. */
export function SignOff({ roles }: { roles: string[] }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 24 }} wrap={false}>
      {roles.map((r) => (
        <View key={r} style={{ flex: 1, marginRight: 16 }}>
          <View style={{ borderBottomWidth: 0.75, borderBottomColor: INK, height: 26 }} />
          <Text style={{ fontSize: 8, color: MUTED, marginTop: 3 }}>{r}</Text>
          <Text style={{ fontSize: 8, color: MUTED, marginTop: 8 }}>Date: ____________________</Text>
        </View>
      ))}
    </View>
  );
}

/** A small line chart for printed burndowns: remaining (solid) against ideal (dashed). */
export function PrintedBurndown({ data, color }: { data: { ideal: number; remaining: number | null }[]; color: string }) {
  if (data.length < 2) return <Paragraph muted>Not enough days to chart.</Paragraph>;
  const W = 500, H = 120, P = 6;
  const max = Math.max(1, ...data.map((d) => Math.max(d.ideal, d.remaining ?? 0)));
  const x = (i: number) => P + (i / (data.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const ideal = data.map((d, i) => `${x(i)},${y(d.ideal)}`).join(' ');
  const actual = data.map((d, i) => (d.remaining === null ? null : `${x(i)},${y(d.remaining)}`)).filter(Boolean).join(' ');
  return (
    <View>
      <Svg width={W} height={H}>
        <Path d={`M${P},${H - P} L${W - P},${H - P}`} stroke={RULE} strokeWidth={1} />
        <Path d={`M${ideal.replace(/ /g, ' L')}`} stroke="#9ca3af" strokeWidth={1.2} strokeDasharray="4,3" fill="none" />
        {actual && <Path d={`M${actual.replace(/ /g, ' L')}`} stroke={color} strokeWidth={2} fill="none" />}
      </Svg>
      <Text style={s.small}>Solid: features remaining. Dashed: even pace to zero. Peak {max}.</Text>
    </View>
  );
}

export { s as documentStyles };
