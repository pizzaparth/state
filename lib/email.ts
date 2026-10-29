import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Transactional email. Three transports, chosen by environment:
 *
 *   RESEND_API_KEY set     Resend HTTP API (production)
 *   EMAIL_OUTBOX_DIR set   one JSON file per message (automated tests; local URLs only,
 *                          enforced by lib/env.ts so links never land on disk in production)
 *   neither, development   printed to the dev server console
 *
 * Messages carry single-use links, so they are never logged in production.
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(message: Email): Promise<void> {
  const from = process.env.EMAIL_FROM || "State <no-reply@localhost>";

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
    return;
  }

  if (process.env.EMAIL_OUTBOX_DIR) {
    const dir = path.resolve(process.env.EMAIL_OUTBOX_DIR);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${crypto.randomUUID()}.json`);
    // Write then rename: readers polling for *.json never see a half-written message
    await writeFile(`${file}.tmp`, JSON.stringify({ from, ...message, sentAt: new Date().toISOString() }));
    await rename(`${file}.tmp`, file);
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`\n[email] to ${message.to}: ${message.subject}\n${message.text}\n`);
    return;
  }

  throw new Error("No email transport configured (set RESEND_API_KEY)");
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plain, single-action message: one paragraph, one link, one note. */
export function actionEmail({ to, name, subject, intro, action, url, note }: {
  to: string;
  name: string;
  subject: string;
  intro: string;
  action: string;
  url: string;
  note: string;
}): Email {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return {
    to,
    subject,
    text: `${greeting}\n\n${intro}\n\n${action}: ${url}\n\n${note}\n\nState by Ksan Relay`,
    html: `<!doctype html><html><body style="margin:0;background:#050505;color:#F4F4F2;font:16px/1.6 -apple-system,Segoe UI,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:40px 24px">
<p style="margin:0 0 24px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9A9A96">State</p>
<p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px">${escapeHtml(intro)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#F2F2EF;color:#0A0A0A;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">${escapeHtml(action)}</a></p>
<p style="margin:0 0 8px;font-size:14px;color:#9A9A96">${escapeHtml(note)}</p>
<p style="margin:0;font-size:13px;color:#85857F;word-break:break-all">${escapeHtml(url)}</p>
</div></body></html>`,
  };
}
