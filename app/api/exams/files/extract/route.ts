import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import {
  extractTextFromFileBytes,
  extractTextFromFileUrl,
  parseExamDataFromText,
} from "@/lib/server/examIntelligence"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function POST(request: Request) {
  let fileRef: any = null
  try {
    const uid = await verifyBearerUid(request)
    const body = await request.json().catch(() => null)
    const examFileId = typeof body?.examFileId === "string" ? body.examFileId : null
    const fileDataBase64 = typeof body?.fileDataBase64 === "string" ? body.fileDataBase64 : null
    const clientFileType = typeof body?.fileType === "string" ? body.fileType : null

    if (!examFileId) {
      return json({ error: "examFileId is required" }, 400)
    }

    const db = getAdminDb()
    fileRef = db.collection("exam_files").doc(examFileId)
    const fileSnap = await fileRef.get()
    if (!fileSnap.exists) return json({ error: "Exam file not found" }, 404)

    const file = fileSnap.data() as any
    if (file.userId !== uid) return json({ error: "Forbidden" }, 403)

    const fileUrl = String(file.fileUrl || "")
    if (!fileUrl) return json({ error: "Exam file URL is missing" }, 400)

    await fileRef.set(
      {
        ocrStatus: "processing",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    const extractedText = fileDataBase64
      ? await extractTextFromFileBytes(
          Buffer.from(fileDataBase64, "base64"),
          clientFileType || String(file.fileType || "")
        )
      : await extractTextFromFileUrl(fileUrl, String(file.fileType || ""))

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

    const inferredDocType = parsed.documentType || file.docType
    if (file.examId && inferredDocType && (parsed.examName || parsedDate || file.docType)) {
      const examRef = db.collection("exams").doc(file.examId)
      const updates: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      }

      if (parsed.examName) updates.name = parsed.examName
      if (parsedDate && !Number.isNaN(parsedDate.getTime())) updates.examDate = parsedDate

      if (inferredDocType === "admit_card") {
        updates.status = "admit_card_received"
      } else if (inferredDocType === "application") {
        updates.status = "applied"
      }

      await examRef.set(updates, { merge: true })

      await db.collection("exam_events").add({
        userId: uid,
        examId: file.examId,
        eventType:
          inferredDocType === "admit_card" ? "admit_detected" : "applied_detected",
        payload: parsed,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    return json({ ok: true, extracted: parsed, extractedChars: extractedText.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (fileRef) {
      await fileRef
        .set(
          {
            ocrStatus: "failed",
            ocrError: msg,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        .catch(() => null)
    }
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    if (msg.includes("OPENAI_API_KEY") || msg.includes("EMBEDDING_API_KEY")) {
      return json({ error: "Server misconfiguration: OpenAI key" }, 503)
    }
    if (msg.includes("Could not reach file host from server")) {
      return json({ error: msg }, 503)
    }
    console.error("exam file extract:", e)
    return json({ error: msg }, 500)
  }
}
