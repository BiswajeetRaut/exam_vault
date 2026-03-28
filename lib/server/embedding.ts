import { chunkTextByChars } from "@/lib/server/textChunking"

const DEFAULT_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small"
const EMBEDDING_DIMENSIONS = process.env.EMBEDDING_DIMENSIONS
  ? Number(process.env.EMBEDDING_DIMENSIONS)
  : undefined

export type EmbeddingChunk = {
  chunkIndex: number
  content: string
  embedding: number[]
}

function getEmbeddingConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.EMBEDDING_API_KEY
  const baseUrl = process.env.EMBEDDING_API_BASE_URL || "https://api.openai.com/v1"

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or EMBEDDING_API_KEY is not set")
  }

  return { apiKey, baseUrl }
}

async function fetchEmbedding(input: string): Promise<number[]> {
  const { apiKey, baseUrl } = getEmbeddingConfig()

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_EMBEDDING_MODEL,
      input,
      ...(EMBEDDING_DIMENSIONS ? { dimensions: EMBEDDING_DIMENSIONS } : {}),
    }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error?.message || "Embedding API request failed")
  }

  const embedding = data?.data?.[0]?.embedding
  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error("Embedding API returned invalid vector")
  }

  if (EMBEDDING_DIMENSIONS && embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimensions mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
    )
  }

  return embedding as number[]
}

export async function embedTextChunks(text: string): Promise<EmbeddingChunk[]> {
  const chunks = chunkTextByChars(text, {
    chunkSize: 2_000,
    overlap: 200,
  })

  const output: EmbeddingChunk[] = []

  for (let i = 0; i < chunks.length; i += 1) {
    const embedding = await fetchEmbedding(chunks[i])
    output.push({
      chunkIndex: i,
      content: chunks[i],
      embedding,
    })
  }

  return output
}
