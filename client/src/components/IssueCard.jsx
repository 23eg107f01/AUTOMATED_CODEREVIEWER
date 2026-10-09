function firstValue(item, keys) {
  if (!item || typeof item === "string") {
    return null;
  }

  return keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && String(value).trim());
}

export default function IssueCard({ item, title, description, badge, category, tone = "neutral" }) {
  const line = firstValue(item, ["line", "lineNumber", "line_number"]);
  const reference = firstValue(item, ["codeReference", "location", "file"]);
  const suggestion = firstValue(item, ["suggestion", "recommendation", "fix", "codeSuggestion"]);
  const code = firstValue(item, ["code", "suggestedCode", "replacement"]);
  const normalizedBadge = badge || (tone === "success" ? "Positive" : null);
  const severityClass = normalizedBadge
    ? ` issue-card__badge--${String(normalizedBadge).toLowerCase().replace(/\s+/g, "-")}`
    : "";

  return (
    <details className={`issue-card issue-card--${tone}`} open>
      <summary className="issue-card__summary">
      <div className="issue-card__head">
        <div className="issue-card__title-wrap">
          <h4>{title}</h4>
          {category ? <span className="issue-card__category">{category}</span> : null}
        </div>
        {normalizedBadge ? <span className={`issue-card__badge${severityClass}`}>{normalizedBadge}</span> : null}
      </div>
      </summary>
      <div className="issue-card__body">
        <p>{description}</p>
        {line || reference ? (
          <div className="issue-card__reference">
            {line ? <span>Line {line}</span> : null}
            {reference ? <code>{reference}</code> : null}
          </div>
        ) : null}
        {suggestion ? (
          <div className="issue-card__suggestion">
            <span className="issue-card__label">Suggested fix</span>
            <p>{suggestion}</p>
          </div>
        ) : null}
        {code ? (
          <div className="issue-card__code-wrap">
            <div className="issue-card__code-head">
              <span className="issue-card__label">Code suggestion</span>
              <button
                type="button"
                className="copy-fix-button"
                onClick={() => navigator.clipboard.writeText(String(code))}
              >
                Copy fix
              </button>
            </div>
            <pre><code>{code}</code></pre>
          </div>
        ) : null}
      </div>
    </details>
  );
}
