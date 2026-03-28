const DEFAULT_CHUNK_SIZE = 8_000
const DEFAULT_CHUNK_OVERLAP = 800

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

export function chunkTextByChars(
  rawText: string,
  options?: { chunkSize?: number; overlap?: number }
): string[] {
  const text = normalizeText(rawText)
  if (!text) return []

  const chunkSize = clamp(options?.chunkSize ?? DEFAULT_CHUNK_SIZE, 500, 30_000)
  const overlap = clamp(options?.overlap ?? DEFAULT_CHUNK_OVERLAP, 0, Math.floor(chunkSize / 3))

  if (text.length <= chunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    const slice = text.slice(start, end)

    const lastBoundary = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("\n")
    )

    const cutoff =
      end < text.length && lastBoundary > chunkSize * 0.65
        ? start + lastBoundary + 1
        : end

    const chunk = text.slice(start, cutoff).trim()
    if (chunk) {
      chunks.push(chunk)
    }

    if (cutoff >= text.length) {
      break
    }

    start = Math.max(cutoff - overlap, start + 1)
  }

  return chunks
}
