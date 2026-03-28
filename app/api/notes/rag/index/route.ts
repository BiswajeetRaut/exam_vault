import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { embedTextChunks } from "@/lib/server/embedding"
import { upsertPineconeVectors } from "@/lib/server/pinecone"

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

    const vectors = chunks.map((chunk) => ({
      id: `${uid}:${noteId}:${chunk.chunkIndex}`,
      values: chunk.embedding,
      metadata: {
        userId: uid,
        noteId,
        folderId: note.folderId || "",
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        source: "note_summary",
        title: typeof note.title === "string" ? note.title : "",
      },
    }))

    await upsertPineconeVectors(vectors)

    await noteRef.update({
      ragIndexedAt: FieldValue.serverTimestamp(),
      ragChunkCount: vectors.length,
      ragProvider: "pinecone",
    })

    return json({ ok: true, chunks: vectors.length, provider: "pinecone" })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") {
      return json({ error: "Unauthorized" }, 401)
    }
    if (msg.includes("PINECONE_API_KEY and PINECONE_INDEX_HOST")) {
      return json({ error: "Server misconfiguration: Pinecone credentials" }, 503)
    }
    if (msg.includes("OPENAI_API_KEY") || msg.includes("EMBEDDING_API_KEY")) {
      return json({ error: "Server misconfiguration: embedding API key" }, 503)
    }
    if (msg.includes("Embedding dimensions mismatch")) {
      return json(
        {
          error:
            `${msg}. Set EMBEDDING_DIMENSIONS to match your Pinecone index dimension.`,
        },
        400
      )
    }
    console.error("notes rag index:", e)
    return json({ error: msg }, 500)
  }
}
