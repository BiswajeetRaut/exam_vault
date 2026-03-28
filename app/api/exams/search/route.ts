import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { refineExamSuggestionsWithLLM } from "@/lib/server/examIntelligence"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function GET(request: Request) {
  try {
    await verifyBearerUid(request)

    const url = new URL(request.url)
    const q = (url.searchParams.get("q") || "").trim()
    if (!q) return json({ suggestions: [] })

    const key = process.env.SERPAPI_KEY
    if (!key) return json({ error: "Server misconfiguration: SERPAPI_KEY" }, 503)

    const serp = new URL("https://serpapi.com/search.json")
    serp.searchParams.set("engine", "google")
    serp.searchParams.set("q", `${q} exam notification`)
    serp.searchParams.set("api_key", key)
    serp.searchParams.set("num", "5")

    const res = await fetch(serp.toString(), { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return json({ error: data?.error || "SERP lookup failed" }, 502)
    }

    const rawSuggestions = Array.isArray(data?.organic_results)
      ? data.organic_results
          .map((x: any) => String(x?.title || "").trim())
          .filter(Boolean)
          .slice(0, 10)
      : []

    const suggestions = await refineExamSuggestionsWithLLM(q, rawSuggestions)

    return json({ suggestions })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    console.error("exam search:", e)
    return json({ error: msg }, 500)
  }
}
