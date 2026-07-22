import * as postmark from 'postmark';

const serverToken = process.env.POSTMARK_SERVER_TOKEN;
const fromEmail = process.env.POSTMARK_FROM_EMAIL;

const client = serverToken ? new postmark.ServerClient(serverToken) : null;

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

  try {
    await client.sendEmail({
      From: fromEmail,
      To: toEmail,
      Subject: `You have been assigned to: ${projectName}`,
      HtmlBody: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #097255;">Project Assignment Notification</h2>
          <p>Hi ${pmName},</p>
          <p>You have been designated as the Project Manager for <strong>${projectName}</strong> by ${adminName}.</p>
          <p>You now have full operational control over this project in your workspace.</p>
          <div style="margin: 30px 0;">
            <a href="${projectUrl}" style="background-color: #097255; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Project
            </a>
          </div>
          <p style="font-size: 0.9em; color: #666;">
            If you have any questions about this assignment, please reach out to ${adminName} or your organization admin.
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
