import { useState } from "react";
import CodeEditor from "./components/CodeEditor.jsx";
import ReviewPanel from "./components/ReviewPanel.jsx";
import Disclaimer from "./components/Disclaimer.jsx";

const languageOptions = [
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
];

const focusOptions = ["Security", "Performance", "Readability", "All"];
const maxCodeChars = 4000;
const initialCode = `function greet(name) {
  if (!name) {
    return "Hello, stranger";
  }

  return "Hello, " + name.trim();
}`;

async function postReview(code, language, focus) {
  const requestTargets = ["/api/review"];

  if (import.meta.env.DEV) {
    requestTargets.push("http://localhost:3001/api/review");
  }

  let lastError = null;

  for (const target of requestTargets) {
    try {
      return await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ code, language, focus })
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Review request failed.");
}

function reviewToMarkdown(review, language, focus) {
  const stringifyItems = (items) =>
    items
      .map((item) =>
        typeof item === "string"
          ? `- ${item}`
          : `- **${item.title || "Finding"}**: ${item.description || ""}${item.severity ? ` (${item.severity})` : ""}`
      )
      .join("\n");

  return [
    "# Automated Code Review",
    `- Language: ${language}`,
    `- Focus: ${focus}`,
    `- Overall Score: ${review.overallScore}`,
    "",
    "## Critical Issues",
    stringifyItems(review.criticalIssues || []) || "- None",
    "",
    "## Code Quality",
    stringifyItems(review.codeQuality || []) || "- None",
    "",
    "## Performance Suggestions",
    stringifyItems(review.performanceSuggestions || []) || "- None",
    "",
    "## Best Practices & Improvements",
    stringifyItems(review.bestPractices || []) || "- None",
    "",
    "## Positive Highlights",
    stringifyItems(review.positiveHighlights || []) || "- None"
  ].join("\n");
}

export default function App() {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState("JavaScript");
  const [focus, setFocus] = useState("All");
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const codeLength = code.length;
  const overLimit = codeLength > maxCodeChars;

  async function handleReview() {
    if (overLimit) {
      setError("Code exceeds 4000 character limit. Please paste a smaller snippet.");
      return;
    }

    if (!code.trim()) {
      setError("Paste code before requesting a review.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await postReview(code, language, focus);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Review request failed.");
      }

      setReview(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Review request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!review) {
      return;
    }

    const markdown = reviewToMarkdown(review, language, focus);
    await navigator.clipboard.writeText(markdown);
  }

  function handleExport() {
    if (!review) {
      return;
    }

    const markdown = reviewToMarkdown(review, language, focus);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `code-review-${language.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="app-frame">
        <header className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">AI code review workspace</p>
            <h1>Review code with structured feedback in seconds.</h1>
            <p className="hero-text">
              Paste a snippet, pick a language, choose a review focus, and get a concise review covering
              bugs, security, readability, performance, and what is already working well.
            </p>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <span>Code limit</span>
              <strong>4000 chars</strong>
            </div>
            <div className="stat-card">
              <span>Model</span>
              <strong>llama-3.3-70b-versatile</strong>
            </div>
            <div className="stat-card">
              <span>Output</span>
              <strong>Structured JSON</strong>
            </div>
          </div>
        </header>

        <Disclaimer />

        <section className="workspace-grid">
          <div className="surface panel-left">
            <CodeEditor
              code={code}
              onCodeChange={setCode}
              language={language}
              onLanguageChange={setLanguage}
              focus={focus}
              onFocusChange={setFocus}
              languageOptions={languageOptions}
              focusOptions={focusOptions}
              maxCodeChars={maxCodeChars}
              codeLength={codeLength}
              onReview={handleReview}
              overLimit={overLimit}
              loading={loading}
            />
            {error ? <div className="inline-error">{error}</div> : null}
          </div>

          <div className="surface panel-right">
            <ReviewPanel
              review={review}
              loading={loading}
              onCopy={handleCopy}
              onExport={handleExport}
              language={language}
              focus={focus}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
