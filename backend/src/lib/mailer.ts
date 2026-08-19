import nodemailer, { Transporter } from 'nodemailer';
import type { Sender } from '@prisma/client';

// One pooled transporter per sender account, reused across jobs.
const transporters = new Map<string, Transporter>();

function transporterFor(sender: Sender): Transporter {
  let transporter = transporters.get(sender.id);
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUser, pass: sender.smtpPass },
      pool: true,
      maxConnections: 2,
    });
    transporters.set(sender.id, transporter);
  }
  return transporter;
}

export interface SendResult {
  messageId: string;
  previewUrl: string | null;
}

const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/i;

/** Plain-text fallback for HTML bodies produced by the compose editor. */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendEmail(
  sender: Sender,
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  // The compose editor sends HTML; the API also accepts plain text.
  const isHtml = HTML_TAG_RE.test(body);
  const info = await transporterFor(sender).sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to,
    subject,
    text: isHtml ? htmlToText(body) : body,
    html: isHtml ? body : body.replace(/\n/g, '<br/>'),
  });
  const preview = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, previewUrl: preview ? String(preview) : null };
}

export interface EtherealAccount {
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

interface EtherealApiResponse {
  status: string;
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
}

export async function createEtherealAccount(index: number): Promise<EtherealAccount> {
  // nodemailer.createTestAccount() caches one account per process, so asking it
  // for several senders returns the same address every time. Hit Ethereal's
  // account API directly (what nodemailer uses internally) to get distinct ones.
  const res = await fetch('https://api.nodemailer.com/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestor: 'reachinbox-scheduler', version: '1.0.0' }),
  });
  if (!res.ok) {
    throw new Error(`Ethereal account creation failed with status ${res.status}`);
  }
  const account = (await res.json()) as EtherealApiResponse;
  if (account.status !== 'success' || !account.user) {
    throw new Error('Ethereal account creation returned an unexpected response');
  }
  return {
    name: `ReachInbox Sender ${index}`,
    email: account.user,
    smtpHost: account.smtp.host,
    smtpPort: account.smtp.port,
    smtpUser: account.user,
    smtpPass: account.pass,
  };
}
