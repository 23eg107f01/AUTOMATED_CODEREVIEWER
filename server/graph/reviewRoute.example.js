// Example: replace the single Groq call inside your existing POST /api/review handler.
// Keep your own validation (4000 char limit, language list, rate limit) exactly as it is.
import { runReview } from "./graph/reviewGraph.js";
import { makeGroqLLM } from "./graph/llm.js";

const llm = makeGroqLLM();

export async function reviewHandler(req, res) {
  const { code, language, focus = "All" } = req.body;   // already validated by your existing code
  try {
    const review = await runReview({ code, language, focus }, { llm });
    res.json(review);   // same fields: overallScore, criticalIssues, codeQuality, performanceSuggestions, bestPractices, positiveHighlights
  } catch (err) {
    console.error("review failed:", err.message);
    res.status(500).json({ error: "Review failed. Please try again." });
  }
}
