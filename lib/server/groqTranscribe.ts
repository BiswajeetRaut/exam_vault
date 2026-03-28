import Groq, { toFile } from "groq-sdk"

export async function transcribeAudioWithGroq(
  audioBuffer: Buffer,
  filename = "youtube-audio.webm"
): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error("GROQ_API_KEY is not set")

  const groq = new Groq({ apiKey: key })
  const file = await toFile(audioBuffer, filename, { type: "audio/webm" })

  const response = await groq.audio.transcriptions.create({
    model: process.env.GROQ_SPEECH_MODEL || "whisper-large-v3-turbo",
    file,
    response_format: "json",
  })

  const text = response.text?.trim()
  if (!text) {
    throw new Error("Fallback transcription returned empty text")
  }
  return text
}
