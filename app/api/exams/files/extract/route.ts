import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { extractTextFromImageUrl, parseExamDataFromText } from "@/lib/server/examIntelligence"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function POST(request: Request) {
  try {
    const uid = await verifyBearerUid(request)
    const body = await request.json().catch(() => null)
    const examFileId = typeof body?.examFileId === "string" ? body.examFileId : null

    if (!examFileId) {
      return json({ error: "examFileId is required" }, 400)
    }

    const db = getAdminDb()
    const fileRef = db.collection("exam_files").doc(examFileId)
    const fileSnap = await fileRef.get()
    if (!fileSnap.exists) return json({ error: "Exam file not found" }, 404)

    const file = fileSnap.data() as any
    if (file.userId !== uid) return json({ error: "Forbidden" }, 403)

    const fileUrl = String(file.fileUrl || "")
    if (!fileUrl) return json({ error: "Exam file URL is missing" }, 400)

    let extractedText = ""

    if (/\.(png|jpg|jpeg|webp)$/i.test(fileUrl)) {
      extractedText = await extractTextFromImageUrl(fileUrl)
    } else {
      const res = await fetch(fileUrl)
      if (!res.ok) {
        return json({ error: "Could not download exam file" }, 422)
      }
      const text = await res.text()
      extractedText = text
    }

    if (!extractedText || extractedText.trim().length < 20) {
      return json({ error: "Could not extract enough text from file" }, 422)
    }

    const parsed = await parseExamDataFromText(extractedText)
    const parsedDate = parsed.examDate ? new Date(parsed.examDate) : null

    await fileRef.update({
      ocrStatus: "done",
      extracted: parsed,
      extractedAt: FieldValue.serverTimestamp(),
      extractedChars: extractedText.length,
    })

    if (file.examId && parsed.documentType && (parsed.examName || parsedDate)) {
      const examRef = db.collection("exams").doc(file.examId)
      const updates: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      }

      if (parsed.examName) updates.name = parsed.examName
      if (parsedDate && !Number.isNaN(parsedDate.getTime())) updates.examDate = parsedDate

      if (parsed.documentType === "admit_card") {
        updates.status = "admit_card_received"
      } else if (parsed.documentType === "application") {
        updates.status = "applied"
      }

      await examRef.set(updates, { merge: true })

      await db.collection("exam_events").add({
        userId: uid,
        examId: file.examId,
        eventType:
          parsed.documentType === "admit_card" ? "admit_detected" : "applied_detected",
        payload: parsed,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    return json({ ok: true, extracted: parsed })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    if (msg.includes("OPENAI_API_KEY") || msg.includes("EMBEDDING_API_KEY")) {
      return json({ error: "Server misconfiguration: OpenAI key" }, 503)
    }
    console.error("exam file extract:", e)
    return json({ error: msg }, 500)
  }
}
