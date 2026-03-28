import Groq from "groq-sdk"

type QuizQuestion = {
  question: string
  options: string[]
  correctIndex: number
  solution: string
}

const SYSTEM = `You generate high-quality exam practice MCQs from provided notes.
Return strict JSON only with this shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "solution": "Very short reasoning (1-3 sentences)."
    }
  ]
}
Rules:
- Provide exactly the requested number of questions.
- Always 4 options per question.
- correctIndex must be 0..3.
- No markdown, no code fences.`

function extractJsonObject(text: string) {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Model did not return JSON")
  }
  return text.slice(start, end + 1)
}

function validateQuestions(raw: any, count: number): QuizQuestion[] {
  const list = Array.isArray(raw?.questions) ? raw.questions : null
  if (!list || list.length !== count) {
    throw new Error("Invalid question count from model")
  }

  return list.map((q: any, idx: number) => {
    if (typeof q?.question !== "string" || !q.question.trim()) {
      throw new Error(`Invalid question at index ${idx}`)
    }
    if (!Array.isArray(q?.options) || q.options.length !== 4) {
      throw new Error(`Invalid options at index ${idx}`)
    }
    const options = q.options.map((x: any) => String(x || "").trim())
    if (options.some((x: string) => !x)) {
      throw new Error(`Empty option at index ${idx}`)
    }
    const correctIndex = Number(q?.correctIndex)
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error(`Invalid correctIndex at index ${idx}`)
    }
    const solution = typeof q?.solution === "string" ? q.solution.trim() : ""

    return {
      question: q.question.trim(),
      options,
      correctIndex,
      solution: solution || "Reasoning unavailable.",
    }
  })
}

export async function generateQuizFromNotes(input: {
  questionCount: number
  designNotes?: string
  noteSummaries: Array<{ title: string; summary: string }>
}) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error("GROQ_API_KEY is not set")

  if (!input.noteSummaries.length) {
    throw new Error("At least one note summary is required")
  }

  const groq = new Groq({ apiKey: key })
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"

  const notesText = input.noteSummaries
    .map((n, i) => `Note ${i + 1}: ${n.title}\n${n.summary}`)
    .join("\n\n")

  const userPrompt =
    `Generate ${input.questionCount} MCQ questions from the notes below.\n` +
    `Quiz design preference: ${input.designNotes?.trim() || "standard balanced quiz"}\n\n` +
    `Notes:\n${notesText}`

  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 6000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
  })

  const text = completion.choices[0]?.message?.content?.trim()
  if (!text) throw new Error("Empty quiz generation response")

  const parsed = JSON.parse(extractJsonObject(text))
  return validateQuestions(parsed, input.questionCount)
}

export async function answerQuestionBounded(input: {
  question: string
  options: string[]
  correctIndex: number
  solution: string
  userQuery: string
}) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error("GROQ_API_KEY is not set")

  const groq = new Groq({ apiKey: key })
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"

  const prompt = `You are a strict tutor for a single quiz question.
You MUST answer only using the provided question context.
If user asks unrelated things, refuse politely and ask to stay on this question.

Question: ${input.question}
Options:
${input.options.map((x, i) => `${i + 1}. ${x}`).join("\n")}
Correct option index: ${input.correctIndex}
Reference solution: ${input.solution}

User query: ${input.userQuery}`

  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  })

  return completion.choices[0]?.message?.content?.trim() || "I could not generate an explanation."
}
