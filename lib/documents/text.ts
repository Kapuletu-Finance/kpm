// Plain-text helpers for printed documents. Content in KPM is often Markdown; PDFs show it
// as clean text with bullets kept.

/** Markdown to readable plain text: keeps line structure and list bullets, drops markup. */
export function mdToPlain(md: string | null | undefined): string {
  if (!md) return '';
  return md
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^(\s*)[-*+]\s+\[( |x|X)\]\s+/gm, (_, indent, done) => `${indent}${done.trim() ? '☑' : '☐'} `)
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A short, human-checkable reference for an issued document, e.g. KPM-PSR-20261009-7F3A. */
export function documentReference(prefix: string, issuer: 'KPM' | string = 'KPM'): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  // KPM's own documents keep the full brand; organizations use their initials (e.g. "Acme Ltd" -> AL)
  const code = issuer === 'KPM' ? 'KPM' : issuer
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 4)
    .toUpperCase() || 'KPM';
  return `${code}-${prefix}-${date}-${rand}`;
}

/** A filesystem-safe file name. */
export function safeFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 120);
}
