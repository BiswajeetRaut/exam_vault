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
  const traceId = Math.random().toString(36).slice(2, 10)
  const startedAt = Date.now()
  const log = (stage: string, details?: Record<string, unknown>) => {
    console.info("[summarize][youtube]", {
      traceId,
      stage,
      elapsedMs: Date.now() - startedAt,
      ...details,
    })
  }

  try {
    log("request.received")
    const uid = await verifyBearerUid(request)
    log("auth.verified", { uid })
    const body = await request.json().catch(() => null)
    const noteId = typeof body?.noteId === "string" ? body.noteId : null
    if (!noteId) {
      log("request.invalid", { reason: "missing_note_id" })
      return json({ error: "noteId is required" }, 400)
    }
    log("request.parsed", { noteId })

    const db = getAdminDb()
    log("db.ready")
    const noteSnap = await db.collection("notes").doc(noteId).get()
    if (!noteSnap.exists) {
      log("note.missing", { noteId })
      return json({ error: "Note not found" }, 404)
    }

    const note = noteSnap.data()!
    if (!note.userId) {
      log("note.invalid_owner", { noteId })
      return json(
        {
          error:
            "This note has no owner on file. Create a new note to use AI summary.",
        },
        403
      )
    }
    if (note.userId !== uid) {
      log("note.forbidden", { noteId, ownerId: note.userId, uid })
      return json({ error: "Forbidden" }, 403)
    }
    log("note.loaded", { noteId, title: typeof note.title === "string" ? note.title : null })

    const itemsSnap = await db
      .collection("note_items")
      .where("noteId", "==", noteId)
      .get()
    log("note_items.loaded", { count: itemsSnap.size })

    const youtubeItem = itemsSnap.docs
      .map((d) => d.data() as { type?: string; content?: string })
      .find((x) => x.type === "youtube" && typeof x.content === "string")

    if (!youtubeItem?.content) {
      log("youtube.missing", { noteId })
      return json(
        { error: "This note has no YouTube link. Add one when editing the note." },
        400
      )
    }

    const videoId = extractYoutubeVideoId(youtubeItem.content)
    if (!videoId) {
      log("youtube.invalid_url", { content: youtubeItem.content })
      return json({ error: "Could not parse YouTube URL" }, 400)
    }
    log("youtube.parsed", { videoId })

    let transcript: string
    let transcriptSource: "captions" | "audio_fallback" = "captions"
    try {
      log("transcript.captions.start", { videoId })
      transcript = await fetchTranscriptPlain(videoId)
      log("transcript.captions.success", { chars: transcript.length })
    } catch (e) {
      console.warn("[summarize][youtube] transcript.captions.failed", {
        traceId,
        videoId,
        elapsedMs: Date.now() - startedAt,
        error: e instanceof Error ? e.message : String(e),
      })
      try {
        log("transcript.fallback_audio.download.start", { videoId })
        const audioBuffer = await downloadYoutubeAudioBuffer(
          `https://www.youtube.com/watch?v=${videoId}`
        )
        log("transcript.fallback_audio.download.success", { bytes: audioBuffer.byteLength })
        log("transcript.fallback_audio.transcribe.start")
        transcript = await transcribeAudioWithGroq(audioBuffer)
        transcriptSource = "audio_fallback"
        log("transcript.fallback_audio.transcribe.success", { chars: transcript.length })
      } catch (fallbackErr) {
        console.error("[summarize][youtube] transcript.fallback_audio.failed", {
          traceId,
          videoId,
          elapsedMs: Date.now() - startedAt,
          error:
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        })
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
      log("transcript.too_short", { chars: transcript?.length ?? 0, transcriptSource })
      return json({ error: "Transcript too short or empty for summarization." }, 422)
    }

    const title = typeof note.title === "string" ? note.title : undefined
    log("summary.start", { transcriptSource, transcriptChars: transcript.length })
    const summary = await summarizeTranscript(transcript, title)
    log("summary.success", { summaryChars: summary.length })

    await db
      .collection("notes")
      .doc(noteId)
      .update({
        summary,
        summarySource: transcriptSource,
        summaryUpdatedAt: FieldValue.serverTimestamp(),
      })
    log("note.updated", { noteId, transcriptSource })

    log("request.success")
    return json({ summary, transcriptSource })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    console.error("[summarize][youtube] request.failed", {
      traceId,
      elapsedMs: Date.now() - startedAt,
      message: msg,
      stack: e instanceof Error ? e.stack : null,
    })
    if (msg === "UNAUTHORIZED") {
      return json({ error: "Unauthorized" }, 401)
    }
    if (msg.includes("Firebase Admin is not configured")) {
      return json({ error: "Server misconfiguration: Firebase Admin" }, 503)
    }
    if (
      msg.includes("DECODER routines::unsupported") ||
      msg.includes("Getting metadata from plugin failed")
    ) {
      return json(
        {
          error:
            "Server misconfiguration: FIREBASE_PRIVATE_KEY format is invalid. Use full PEM (with \\n) or base64-encoded PEM.",
        },
        503
      )
    }
    if (msg.includes("GROQ_API_KEY")) {
      return json({ error: "Server misconfiguration: GROQ_API_KEY" }, 503)
    }
    console.error("summarize:", e)
    return json({ error: msg }, 500)
  }
}
