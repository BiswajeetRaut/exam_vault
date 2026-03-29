import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { formatReminderDate, sendReminderEmail } from "@/lib/server/reminderEmail"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = request.headers.get("authorization") || ""
  if (auth === `Bearer ${secret}`) return true

  const headerSecret = request.headers.get("x-cron-secret") || ""
  if (headerSecret === secret) return true

  const url = new URL(request.url)
  if (url.searchParams.get("secret") === secret) return true

  return false
}

async function runReminderDispatch() {
  const db = getAdminDb()
  const now = new Date()

  const remindersSnap = await db
    .collection("exam_reminders")
    .where("enabled", "==", true)
    .where("status", "==", "scheduled")
    .get()

  let sent = 0
  let failed = 0

  for (const doc of remindersSnap.docs) {
    const reminder = doc.data() as any
    const remindAt: Date | null = reminder.remindAt?.toDate ? reminder.remindAt.toDate() : null
    if (!remindAt || remindAt > now) continue

    const userSnap = await db.collection("users").doc(reminder.userId).get()
    const user = userSnap.data() as any
    const toEmail = String(user?.email || "")
    if (!toEmail) continue

    try {
      const daysBefore =
        typeof reminder.daysBefore === "number" && Number.isFinite(reminder.daysBefore)
          ? Math.max(0, Math.floor(reminder.daysBefore))
          : 7
      const dayLabel = daysBefore === 1 ? "1 day" : `${daysBefore} days`
        await sendReminderEmail({
          to: toEmail,
          subject: `Reminder: ${reminder.examName} is in ${dayLabel}`,
          html: `<p>Hello,</p><p>Your exam <b>${reminder.examName}</b> is scheduled on <b>${formatReminderDate(
            reminder.examDate
          )}</b>.</p><p>This reminder was set for <b>${dayLabel}</b> before the exam.</p>`,
        })

      await doc.ref.set(
        {
          status: "sent",
          sentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      sent += 1
    } catch (e) {
      await doc.ref.set(
        {
          status: "failed",
          lastError: e instanceof Error ? e.message : "Unknown",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      failed += 1
    }
  }

  return { sent, failed }
}

export async function POST(request: Request) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return json({ error: "Unauthorized" }, 401)
    }

    const { sent, failed } = await runReminderDispatch()
    return json({ ok: true, sent, failed })
  } catch (e: unknown) {
    console.error("cron exam-reminders:", e)
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500)
  }
}

export async function GET(request: Request) {
  return POST(request)
}
