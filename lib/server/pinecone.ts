const DEFAULT_API_VERSION = "2024-07"

export type PineconeVector = {
  id: string
  values: number[]
  metadata?: Record<string, unknown>
}

function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY
  const indexHost = process.env.PINECONE_INDEX_HOST
  const namespace = process.env.PINECONE_NAMESPACE || "notes"

  if (!apiKey || !indexHost) {
    throw new Error("PINECONE_API_KEY and PINECONE_INDEX_HOST are required")
  }

  return {
    apiKey,
    indexHost: indexHost.replace(/\/$/, ""),
    namespace,
    apiVersion: process.env.PINECONE_API_VERSION || DEFAULT_API_VERSION,
  }
}

export async function upsertPineconeVectors(vectors: PineconeVector[]) {
  const config = getPineconeConfig()

  const response = await fetch(`${config.indexHost}/vectors/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": config.apiKey,
      "X-Pinecone-API-Version": config.apiVersion,
    },
    body: JSON.stringify({
      namespace: config.namespace,
      vectors,
    }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      "Pinecone upsert failed"
    throw new Error(message)
  }

  return data
}
