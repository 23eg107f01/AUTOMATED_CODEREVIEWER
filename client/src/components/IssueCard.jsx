export default function IssueCard({ title, description, badge, tone = "neutral" }) {
  return (
    <article className={`issue-card issue-card--${tone}`}>
      <div className="issue-card__head">
        <h4>{title}</h4>
        {badge ? <span className="issue-card__badge">{badge}</span> : null}
      </div>
      <p>{description}</p>
    </article>
  );
}
