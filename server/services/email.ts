/**
 * SMTP email service — used for sending test/preview emails.
 * Configure via environment variables:
 *   SMTP_HOST  — e.g. smtp.gmail.com | smtp.resend.com | smtp.sendgrid.net
 *   SMTP_PORT  — default 587
 *   SMTP_USER  — SMTP username / API key identifier
 *   SMTP_PASS  — SMTP password / API key
 *   SMTP_FROM  — "From" address, defaults to hello@welltolddesign.com
 */

import nodemailer from "nodemailer";

export class SmtpNotConfiguredError extends Error {
  readonly code = "smtp_required";
  constructor() {
    super("smtp_required");
    this.name = "SmtpNotConfiguredError";
  }
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new SmtpNotConfiguredError();
  }

  const port = Number(process.env.SMTP_PORT) || 587;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  const transport = getTransport();
  const from = opts.from || process.env.SMTP_FROM || "Well Told <hello@welltolddesign.com>";

  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
