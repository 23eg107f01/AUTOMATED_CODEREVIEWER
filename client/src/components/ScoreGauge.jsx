function getGaugeColor(score) {
  if (score >= 85) {
    return "#2dd4bf";
  }

  if (score >= 70) {
    return "#a3e635";
  }

  if (score >= 50) {
    return "#f59e0b";
  }

  return "#f97316";
}

export default function ScoreGauge({ score }) {
  const clampedScore = Math.max(0, Math.min(100, Number(score) || 0));
  const color = getGaugeColor(clampedScore);

  return (
    <div className="score-gauge" style={{ "--score": `${clampedScore}%`, "--score-color": color }}>
      <div className="score-gauge__ring">
        <div className="score-gauge__center">
          <span className="score-gauge__value">{clampedScore}</span>
          <span className="score-gauge__label">Overall score</span>
        </div>
      </div>
    </div>
  );
}
