// Embeds the branded HTML email templates into a TS module so they ship with the
// server bundle (files under public/ are not readable from Vercel functions).
import { readFileSync, writeFileSync } from 'node:fs';

const names = { signup: 'signup_email_template', invite: 'invite_email_template', reset: 'reset_password_email_template' };
let out = '// Generated from public/docs/emails/*.html (the templates previously configured in Supabase).\n// Regenerate with: node scripts/build-email-templates.mjs\n\n';
for (const [key, file] of Object.entries(names)) {
  out += `export const ${key}Template = ${JSON.stringify(readFileSync(`public/docs/emails/${file}.html`, 'utf8'))};\n\n`;
}
writeFileSync('lib/email/templates.generated.ts', out);
console.log('Wrote lib/email/templates.generated.ts');
