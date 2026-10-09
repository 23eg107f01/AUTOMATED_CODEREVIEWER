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

function getReviewApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_REVIEW_API_BASE_URL;
  if (typeof configuredUrl === "string" && configuredUrl.trim()) {
    return configuredUrl.replace(/\/$/, "");
  }

  return "";
}

async function postReview(code, language, focus) {
  const apiBaseUrl = getReviewApiBaseUrl();
  const requestTargets = apiBaseUrl ? [`${apiBaseUrl}/api/review`] : ["/api/review"];

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
  const [copied, setCopied] = useState(false);

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
        const detail = data.details ? ` ${data.details}` : "";
        throw new Error(`${data.error || "Review request failed."}${detail}`.trim());
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
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Review could not be copied. Please try again.");
    }
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
      <main className="app-frame">
        <header className="topbar">
          <a className="brand" href="/" aria-label="AI Code Review home">
            <span className="brand-mark" aria-hidden="true">⌘</span>
            <span>CodeReview<span className="brand-accent">AI</span></span>
          </a>
          <div className="topbar-meta">
            <span className="status-dot" aria-hidden="true" />
            <span>Private workspace</span>
          </div>
        </header>

        <section className="intro">
          <div>
            <p className="eyebrow">AI code review</p>
            <h1>AI Code Reviewer</h1>
            <p className="hero-text">
              Find bugs, security issues and improvements before they reach production.
            </p>
          </div>
          <div className="workflow" aria-label="Review workflow">
            <div className="workflow-step"><span>01</span><strong>Paste code</strong></div>
            <div className="workflow-line" aria-hidden="true" />
            <div className="workflow-step"><span>02</span><strong>Choose focus</strong></div>
            <div className="workflow-line" aria-hidden="true" />
            <div className="workflow-step"><span>03</span><strong>Get insights</strong></div>
          </div>
        </section>

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
          </div>

          <div className="surface panel-right">
            <ReviewPanel
              review={review}
              loading={loading}
              onCopy={handleCopy}
              onExport={handleExport}
              error={error}
              onRetry={handleReview}
              copied={copied}
              language={language}
              focus={focus}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
