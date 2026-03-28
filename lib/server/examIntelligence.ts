export type ParsedExamData = {
  examName?: string
  documentType?: "admit_card" | "application" | "other"
  examDate?: string
  confidence?: number
  reasoning?: string
}

async function callOpenAIChat(messages: any[]) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.EMBEDDING_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or EMBEDDING_API_KEY is not set")
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.EXAM_OCR_MODEL || "gpt-4.1-mini",
      temperature: 0,
      max_tokens: 1200,
      messages,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI request failed")
  }

  return String(data?.choices?.[0]?.message?.content || "").trim()
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new Error("Model did not return JSON")
  }
  return text.slice(start, end + 1)
}

export async function extractTextFromImageUrl(imageUrl: string) {
  const content = await callOpenAIChat([
    {
      role: "user",
      content: [
        { type: "text", text: "Extract all readable text from this exam document image." },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ])

  return content
}

export async function parseExamDataFromText(text: string): Promise<ParsedExamData> {
  const prompt =
    "Extract structured exam details from this text. Return strict JSON only with keys: " +
    "examName, documentType (admit_card|application|other), examDate (YYYY-MM-DD or null), confidence (0-1), reasoning.\n\n" +
    `Text:\n${text.slice(0, 25_000)}`

  const raw = await callOpenAIChat([{ role: "user", content: prompt }])
  const parsed = JSON.parse(extractJsonObject(raw))

  return {
    examName: typeof parsed.examName === "string" ? parsed.examName : undefined,
    documentType:
      parsed.documentType === "admit_card" ||
      parsed.documentType === "application" ||
      parsed.documentType === "other"
        ? parsed.documentType
        : undefined,
    examDate: typeof parsed.examDate === "string" && parsed.examDate ? parsed.examDate : undefined,
    confidence:
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : undefined,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
  }
}

export async function fetchExamDatesFromSerp(query: string) {
  const key = process.env.SERPAPI_KEY
  if (!key) throw new Error("SERPAPI_KEY is not set")

  const url = new URL("https://serpapi.com/search.json")
  url.searchParams.set("engine", "google")
  url.searchParams.set("q", query)
  url.searchParams.set("api_key", key)
  url.searchParams.set("num", "5")

  const response = await fetch(url.toString(), { cache: "no-store" })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || "SERP API request failed")
  }

  const snippets: string[] = []
  if (Array.isArray(data?.organic_results)) {
    for (const row of data.organic_results) {
      if (typeof row?.snippet === "string") snippets.push(row.snippet)
      if (typeof row?.title === "string") snippets.push(row.title)
    }
  }

  const joined = snippets.join("\n")
  const match = joined.match(/(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])/)
  const detectedDate = match
    ? `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`
    : null

  return {
    detectedDate,
    snippets,
    raw: data,
  }
}
