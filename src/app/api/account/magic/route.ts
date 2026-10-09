import { AccountError, createMagic, MAGIC_MINUTES, normEmail } from "@/lib/accounts";
import { noStore, sameOrigin } from "@/lib/http";
import { linkBase, MailError, mailReady, sendMail, signInMail } from "@/lib/mail";
import { rateLimit, take } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only a path on this site may follow sign-in. */
const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") && n.length <= 300 ? n : undefined);

/**
 * Email a one-time sign-in link: { email, mode: "up" | "in", firstName, country, region, next }.
 * Signing up sends the profile with the link (the account is made when it's opened). Asking to
 * sign in to an email with no account says so in the email, not here, so the form doesn't reveal
 * who has an account. Without an email service, development shows the link; production says
 * email sign-in isn't set up.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const limited = rateLimit(req, "magic");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { email?: unknown; mode?: unknown; firstName?: unknown; country?: unknown; region?: unknown; next?: unknown } | null;
  const email = normEmail(body?.email);
  // (One email address can't be flooded with links from many addresses either.)
  if (email && !take("magic", `mail:${email}`).ok) return Response.json({ error: "Too many sign-in emails for this address. Wait a few minutes and try again." }, { status: 429, headers: noStore });
  const dev = process.env.NODE_ENV !== "production";
  const base = await linkBase(req);
  const ready = await mailReady();
  if (!dev && (!ready || !base)) {
    return Response.json({ error: "Email sign-in isn't set up yet. The site owner can add an email service in Admin → Setup → Email sign-in.", code: "no-mail" }, { status: 503, headers: noStore });
  }
  try {
    const up = body?.mode === "up";
    const m = await createMagic(email, { profile: up ? { firstName: body?.firstName, country: body?.country, region: body?.region } : undefined, next: safeNext(body?.next) });
    // The token rides in the fragment: it isn't sent to the server in the request line or in referrers.
    const link = `${base ?? new URL(req.url).origin}/account/verify#t=${m.token}`;
    const known = m.exists || up;
    const mail = known
      ? signInMail(m.email, link, { firstName: m.firstName, isNew: !m.exists, minutes: MAGIC_MINUTES })
      : {
          to: m.email,
          subject: "Create your Prodintro.com account",
          text: `There's no Prodintro.com account for this email yet. Create one (it's free) at ${base ?? ""}/account\n`,
          html: `<p>There's no Prodintro.com account for this email yet.</p><p><a href="${base ?? ""}/account">Create one here</a>: it's free.</p>`,
        };
    if (ready) await sendMail(mail);
    else console.log(`[mail] (no email service; development) ${mail.to}: ${known ? link : "no account"}`);
    return Response.json({ sent: true, email: m.email, ...(dev && !ready && known ? { devLink: link } : {}) }, { headers: noStore });
  } catch (e) {
    if (e instanceof AccountError || e instanceof MailError) return Response.json({ error: e.message }, { status: e instanceof AccountError ? e.status : 502, headers: noStore });
    throw e;
  }
}
