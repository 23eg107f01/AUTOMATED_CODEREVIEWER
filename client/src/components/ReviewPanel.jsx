import ScoreGauge from "./ScoreGauge.jsx";
import IssueCard from "./IssueCard.jsx";

function renderItems(items, tone) {
  if (!items || !items.length) {
    return <p className="empty-note">No items reported in this section.</p>;
  }

  return (
    <div className="section-grid">
      {items.map((item, index) => {
        const title = typeof item === "string" ? `Item ${index + 1}` : item.title || `Item ${index + 1}`;
        const description = typeof item === "string" ? item : item.description || "";
        const badge = typeof item === "string" ? null : item.severity || item.level || null;

        return <IssueCard key={`${title}-${index}`} title={title} description={description} badge={badge} tone={tone} />;
      })}
    </div>
  );
}

function ReviewSection({ title, items, tone }) {
  return (
    <section className="review-section">
      <h3>{title}</h3>
      {renderItems(items, tone)}
    </section>
  );
}

export default function ReviewPanel({ review, loading, onCopy, onExport, language, focus }) {
  return (
    <div className="review-stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">AI Review Output</p>
          <h2>Structured feedback</h2>
          <p className="panel-subtitle">
            {review ? `Language: ${language} · Focus: ${focus}` : "Run a review to populate this panel."}
          </p>
        </div>

        <div className="action-row">
          <button type="button" className="ghost-button" onClick={onCopy} disabled={!review || loading}>
            Copy
          </button>
          <button type="button" className="ghost-button" onClick={onExport} disabled={!review || loading}>
            Export Markdown
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-card">
          <div className="loading-line loading-line--wide" />
          <div className="loading-line" />
          <div className="loading-line" />
          <div className="loading-line loading-line--wide" />
        </div>
      ) : review ? (
        <div className="review-content">
          <div className="score-row">
            <ScoreGauge score={review.overallScore} />
            <div className="summary-card">
              <h3>Snapshot</h3>
              <p>
                The score reflects how well the code balances correctness, maintainability, and the selected review
                focus.
              </p>
            </div>
          </div>

          <ReviewSection title="Critical Issues" items={review.criticalIssues} tone="danger" />
          <ReviewSection title="Code Quality" items={review.codeQuality} tone="neutral" />
          <ReviewSection title="Performance Suggestions" items={review.performanceSuggestions} tone="amber" />
          <ReviewSection title="Best Practices & Improvements" items={review.bestPractices} tone="blue" />
          <ReviewSection title="Positive Highlights" items={review.positiveHighlights} tone="success" />
        </div>
      ) : (
        <div className="empty-state">
          <h3>No review yet</h3>
          <p>Enter code on the left, choose a review focus, and generate a structured AI review.</p>
        </div>
      )}
    </div>
  );
}
