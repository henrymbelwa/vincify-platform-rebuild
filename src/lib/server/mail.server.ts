import nodemailer from 'nodemailer'

let transport: nodemailer.Transporter | null = null

export function mailConfigured() {
  return Boolean(process.env['SMTP_HOST'] && process.env['SMTP_USER'] && process.env['SMTP_PASS'])
}

function getTransport() {
  if (!mailConfigured()) throw new Error('Email is not configured. Set SMTP_* variables in .env.')
  if (!transport) {
    const port = Number(process.env['SMTP_PORT'] || 465)
    transport = nodemailer.createTransport({
      host: process.env['SMTP_HOST'],
      port,
      secure: (process.env['SMTP_SECURE'] ?? String(port === 465)) === 'true',
      auth: { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] },
    })
  }
  return transport
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Branded, escaped HTML email. `lines` are plain text paragraphs or list items. */
export function renderEmail(title: string, intro: string, items: string[], cta?: { label: string; url: string }) {
  const list = items.length
    ? `<ul style="padding-left:18px;margin:16px 0;color:#17152a">${items.map((i) => `<li style="margin:6px 0">${esc(i)}</li>`).join('')}</ul>`
    : ''
  const button = cta
    ? `<a href="${esc(cta.url)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">${esc(cta.label)}</a>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Inter,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 24px">
<div style="font-weight:700;letter-spacing:.22em;color:#6d28d9;font-size:13px">VINCIFY</div>
<h1 style="font-size:20px;color:#17152a;margin:18px 0 8px">${esc(title)}</h1>
<p style="color:#475569;line-height:1.6;margin:0">${esc(intro)}</p>${list}${button}
<p style="color:#94a3b8;font-size:12px;margin-top:28px">You receive this because you enabled it in Vincify Automations. Turn it off there at any time.</p>
</div></body></html>`
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  await getTransport().sendMail({ from: process.env['EMAIL_FROM'] || process.env['SMTP_USER'], to, subject, html, text })
}
