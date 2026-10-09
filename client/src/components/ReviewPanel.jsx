import ScoreGauge from "./ScoreGauge.jsx";
import IssueCard from "./IssueCard.jsx";

const sections = [
  { key: "criticalIssues", title: "Bugs & critical issues", category: "Bugs", tone: "danger" },
  { key: "codeQuality", title: "Readability & code quality", category: "Readability", tone: "neutral" },
  { key: "performanceSuggestions", title: "Performance", category: "Performance", tone: "amber" },
  { key: "bestPractices", title: "Best practices & improvements", category: "Improvements", tone: "blue" },
  { key: "positiveHighlights", title: "What you're doing well", category: "Positive", tone: "success" }
];

function getItems(review, key) {
  return Array.isArray(review?.[key]) ? review[key] : [];
}

function getFinding(item, index) {
  if (typeof item === "string") {
    return { title: "Highlight", description: item, badge: null };
  }

  return {
    title: item?.title || `Finding ${index + 1}`,
    description: item?.description || "",
    badge: item?.severity || item?.level || null
  };
}

function getStatus(score) {
  return Number(score) >= 75 ? "Good shape" : "Needs attention";
}

function ReviewSection({ title, category, items, tone }) {
  if (!items.length) {
    return null;
  }

  return (
    <details className="review-section" open>
      <summary className="review-section__summary">
        <span>
          <h3>{title}</h3>
          <span className="section-count">{items.length} {items.length === 1 ? "finding" : "findings"}</span>
        </span>
        <span className="section-chevron" aria-hidden="true" />
      </summary>
      <div className="section-grid">
        {items.map((item, index) => {
          const finding = getFinding(item, index);
          return (
            <IssueCard
              key={`${finding.title}-${index}`}
              item={item}
              title={finding.title}
              description={finding.description}
              badge={finding.badge}
              category={category}
              tone={tone}
            />
          );
        })}
      </div>
    </details>
  );
}

export default function ReviewPanel({
  review,
  loading,
  error,
  onRetry,
  onCopy,
  onExport,
  copied,
  language,
  focus
}) {
  const findingCount = sections
    .filter(({ key }) => key !== "positiveHighlights")
    .reduce((total, { key }) => total + getItems(review, key).length, 0);
  const positiveCount = getItems(review, "positiveHighlights").length;

  return (
    <div className="review-stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">AI review</p>
          <h2>{review ? "Your code review" : "Ready when you are"}</h2>
          <p className="panel-subtitle">
            {review ? `${language} · ${focus}` : "Run a review to populate this panel."}
          </p>
        </div>
        <div className="action-row">
          <button type="button" className="icon-button" onClick={onCopy} disabled={!review || loading} title="Copy full review" aria-label={copied ? "Review copied" : "Copy full review"}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="icon-button" onClick={onExport} disabled={!review || loading} title="Export review as Markdown">
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-card review-loading" aria-label="Loading review" role="status">
          <div className="loading-overview">
            <div className="loading-circle" />
            <div className="loading-copy"><div className="loading-line loading-line--short" /><div className="loading-line" /><div className="loading-line loading-line--wide" /></div>
          </div>
          <div className="loading-line loading-line--wide" />
          <div className="loading-finding"><div className="loading-line" /><div className="loading-line loading-line--wide" /></div>
          <div className="loading-finding"><div className="loading-line loading-line--short" /><div className="loading-line" /></div>
        </div>
      ) : error ? (
        <div className="review-error" role="alert">
          <div className="review-error__icon" aria-hidden="true">!</div>
          <div>
            <h3>Review couldn't be generated</h3>
            <p>Something went wrong while reviewing your code. Please try again.</p>
            <button type="button" className="retry-button" onClick={onRetry}>Try again</button>
          </div>
        </div>
      ) : review ? (
        <div className="review-content review-content--revealed">
          <div className="review-overview">
            <div className="score-row">
              <ScoreGauge score={review.overallScore} />
              <div className="summary-card">
                <span className="section-kicker">Overall health</span>
                <h3>{getStatus(review.overallScore)}</h3>
                <p>
                  {findingCount
                    ? `${findingCount} ${findingCount === 1 ? "finding was" : "findings were"} returned across the review categories.`
                    : "No issues were returned in the review categories."}
                </p>
              </div>
            </div>
            <div className="review-counts" aria-label="Review overview">
              {sections
                .filter(({ key }) => key !== "positiveHighlights" && getItems(review, key).length)
                .map(({ key, category, tone }) => (
                  <div className={`review-count review-count--${tone}`} key={key}>
                    <span>{getItems(review, key).length}</span>
                    <small>{category}</small>
                  </div>
                ))}
              {positiveCount ? (
                <div className="review-count review-count--success">
                  <span>{positiveCount}</span>
                  <small>Positive</small>
                </div>
              ) : null}
            </div>
          </div>

          <div className="review-sections">
            {sections.map((section) => (
              <ReviewSection
                key={section.key}
                title={section.title}
                category={section.category}
                tone={section.tone}
                items={getItems(review, section.key)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">✦</div>
          <h3>Ready for your first review</h3>
          <p>Paste your code and run a review to see feedback here.</p>
          <div className="category-preview" aria-label="Review categories">
            <span>Bugs</span><span>Performance</span><span>Readability</span><span>Improvements</span>
          </div>
        </div>
      )}
    </div>
  );
}
