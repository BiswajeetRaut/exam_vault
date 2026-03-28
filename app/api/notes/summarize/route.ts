import { FieldValue } from "firebase-admin/firestore"
import { summarizeTranscript } from "@/lib/server/groqSummarize"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import {
  extractYoutubeVideoId,
  fetchTranscriptPlain,
} from "@/lib/server/youtubeTranscript"
import { downloadYoutubeAudioBuffer } from "@/lib/server/youtubeAudioFallback"
import { transcribeAudioWithGroq } from "@/lib/server/groqTranscribe"

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
    const noteSnap = await db.collection("notes").doc(noteId).get()
    if (!noteSnap.exists) {
      return json({ error: "Note not found" }, 404)
    }

    const note = noteSnap.data()!
    if (!note.userId) {
      return json(
        {
          error:
            "This note has no owner on file. Create a new note to use AI summary.",
        },
        403
      )
    }
    if (note.userId !== uid) {
      return json({ error: "Forbidden" }, 403)
    }

    const itemsSnap = await db
      .collection("note_items")
      .where("noteId", "==", noteId)
      .get()

    const youtubeItem = itemsSnap.docs
      .map((d) => d.data() as { type?: string; content?: string })
      .find((x) => x.type === "youtube" && typeof x.content === "string")

    if (!youtubeItem?.content) {
      return json(
        { error: "This note has no YouTube link. Add one when editing the note." },
        400
      )
    }

    const videoId = extractYoutubeVideoId(youtubeItem.content)
    if (!videoId) {
      return json({ error: "Could not parse YouTube URL" }, 400)
    }

    let transcript: string
    let transcriptSource: "captions" | "audio_fallback" = "captions"
    try {
      transcript = await fetchTranscriptPlain(videoId)
    } catch (e) {
      console.warn("Caption transcript failed, trying audio fallback:", e)
      try {
        const audioBuffer = await downloadYoutubeAudioBuffer(
          `https://www.youtube.com/watch?v=${videoId}`
        )
        transcript = await transcribeAudioWithGroq(audioBuffer)
        transcriptSource = "audio_fallback"
      } catch (fallbackErr) {
        console.error("Audio fallback transcription failed:", fallbackErr)
        return json(
          {
            error:
              "Could not load captions, and fallback audio transcription also failed.",
          },
          422
        )
      }
    }

    if (!transcript || transcript.length < 40) {
      return json({ error: "Transcript too short or empty for summarization." }, 422)
    }

    const title = typeof note.title === "string" ? note.title : undefined
    const summary = await summarizeTranscript(transcript, title)

    await db
      .collection("notes")
      .doc(noteId)
      .update({
        summary,
        summarySource: transcriptSource,
        summaryUpdatedAt: FieldValue.serverTimestamp(),
      })

    return json({ summary, transcriptSource })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") {
      return json({ error: "Unauthorized" }, 401)
    }
    if (msg.includes("Firebase Admin is not configured")) {
      return json({ error: "Server misconfiguration: Firebase Admin" }, 503)
    }
    if (msg.includes("GROQ_API_KEY")) {
      return json({ error: "Server misconfiguration: GROQ_API_KEY" }, 503)
    }
    console.error("summarize:", e)
    return json({ error: msg }, 500)
  }
}
