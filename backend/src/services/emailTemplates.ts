const PRIMARY = '#795BD2'
const INK = '#252641'
const MUTED = '#667085'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}

export type EmailDetail = [label: string, value: string]

interface Template {
  subject: string
  organizationName: string
  greeting: string
  intro: string
  details: EmailDetail[]
  /** Shown as a button in HTML and as a plain URL in text. */
  action?: { label: string; url: string; note: string }
  outro?: string
}

/** Builds both versions of a message. All values are escaped, because visitors type their own names. */
export function renderEmail({ subject, organizationName, greeting, intro, details, action, outro }: Template) {
  const text = [
    greeting,
    '',
    intro,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(action ? ['', `${action.label}:`, action.url, '', action.note] : []),
    ...(outro ? ['', outro] : []),
    '',
    organizationName,
  ].join('\n')

  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:${MUTED};vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0;color:${INK}">${escapeHtml(value)}</td></tr>`,
    )
    .join('')

  const button = action
    ? `<p style="margin:24px 0 8px"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${PRIMARY};color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
       <p style="margin:0;color:${MUTED};font-size:13px">${escapeHtml(action.note)}</p>`
    : ''

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F5F6FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${INK}">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #E6E8F0;border-radius:14px;padding:28px">
    <p style="margin:0 0 20px;font-size:18px;font-weight:600">${escapeHtml(organizationName)}</p>
    <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px">${escapeHtml(intro)}</p>
    <table style="border-collapse:collapse;font-size:14px">${rows}</table>
    ${button}
    ${outro ? `<p style="margin:20px 0 0">${escapeHtml(outro)}</p>` : ''}
  </div>
</body></html>`

  return { subject, text, html }
}
