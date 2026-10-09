import { Router } from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import { reviewRateLimit } from "../middleware/rateLimit.js";
import { runReview } from "../graph/reviewGraph.js";
import { makeGroqLLM } from "../graph/llm.js";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });

const langSmithClient =
  process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_PROJECT
    ? new Client({
        apiKey: process.env.LANGSMITH_API_KEY,
        apiUrl: process.env.LANGSMITH_ENDPOINT,
        tracingMode: "langsmith"
      })
    : null;

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

// Same response shape the frontend already uses (plus two extra fields it can ignore)
function normalizeReview(review) {
  return {
    overallScore: Number.isFinite(review?.overallScore) ? review.overallScore : 0,
    criticalIssues: Array.isArray(review?.criticalIssues) ? review.criticalIssues : [],
    codeQuality: Array.isArray(review?.codeQuality) ? review.codeQuality : [],
    performanceSuggestions: Array.isArray(review?.performanceSuggestions) ? review.performanceSuggestions : [],
    bestPractices: Array.isArray(review?.bestPractices) ? review.bestPractices : [],
    positiveHighlights: Array.isArray(review?.positiveHighlights) ? review.positiveHighlights : [],
    agentsRun: Array.isArray(review?.agentsRun) ? review.agentsRun : [],
    workflowTrace: Array.isArray(review?.workflowTrace) ? review.workflowTrace : []
  };
}

// The Groq client is created on the first request, so the server can still start without a key
let groqLLM = null;
const defaultLLM = (args) => (groqLLM ??= makeGroqLLM())(args);

export function createReviewRouter({ llm = defaultLLM } = {}) {
  const reviewRouter = Router();

  // Multi-agent LangGraph workflow: router -> 4 agents (parallel) -> merger -> verifier (loop) -> report
  async function generateReviewBase({ code, language, focus }) {
    const review = await runReview({ code, language, focus }, { llm });
    return normalizeReview(review);
  }

  const generateReview = langSmithClient
    ? traceable(generateReviewBase, {
        name: "multi-agent-code-review",
        run_type: "chain",
        client: langSmithClient,
        project_name: process.env.LANGSMITH_PROJECT,
        processInputs: ({ code, language, focus }) => ({
          codeLength: code.length,
          language,
          focus
        })
      })
    : generateReviewBase;

  reviewRouter.post("/", reviewRateLimit, async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const language = typeof req.body?.language === "string" ? req.body.language : "";
    const focus = supportedFocus.has(req.body?.focus) ? req.body.focus : "All";

    if (!supportedLanguages.has(language)) {
      return res.status(400).json({
        error: "Unsupported language. Supported languages: JavaScript, TypeScript, Python, Java, Go, Rust, C++, C, PHP, Ruby, Swift, Kotlin."
      });
    }

    if (!code.trim()) {
      return res.status(400).json({ error: "Code is required." });
    }

    if (code.length > 4000) {
      return res.status(400).json({ error: "Code exceeds 4000 character limit. Please paste a smaller snippet." });
    }

    try {
      const review = await generateReview({ code, language, focus });
      return res.json(review);
    } catch (error) {
      return res.status(500).json({
        error: "Failed to generate review.",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return reviewRouter;
}

export default createReviewRouter();
