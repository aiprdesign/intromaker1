import { noStore, requireAdmin } from "@/lib/admin";
import { MailError, mailReady, sendMail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Send a test email with the saved settings: { to }. Answers what the mail server said when it
 * fails (wrong login, a blocked port…), which the public forms never show.
 */
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { to?: unknown } | null;
  const to = typeof body?.to === "string" ? body.to.trim().slice(0, 254) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return Response.json({ error: "Enter the address to send the test to." }, { status: 400, headers: noStore });
  if (!(await mailReady())) return Response.json({ error: "Email isn't set up yet: add the SMTP server, username and password (or an email API key and a from address) and save first." }, { status: 400, headers: noStore });
  const started = Date.now();
  try {
    await sendMail({
      to,
      subject: "Prodintro.com test email",
      text: "This is a test from Admin → Setup. Password reset emails will arrive like this one.\n",
      html: "<p>This is a test from <strong>Admin → Setup</strong>.</p><p>Password reset emails will arrive like this one.</p>",
    });
    return Response.json({ ok: true, ms: Date.now() - started }, { headers: noStore });
  } catch (e) {
    if (e instanceof MailError) return Response.json({ error: e.detail ?? e.message }, { status: 502, headers: noStore });
    throw e;
  }
}
