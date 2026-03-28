import Groq from "groq-sdk"

const MAX_TRANSCRIPT_CHARS = 48_000

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

export async function summarizeTranscript(transcript: string, videoTitle?: string) {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    throw new Error("GROQ_API_KEY is not set")
  }

  const trimmed =
    transcript.length > MAX_TRANSCRIPT_CHARS
      ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) +
        "\n\n[Transcript truncated for length.]"
      : transcript

  const groq = new Groq({ apiKey: key })

  const userContent = videoTitle
    ? `Video title (may be approximate): ${videoTitle}\n\nTranscript:\n${trimmed}`
    : `Transcript:\n${trimmed}`

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
