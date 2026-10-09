import * as postmark from 'postmark';
import { inviteTemplate, resetTemplate, signupTemplate } from '@/lib/email/templates.generated';

const serverToken = process.env.POSTMARK_SERVER_TOKEN;
const fromEmail = process.env.POSTMARK_FROM_EMAIL;

const client = serverToken ? new postmark.ServerClient(serverToken) : null;

// Names, titles and responsibilities are user-supplied: escape them before putting them in HTML.
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function sendProjectAssignmentEmail({
  toEmail,
  pmName,
  projectName,
  adminName,
  projectId
}: {
  toEmail: string;
  pmName: string;
  projectName: string;
  adminName: string;
  projectId: string;
}) {
  if (!client || !fromEmail) {
    console.warn('Postmark is not configured. Missing POSTMARK_SERVER_TOKEN or POSTMARK_FROM_EMAIL');
    return;
  }

  // Assuming standard domain mapping. In production, NEXT_PUBLIC_SITE_URL or similar is better.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const projectUrl = `${appUrl}/workspace/projects/${projectId}`;
  const h = { pmName: escapeHtml(pmName), projectName: escapeHtml(projectName), adminName: escapeHtml(adminName) };

  try {
    await client.sendEmail({
      From: fromEmail,
      To: toEmail,
      Subject: `You have been assigned to: ${projectName}`,
      HtmlBody: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #097255;">Project Assignment Notification</h2>
          <p>Hi ${h.pmName},</p>
          <p>You have been designated as the Project Manager for <strong>${h.projectName}</strong> by ${h.adminName}.</p>
          <p>You now have full operational control over this project in your workspace.</p>
          <div style="margin: 30px 0;">
            <a href="${projectUrl}" style="background-color: #097255; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Project
            </a>
          </div>
          <p style="font-size: 0.9em; color: #666;">
            If you have any questions about this assignment, please reach out to ${h.adminName} or your organization admin.
          </p>
        </div>
      `,
      TextBody: `Hi ${pmName},\n\nYou have been designated as the Project Manager for ${projectName} by ${adminName}.\n\nView Project: ${projectUrl}`
    });
    console.log(`Assignment email sent to ${toEmail} for project ${projectId}`);
  } catch (error) {
    console.error('Failed to send project assignment email via Postmark:', error);
  }
}

export async function sendFeatureAssignmentEmail({
  toEmail,
  assigneeName,
  projectName,
  featureName,
  assignerName,
  responsibility,
  projectId,
  featureId
}: {
  toEmail: string;
  assigneeName: string;
  projectName: string;
  featureName: string;
  assignerName: string;
  responsibility?: string;
  projectId: string;
  featureId: string;
}) {
  if (!client || !fromEmail) {
    console.warn('Postmark is not configured. Missing POSTMARK_SERVER_TOKEN or POSTMARK_FROM_EMAIL');
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const featureUrl = `${appUrl}/workspace/projects/${projectId}/features/${featureId}`;
  const h = {
    assigneeName: escapeHtml(assigneeName),
    projectName: escapeHtml(projectName),
    featureName: escapeHtml(featureName),
    assignerName: escapeHtml(assignerName),
    responsibility: responsibility ? escapeHtml(responsibility) : '',
  };

  try {
    await client.sendEmail({
      From: fromEmail,
      To: toEmail,
      Subject: `New Feature Assignment: ${featureName}`,
      HtmlBody: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #097255;">Feature Assignment Notification</h2>
          <p>Hi ${h.assigneeName},</p>
          <p>You have been assigned to the feature <strong>${h.featureName}</strong> in the project <strong>${h.projectName}</strong> by ${h.assignerName}.</p>
          ${h.responsibility ? `<p>Your listed responsibility: <em>${h.responsibility}</em></p>` : ''}
          <p>Please review the feature details and begin work when ready.</p>
          <div style="margin: 30px 0;">
            <a href="${featureUrl}" style="background-color: #097255; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Feature
            </a>
          </div>
          <p style="font-size: 0.9em; color: #666;">
            If you have any questions, please reach out to ${h.assignerName}.
          </p>
        </div>
      `,
      TextBody: `Hi ${assigneeName},\n\nYou have been assigned to the feature ${featureName} in the project ${projectName} by ${assignerName}.\n${responsibility ? `Your listed responsibility: ${responsibility}\n` : ''}\nView Feature: ${featureUrl}`
    });
    console.log(`Feature assignment email sent to ${toEmail} for feature ${featureId}`);
  } catch (error) {
    console.error('Failed to send feature assignment email via Postmark:', error);
  }
}

// ---------------------------------------------------------------------------
// Account emails (formerly sent by Supabase Auth), using the branded templates.
// ---------------------------------------------------------------------------

function renderTemplate(template: string, url: string, data: Record<string, string> = {}) {
  return template
    .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, escapeHtml(url))
    .replace(/\{\{\s*\.Data\.(\w+)\s*\}\}/g, (_, key: string) => escapeHtml(data[key] ?? ''));
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function sendAccountEmail(to: string, subject: string, html: string, text: string, link: string) {
  // Local development: always print the link so flows can be tested without an inbox.
  if (process.env.NODE_ENV !== 'production') console.info(`[email] ${subject} -> ${to}\n        ${link}`);

  if (!client || !fromEmail) {
    if (process.env.NODE_ENV === 'production') {
      console.error('Postmark is not configured. Missing POSTMARK_SERVER_TOKEN or POSTMARK_FROM_EMAIL');
    }
    return;
  }
  try {
    await client.sendEmail({ From: fromEmail, To: to, Subject: subject, HtmlBody: html, TextBody: text });
  } catch (error) {
    console.error(`Failed to send "${subject}" email via Postmark:`, error);
  }
}

export async function sendVerificationEmail({ toEmail, fullName, token }: { toEmail: string; fullName: string; token: string }) {
  const link = `${appUrl()}/api/v1/auth/callback?token=${encodeURIComponent(token)}`;
  await sendAccountEmail(
    toEmail,
    'Confirm your KPM account',
    renderTemplate(signupTemplate, link, { full_name: fullName }),
    `Hi ${fullName},\n\nConfirm your email address to activate your KPM workspace:\n${link}\n\nThis link expires in 24 hours.`,
    link,
  );
}

export async function sendInviteEmail({
  toEmail,
  token,
  inviterName,
  organizationName,
  invitedRole,
}: {
  toEmail: string;
  token: string;
  inviterName: string;
  organizationName: string;
  invitedRole: string;
}) {
  const link = `${appUrl()}/accept-invite?token=${encodeURIComponent(token)}`;
  await sendAccountEmail(
    toEmail,
    `You've been invited to join ${organizationName} on KPM`,
    renderTemplate(inviteTemplate, link, {
      inviter_name: inviterName,
      organization_name: organizationName,
      invited_role: invitedRole,
    }),
    `${inviterName} invited you to join ${organizationName} on KPM as ${invitedRole}.\n\nAccept the invitation:\n${link}\n\nThis link expires in 7 days.`,
    link,
  );
}

export async function sendPasswordResetEmail({ toEmail, token }: { toEmail: string; token: string }) {
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendAccountEmail(
    toEmail,
    'Reset your KPM password',
    renderTemplate(resetTemplate, link),
    `Reset your KPM password:\n${link}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
    link,
  );
}
