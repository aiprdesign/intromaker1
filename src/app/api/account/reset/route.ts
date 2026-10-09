import { AccountError, createReset, normEmail, RESET_MINUTES } from "@/lib/accounts";
import { readSettings } from "@/lib/admin";
import { noStore, sameOrigin } from "@/lib/http";
import { linkBase, MailError, mailReady, resetMail, sendMail } from "@/lib/mail";
import { rateLimit, take } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Forgot password: { email }. Emails a one-time reset link when an account has this email; the
 * answer is the same either way, so the form doesn't reveal who has an account. Without an email
 * service, development shows the link; production says to ask the site owner.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const limited = rateLimit(req, "reset");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = normEmail(body?.email);
  // (One email address can't be flooded with reset emails from many addresses either.)
  if (email && !take("reset", `mail:${email}`).ok) return Response.json({ error: "Too many reset emails for this address. Wait a few minutes and try again." }, { status: 429, headers: noStore });
  const dev = process.env.NODE_ENV !== "production";
  const base = await linkBase(req);
  const ready = await mailReady();
  if (!dev && (!ready || !base)) {
    const contact = (await readSettings()).contactEmail ?? null;
    return Response.json(
      { error: `Password reset by email isn't set up on this site yet. ${contact ? `Write to ${contact}` : "Ask the site owner"} to reset your password.`, code: "no-mail", contactEmail: contact },
      { status: 503, headers: noStore },
    );
  }
  try {
    const r = await createReset(email);
    // The token rides in the fragment: it isn't sent to the server in the request line or in referrers.
    const link = r ? `${base ?? new URL(req.url).origin}/account/reset#t=${r.token}` : null;
    if (r && link) {
      const mail = resetMail(r.user.email, link, { firstName: r.user.firstName, minutes: RESET_MINUTES });
      if (ready) await sendMail(mail);
      else console.log(`[mail] (no email service; development) ${mail.to}: ${link}`);
    }
    return Response.json({ sent: true, email, minutes: RESET_MINUTES, ...(dev && !ready && link ? { devLink: link } : {}) }, { headers: noStore });
  } catch (e) {
    if (e instanceof AccountError || e instanceof MailError) return Response.json({ error: e.message }, { status: e instanceof AccountError ? e.status : 502, headers: noStore });
    throw e;
  }
}
