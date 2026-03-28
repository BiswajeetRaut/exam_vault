export type ParsedExamData = {
  examName?: string
  documentType?: "admit_card" | "application" | "other"
  examDate?: string
  confidence?: number
  reasoning?: string
}

type SerpDateInference = {
  detectedDate: string | null
  confidence: number
  reasoning: string
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

  const llmInference = await inferDateFromSerpSnippets(query, snippets)
  const detectedDate = llmInference.detectedDate

  return {
    detectedDate,
    confidence: llmInference.confidence,
    reasoning: llmInference.reasoning,
    snippets,
    raw: data,
  }
}

async function inferDateFromSerpSnippets(
  query: string,
  snippets: string[]
): Promise<SerpDateInference> {
  const joined = snippets.join("\n").slice(0, 20_000)
  if (!joined.trim()) {
    return { detectedDate: null, confidence: 0, reasoning: "No snippets returned." }
  }

  try {
    const raw = await callOpenAIChat([
      {
        role: "user",
        content:
          "You are given SERP snippets about an exam. Extract the most likely exam date.\n" +
          "Return strict JSON: {\"detectedDate\":\"YYYY-MM-DD or null\",\"confidence\":0-1,\"reasoning\":\"short\"}.\n" +
          `Query: ${query}\n\nSnippets:\n${joined}`,
      },
    ])

    const parsed = JSON.parse(extractJsonObject(raw))
    const detectedDate =
      typeof parsed?.detectedDate === "string" && parsed.detectedDate ? parsed.detectedDate : null
    const confidence =
      typeof parsed?.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0
    const reasoning = typeof parsed?.reasoning === "string" ? parsed.reasoning : "No reasoning."

    return { detectedDate, confidence, reasoning }
  } catch {
    const regexMatch = joined.match(/(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])/)
    const detectedDate = regexMatch
      ? `${regexMatch[1]}-${String(regexMatch[2]).padStart(2, "0")}-${String(regexMatch[3]).padStart(2, "0")}`
      : null
    return {
      detectedDate,
      confidence: detectedDate ? 0.35 : 0,
      reasoning: "Regex fallback applied.",
    }
  }
}

export async function refineExamSuggestionsWithLLM(query: string, suggestions: string[]) {
  if (!suggestions.length) return []

  try {
    const raw = await callOpenAIChat([
      {
        role: "user",
        content:
          "Given a user query and candidate exam titles, return the best 6 exam name suggestions.\n" +
          "Return strict JSON: {\"suggestions\": [\"...\"]}\n" +
          `Query: ${query}\nCandidates:\n${suggestions.join("\n")}`,
      },
    ])

    const parsed = JSON.parse(extractJsonObject(raw))
    if (!Array.isArray(parsed?.suggestions)) return suggestions.slice(0, 6)
    return parsed.suggestions.map((x: unknown) => String(x || "").trim()).filter(Boolean).slice(0, 6)
  } catch {
    return suggestions.slice(0, 6)
  }
}
