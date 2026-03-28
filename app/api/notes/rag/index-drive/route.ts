import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { embedTextChunks } from "@/lib/server/embedding"
import { upsertPineconeVectors } from "@/lib/server/pinecone"
import { FieldValue } from "firebase-admin/firestore"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

async function fetchDriveMeta(fileId: string, token: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  )
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error?.message || "Could not read Drive file metadata")
  }
  return data as { id: string; name: string; mimeType: string }
}

async function downloadDriveText(fileId: string, token: string, mimeType: string) {
  const isGoogleDoc = mimeType === "application/vnd.google-apps.document"
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error("Could not download Drive file content")
  }

  return (await res.text()).trim()
}

async function ocrImageBytes(bytes: ArrayBuffer, mimeType: string) {
  const key = process.env.OPENAI_API_KEY || process.env.EMBEDDING_API_KEY
  if (!key) {
    throw new Error("OPENAI_API_KEY or EMBEDDING_API_KEY is not set")
  }

  const b64 = Buffer.from(bytes).toString("base64")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OCR_MODEL || "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all readable text from this image only." },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${b64}` },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 3000,
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error?.message || "OCR request failed")
  }

  return String(data?.choices?.[0]?.message?.content || "").trim()
}

export async function POST(request: Request) {
  try {
    const uid = await verifyBearerUid(request)
    const body = await request.json().catch(() => null)
    const noteId = typeof body?.noteId === "string" ? body.noteId : null
    const noteItemId = typeof body?.noteItemId === "string" ? body.noteItemId : null
    const driveAccessToken =
      typeof body?.driveAccessToken === "string" ? body.driveAccessToken : null

    if (!noteId || !noteItemId || !driveAccessToken) {
      return json({ error: "noteId, noteItemId, driveAccessToken are required" }, 400)
    }

    const db = getAdminDb()
    const noteSnap = await db.collection("notes").doc(noteId).get()
    if (!noteSnap.exists) return json({ error: "Note not found" }, 404)
    const note = noteSnap.data()!
    if (!note.userId || note.userId !== uid) return json({ error: "Forbidden" }, 403)

    const itemSnap = await db.collection("note_items").doc(noteItemId).get()
    if (!itemSnap.exists) return json({ error: "Drive item not found" }, 404)
    const item = itemSnap.data() as any

    if (item.noteId !== noteId || item.type !== "drive") {
      return json({ error: "Invalid drive note item" }, 400)
    }

    const fileId = item?.content?.id
    if (!fileId || typeof fileId !== "string") {
      return json({ error: "Drive file id missing" }, 400)
    }

    const meta = await fetchDriveMeta(fileId, driveAccessToken)

    let extracted = ""

    if (
      meta.mimeType.startsWith("text/") ||
      meta.mimeType === "application/vnd.google-apps.document"
    ) {
      extracted = await downloadDriveText(fileId, driveAccessToken, meta.mimeType)
    } else if (meta.mimeType.startsWith("image/")) {
      const imageRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        {
          headers: { Authorization: `Bearer ${driveAccessToken}` },
          cache: "no-store",
        }
      )
      if (!imageRes.ok) {
        return json({ error: "Could not download image from Drive" }, 422)
      }
      extracted = await ocrImageBytes(await imageRes.arrayBuffer(), meta.mimeType)
    } else {
      return json(
        {
          error:
            "Unsupported file type for current OCR pipeline. Use Google Docs/plain text/image for now.",
        },
        422
      )
    }

    if (!extracted || extracted.length < 20) {
      return json({ error: "Could not extract enough text from file" }, 422)
    }

    const chunks = await embedTextChunks(extracted)

    const vectors = chunks.map((chunk) => ({
      id: `${uid}:${noteId}:${noteItemId}:${chunk.chunkIndex}`,
      values: chunk.embedding,
      metadata: {
        userId: uid,
        noteId,
        noteItemId,
        folderId: note.folderId || "",
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        source: "drive_file",
        fileName: meta.name,
        fileMimeType: meta.mimeType,
      },
    }))

    await upsertPineconeVectors(vectors)

    await db.collection("note_items").doc(noteItemId).update({
      ragIndexedAt: FieldValue.serverTimestamp(),
      ragChunkCount: vectors.length,
      ragProvider: "pinecone",
      extractedChars: extracted.length,
    })

    return json({ ok: true, chunks: vectors.length, fileName: meta.name })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    if (msg.includes("PINECONE_API_KEY and PINECONE_INDEX_HOST")) {
      return json({ error: "Server misconfiguration: Pinecone credentials" }, 503)
    }
    if (msg.includes("OPENAI_API_KEY") || msg.includes("EMBEDDING_API_KEY")) {
      return json({ error: "Server misconfiguration: API key" }, 503)
    }
    console.error("notes rag index-drive:", e)
    return json({ error: msg }, 500)
  }
}
