import Groq from "groq-sdk";
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const langSmithClient = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: process.env.LANGSMITH_ENDPOINT,
  tracingMode: "langsmith"
});

const SYSTEM_PROMPT = [
  "You are a senior code reviewer.",
  "Review the code for bugs, security, quality, performance, and improvements.",
  "Return only valid JSON with these keys: overallScore, criticalIssues, codeQuality, performanceSuggestions, bestPractices, positiveHighlights.",
  "overallScore must be a number from 0 to 100.",
  "Each list item should be concise and actionable.",
  "Each issue object should include title and description, and criticalIssues should also include severity.",
  "Do not include markdown or extra keys."
].join(" ");

function normalizeReview(review) {
  return {
    overallScore: Number.isFinite(review?.overallScore) ? review.overallScore : 0,
    criticalIssues: Array.isArray(review?.criticalIssues) ? review.criticalIssues : [],
    codeQuality: Array.isArray(review?.codeQuality) ? review.codeQuality : [],
    performanceSuggestions: Array.isArray(review?.performanceSuggestions) ? review.performanceSuggestions : [],
    bestPractices: Array.isArray(review?.bestPractices) ? review.bestPractices : [],
    positiveHighlights: Array.isArray(review?.positiveHighlights) ? review.positiveHighlights : []
  };
}

function isReviewShape(review) {
  return (
    review &&
    Number.isFinite(review.overallScore) &&
    Array.isArray(review.criticalIssues) &&
    Array.isArray(review.codeQuality) &&
    Array.isArray(review.performanceSuggestions) &&
    Array.isArray(review.bestPractices) &&
    Array.isArray(review.positiveHighlights)
  );
}

const generateReview = traceable(
  async ({ code, language, focus }) => {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Language: ${language}\nFocus: ${focus}\n\nCode:\n${code}` }
      ],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: "json_object" }
    });

    const rawContent = completion?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(rawContent ?? "{}");

    if (!isReviewShape(parsed)) {
      throw new SyntaxError("Review parsing failed. Please try again.");
    }

    return normalizeReview(parsed);
  },
  {
    name: "groq-code-review",
    run_type: "chain",
    client: langSmithClient,
    project_name: process.env.LANGSMITH_PROJECT,
    processInputs: ({ code, language, focus }) => ({ codeLength: code.length, language, focus })
  }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || (await parseJsonBody(req));

  const code = typeof body?.code === "string" ? body.code : "";
  const language = typeof body?.language === "string" ? body.language : "";
  const focus = typeof body?.focus === "string" ? body.focus : "All";

  const supportedLanguages = new Set([
    "JavaScript",
    "TypeScript",
    "Python",
    "Java",
    "Go",
    "Rust",
    "C++",
    "C",
    "PHP",
    "Ruby",
    "Swift",
    "Kotlin"
  ]);

  const supportedFocus = new Set(["Security", "Performance", "Readability", "All"]);

  if (!supportedLanguages.has(language)) {
    return res.status(400).json({ error: "Unsupported language. Supported languages: JavaScript, TypeScript, Python, Java, Go, Rust, C++, C, PHP, Ruby, Swift, Kotlin." });
  }

  if (!code.trim()) {
    return res.status(400).json({ error: "Code is required." });
  }

  if (code.length > 4000) {
    return res.status(400).json({ error: "Code exceeds 4000 character limit. Please paste a smaller snippet." });
  }

  try {
    const review = await generateReview({ code, language, focus: supportedFocus.has(focus) ? focus : "All" });
    return res.status(200).json(review);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: "Review parsing failed. Please try again." });
    }

    return res.status(500).json({ error: "Failed to generate review.", details: error instanceof Error ? error.message : String(error) });
  }
}

async function parseJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}
