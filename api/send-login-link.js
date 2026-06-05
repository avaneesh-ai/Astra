import { cleanText, getOrigin, readJson, requireMethod, sendJson } from "../lib/api-utils.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  const body = await readJson(req);
  const email = cleanText(body.email, 180).toLowerCase();
  const name = cleanText(body.name, 120);
  const loginLink = cleanText(body.loginLink || `${getOrigin(req)}/`, 1200);

  if (!email || !email.includes("@")) {
    sendJson(res, 400, { ok: false, error: "Enter a valid email address." });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.LOGIN_FROM_EMAIL;

  if (!resendKey || !from) {
    sendJson(res, 200, {
      ok: true,
      demo: true,
      loginLink,
      message: "Email provider is not configured yet. The app created a secure demo link for local testing."
    });
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Login to Astra_AI",
        html:
          `<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#161a1f">` +
          `<h1 style="font-size:22px">Astra_AI login</h1>` +
          `<p>Hello ${name || "there"}, click the button below to continue.</p>` +
          `<p><a href="${loginLink}" style="display:inline-block;background:#195f4b;color:white;padding:12px 18px;text-decoration:none;border-radius:8px">Login to Astra_AI</a></p>` +
          `<p style="color:#667085;font-size:13px">If you did not request this, ignore this email.</p>` +
          `</div>`
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      sendJson(res, 200, {
        ok: false,
        demo: true,
        loginLink,
        message: data.message || "The email provider did not send the link, so a local testing link is available."
      });
      return;
    }

    sendJson(res, 200, { ok: true, sent: true });
  } catch {
    sendJson(res, 200, {
      ok: false,
      demo: true,
      loginLink,
      message: "The email request failed, so a local testing link is available."
    });
  }
}
