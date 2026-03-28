/**
 * Extract YouTube video id from common URL shapes (watch, youtu.be, embed, live, shorts).
 */
export function extractYoutubeVideoId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const short = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
    if (short?.[1]) return normalizeId(short[1])

    const live = trimmed.match(
      /(?:m\.)?youtube\.com\/live\/([a-zA-Z0-9_-]+)/
    )
    if (live?.[1]) return normalizeId(live[1])

    const shorts = trimmed.match(
      /(?:m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/
    )
    if (shorts?.[1]) return normalizeId(shorts[1])

    const embed = trimmed.match(
      /(?:m\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
    )
    if (embed?.[1]) return normalizeId(embed[1])

    const fromQuery = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/)
    if (fromQuery?.[1]) return normalizeId(fromQuery[1])

    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  } catch {
    /* ignore */
  }
  return null
}

function normalizeId(segment: string): string {
  const id = (segment.split(/[?&#/]/)[0] || "").trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id
  const prefix = id.match(/^([a-zA-Z0-9_-]{11})/)
  return prefix ? prefix[1] : id
}

export function getYoutubeEmbedUrl(raw: string): string {
  const id = extractYoutubeVideoId(raw)
  return id ? `https://www.youtube.com/embed/${id}` : ""
}
