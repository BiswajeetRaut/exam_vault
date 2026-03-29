function getReminderMailConfig() {
  const serviceId = process.env.EMAILJS_SERVICE_ID
  const templateId = process.env.EMAILJS_TEMPLATE_ID
  const publicKey = process.env.EMAILJS_PUBLIC_KEY
  const privateKey = process.env.EMAILJS_PRIVATE_KEY
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    throw new Error(
      "EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, and EMAILJS_PRIVATE_KEY are required"
    )
  }
  return { serviceId, templateId, publicKey, privateKey }
}

export async function sendReminderEmail(input: { to: string; subject: string; html: string }) {
  const { serviceId, templateId, publicKey, privateKey } = getReminderMailConfig()

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: input.to,
        subject: input.subject,
        html_content: input.html,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || "Email send failed")
  }
}

export function formatReminderDate(value: any) {
  const date =
    value?.toDate ? value.toDate() : value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return "Unknown date"
  return date.toDateString()
}
