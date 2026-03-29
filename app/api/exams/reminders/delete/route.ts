import { FieldValue } from "firebase-admin/firestore"
import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { formatReminderDate, sendReminderEmail } from "@/lib/server/reminderEmail"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function POST(request: Request) {
  try {
    const uid = await verifyBearerUid(request)
    const body = await request.json().catch(() => null)
    const examId = typeof body?.examId === "string" ? body.examId : null
    if (!examId) return json({ error: "examId is required" }, 400)

    const db = getAdminDb()
    const remindersSnap = await db
      .collection("exam_reminders")
      .where("userId", "==", uid)
      .where("examId", "==", examId)
      .where("enabled", "==", true)
      .get()

    if (!remindersSnap.empty) {
      const firstReminder = remindersSnap.docs[0].data() as any
      const examName = String(firstReminder?.examName || "Exam")
      const examDate = firstReminder?.examDate
      const dayLabels = remindersSnap.docs
        .map((d) => {
          const row = d.data() as any
          const days = Number(row?.daysBefore)
          if (!Number.isFinite(days) || days <= 0) return "7 days"
          return days === 1 ? "1 day" : `${Math.floor(days)} days`
        })
        .join(", ")

      const batch = db.batch()
      for (const reminderDoc of remindersSnap.docs) {
        batch.set(
          reminderDoc.ref,
          {
            enabled: false,
            status: "cancelled",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
      }
      await batch.commit()

      const userSnap = await db.collection("users").doc(uid).get()
      const profileEmail = String((userSnap.data() as any)?.email || "").trim()
      const authEmail = (await getAdminAuth().getUser(uid).catch(() => null))?.email?.trim() || ""
      const toEmail = profileEmail || authEmail
      if (toEmail) {
        try {
          await sendReminderEmail({
            to: toEmail,
            subject: `Reminder removed: ${examName}`,
            html:
              `<p>Hello,</p><p>Your reminder(s) for <b>${examName}</b> have been removed.</p>` +
              `<p>Exam date: <b>${formatReminderDate(examDate)}</b><br/>` +
              `Removed reminder timing(s): <b>${dayLabels || "N/A"}</b></p>`,
          })
        } catch (emailErr) {
          console.error("reminder removed email:", emailErr)
        }
      }
    }

    return json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    console.error("exam reminder delete:", e)
    return json({ error: msg }, 500)
  }
}
