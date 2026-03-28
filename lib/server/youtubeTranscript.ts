import { extractYoutubeVideoId } from "@/lib/youtubeVideoId"

export { extractYoutubeVideoId }

export async function fetchTranscriptPlain(videoRef: string): Promise<string> {
  const { fetchTranscript } = await import("youtube-transcript")
  const id = extractYoutubeVideoId(videoRef) || videoRef.trim()
  const segments = await fetchTranscript(id)
  const text = segments.map((s) => s.text).join(" ")
  return text.replace(/\s+/g, " ").trim()
}
