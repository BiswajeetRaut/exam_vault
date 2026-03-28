import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function PATCH(request: Request) {
  try {
    const uid = await verifyBearerUid(request)
    const body = await request.json().catch(() => null)
    const noteId = typeof body?.noteId === "string" ? body.noteId : null
    const summary = typeof body?.summary === "string" ? body.summary : null

    if (!noteId || summary === null) {
      return json({ error: "noteId and summary are required" }, 400)
    }

    if (summary.length > 200_000) {
      return json({ error: "Summary too long" }, 400)
    }

    const db = getAdminDb()
    const noteSnap = await db.collection("notes").doc(noteId).get()
    if (!noteSnap.exists) {
      return json({ error: "Note not found" }, 404)
    }

    const note = noteSnap.data()!
    if (!note.userId) {
      return json(
        {
          error:
            "This note has no owner on file. Create a new note to save summaries.",
        },
        403
      )
    }
    if (note.userId !== uid) {
      return json({ error: "Forbidden" }, 403)
    }

    await db
      .collection("notes")
      .doc(noteId)
      .update({
        summary,
        summaryUpdatedAt: FieldValue.serverTimestamp(),
      })

    return json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") {
      return json({ error: "Unauthorized" }, 401)
    }
    if (msg.includes("Firebase Admin is not configured")) {
      return json({ error: "Server misconfiguration: Firebase Admin" }, 503)
    }
    console.error("summary PATCH:", e)
    return json({ error: msg }, 500)
  }
}
