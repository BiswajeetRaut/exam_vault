import Groq from "groq-sdk"
import { chunkTextByChars } from "@/lib/server/textChunking"

const MAX_INPUT_CHARS_PER_CHUNK = 8_000
const MAX_CHUNKS_FOR_MAP = 18

const SYSTEM = `You are an assistant for competitive exam preparation. You turn rough video transcripts into clear study notes.

Output MUST be valid Markdown only (no preamble). Use exactly these sections in order. If a section has nothing grounded in the transcript, still include the heading and write "—" or "None noted." as appropriate.

## Overview
2–4 sentences.

## Key concepts
Bullet list of important ideas and definitions.

## Key points
Numbered or bulleted facts the student should remember.

## Formulas & equations
Any math or symbols from the transcript, in plain text or LaTeX-style where helpful. If none: "None noted."

## Tips & mnemonics
Short memory aids if the transcript suggests any; otherwise "None noted."

## Glossary
| Term | Meaning |
(only terms that appear in the transcript; else "None noted.")`

function getGroqClient() {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    throw new Error("GROQ_API_KEY is not set")
  }
  return new Groq({ apiKey: key })
}

async function complete(groq: Groq, userContent: string) {
  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
  })

  const text = completion.choices[0]?.message?.content?.trim()
  if (!text) {
    throw new Error("Empty response from model")
  }

  return text
}

export async function summarizeTranscript(transcript: string, videoTitle?: string) {
  const chunks = chunkTextByChars(transcript, {
    chunkSize: MAX_INPUT_CHARS_PER_CHUNK,
    overlap: 600,
  }).slice(0, MAX_CHUNKS_FOR_MAP)

  if (!chunks.length) {
    throw new Error("Transcript is empty")
  }

  const groq = getGroqClient()

  const header = videoTitle
    ? `Video title (may be approximate): ${videoTitle}`
    : "Video title: not provided"

  if (chunks.length === 1) {
    return complete(groq, `${header}\n\nTranscript:\n${chunks[0]}`)
  }

  const partials: string[] = []

  for (let i = 0; i < chunks.length; i += 1) {
    const summary = await complete(
      groq,
      `${header}\n\nYou are summarizing part ${i + 1} of ${chunks.length}.\n` +
        "Focus only on grounded content from this chunk.\n\n" +
        `Transcript chunk:\n${chunks[i]}`
    )
    partials.push(`### Chunk ${i + 1}\n${summary}`)
  }

  const merged = await complete(
    groq,
    `${header}\n\nBelow are chunk-level notes from the same lecture.\n` +
      "Merge them into one de-duplicated final set of notes in the required format.\n" +
      "If a point repeats, keep the clearest version once.\n\n" +
      partials.join("\n\n")
  )

  return merged
}
