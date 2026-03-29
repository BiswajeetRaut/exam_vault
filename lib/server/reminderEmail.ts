function getReminderMailConfig() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and REMINDER_FROM_EMAIL are required")
  }
  return { apiKey, from }
}

export async function sendReminderEmail(input: { to: string; subject: string; html: string }) {
  const { apiKey, from } = getReminderMailConfig()

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message || "Email send failed")
  }
}

export function formatReminderDate(value: any) {
  const date =
    value?.toDate ? value.toDate() : value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return "Unknown date"
  return date.toDateString()
}
