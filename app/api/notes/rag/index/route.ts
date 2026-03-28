import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { embedTextChunks } from "@/lib/server/embedding"
import { getSupabaseAdminClient } from "@/lib/server/supabaseAdmin"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function POST(request: Request) {
  try {
    const uid = await verifyBearerUid(request)
    const body = await request.json().catch(() => null)
    const noteId = typeof body?.noteId === "string" ? body.noteId : null

    if (!noteId) {
      return json({ error: "noteId is required" }, 400)
    }

    const db = getAdminDb()
    const noteRef = db.collection("notes").doc(noteId)
    const noteSnap = await noteRef.get()

    if (!noteSnap.exists) {
      return json({ error: "Note not found" }, 404)
    }

    const note = noteSnap.data()!
    if (!note.userId || note.userId !== uid) {
      return json({ error: "Forbidden" }, 403)
    }

    const summary = typeof note.summary === "string" ? note.summary.trim() : ""
    if (!summary) {
      return json({ error: "Please generate or save notes first" }, 400)
    }

    const chunks = await embedTextChunks(summary)

    const supabase = getSupabaseAdminClient()

    const payload = chunks.map((chunk) => ({
      user_id: uid,
      note_id: noteId,
      folder_id: note.folderId || null,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: {
        source: "note_summary",
        title: typeof note.title === "string" ? note.title : "",
      },
    }))

    const { error } = await supabase.from("note_embeddings").upsert(payload, {
      onConflict: "note_id,chunk_index",
    })

    if (error) {
      throw new Error(error.message)
    }

    await noteRef.update({
      ragIndexedAt: FieldValue.serverTimestamp(),
      ragChunkCount: payload.length,
    })

    return json({ ok: true, chunks: payload.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") {
      return json({ error: "Unauthorized" }, 401)
    }
    if (msg.includes("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")) {
      return json({ error: "Server misconfiguration: Supabase service role" }, 503)
    }
    if (msg.includes("OPENAI_API_KEY") || msg.includes("EMBEDDING_API_KEY")) {
      return json({ error: "Server misconfiguration: embedding API key" }, 503)
    }
    console.error("notes rag index:", e)
    return json({ error: msg }, 500)
  }
}
