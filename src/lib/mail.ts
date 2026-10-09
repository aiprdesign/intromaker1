import { appendFile } from "node:fs/promises";
import nodemailer from "nodemailer";
import { serviceKey } from "./admin";
import { SITE_URL_ENV } from "./site";

/**
 * Sending email (sign-in links) through the owner's mailbox by SMTP (e.g. Hostinger: smtp.hostinger.com,
 * the mailbox address and its password), or an email service's HTTP API: Resend (keys start "re_"),
 * SendGrid ("SG.") or Postmark (a server token). The settings and the site's address come from
 * Admin → Setup → Email sign-in, else environment variables. SMTP wins when both are set.
 */

export class MailError extends Error {}

export type Mail = { to: string; subject: string; text: string; html: string };

async function smtp() {
  const host = await serviceKey("smtpHost");
  const user = await serviceKey("smtpUser");
  const pass = await serviceKey("smtpPass");
  return host && user && pass ? { host, user, pass, port: Number(process.env.INTROMAKER_SMTP_PORT) || 465 } : null;
}

/** Testing and staging: write emails to this file (one JSON line each) instead of sending them. */
const outbox = () => (process.env.INTROMAKER_MAIL_OUTBOX ?? "").trim();

/** Whether email can be sent: SMTP (server, mailbox and password), an API key and a from address, or the outbox file. */
export async function mailReady() {
  return !!(outbox() || (await smtp()) || ((await serviceKey("mailKey")) && (await serviceKey("mailFrom"))));
}

/**
 * The site's public address for links in emails. Never taken from the request in production: a
 * forged Host header would otherwise put the attacker's site in a real sign-in email.
 */
export async function linkBase(req: Request): Promise<string | null> {
  const set = ((await serviceKey("siteUrl")) || SITE_URL_ENV || "").replace(/\/+$/, "");
  if (/^https?:\/\/[^\s/]+$/.test(set)) return set;
  if (process.env.NODE_ENV !== "production") return new URL(req.url).origin;
  return null;
}

export async function sendMail(m: Mail): Promise<void> {
  if (outbox()) {
    await appendFile(outbox(), JSON.stringify({ at: Date.now(), ...m }) + "\n");
    return;
  }
  const box = await smtp();
  if (box) {
    // Port 465 is TLS from the start; 587 upgrades with STARTTLS (required, never plain text).
    const t = nodemailer.createTransport({ host: box.host, port: box.port, secure: box.port === 465, requireTLS: box.port !== 465, auth: { user: box.user, pass: box.pass }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 20_000 });
    try {
      // (From the mailbox itself: SMTP servers like Hostinger's refuse other senders.)
      await t.sendMail({ from: { name: "Prodintro.com", address: box.user }, to: m.to, subject: m.subject, text: m.text, html: m.html });
    } catch (e) {
      console.error(`[mail] SMTP: ${(e as Error).message}`);
      throw new MailError("The email couldn't be sent. Try again in a minute.");
    } finally {
      t.close();
    }
    return;
  }
  const key = await serviceKey("mailKey");
  const from = await serviceKey("mailFrom");
  if (!key || !from) throw new MailError("Email isn't set up yet.");
  const sender = `Prodintro.com <${from}>`;
  let res: Response;
  if (key.startsWith("re_")) {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      signal: AbortSignal.timeout(15_000),
    });
  } else if (key.startsWith("SG.")) {
    res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: m.to }] }],
        from: { email: from, name: "Prodintro.com" },
        subject: m.subject,
        content: [
          { type: "text/plain", value: m.text },
          { type: "text/html", value: m.html },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } else {
    res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "X-Postmark-Server-Token": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ From: sender, To: m.to, Subject: m.subject, TextBody: m.text, HtmlBody: m.html, MessageStream: "outbound" }),
      signal: AbortSignal.timeout(15_000),
    });
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    console.error(`[mail] ${res.status} ${detail}`);
    throw new MailError("The email couldn't be sent. Try again in a minute.");
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The sign-in email: one button, the link spelled out, and why it came. */
export function signInMail(to: string, link: string, opts: { firstName?: string; isNew: boolean; minutes: number }): Mail {
  const hello = opts.firstName ? `Hi ${opts.firstName},` : "Hi,";
  const action = opts.isNew ? "finish creating your account" : "sign in";
  const subject = opts.isNew ? "Confirm your email to get your free videos" : "Your Prodintro.com sign-in link";
  const text = `${hello}\n\nOpen this link to ${action} on Prodintro.com:\n${link}\n\nThe link works once, for ${opts.minutes} minutes. If you didn't ask for it, ignore this email.\n`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f3fb;font-family:Arial,Helvetica,sans-serif;color:#1f1d2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:14px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 6px;font-weight:700;font-size:18px">Prodintro.com</p>
<p style="margin:16px 0">${esc(hello)}</p>
<p style="margin:0 0 24px">Click the button to ${action}.</p>
<p style="margin:0 0 24px"><a href="${esc(link)}" style="display:inline-block;background:#6d4dff;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${opts.isNew ? "Confirm and sign in" : "Sign in"}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#6b6880">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(link)}</span></p>
<p style="margin:16px 0 0;font-size:13px;color:#6b6880">The link works once, for ${opts.minutes} minutes. If you didn't ask for it, ignore this email: nothing happens.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { to, subject, text, html };
}
