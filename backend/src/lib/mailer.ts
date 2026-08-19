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

export async function sendEmail(
  sender: Sender,
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  const info = await transporterFor(sender).sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br/>'),
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

export async function createEtherealAccount(index: number): Promise<EtherealAccount> {
  const account = await nodemailer.createTestAccount();
  return {
    name: `ReachInbox Sender ${index}`,
    email: account.user,
    smtpHost: account.smtp.host,
    smtpPort: account.smtp.port,
    smtpUser: account.user,
    smtpPass: account.pass,
  };
}
