import Editor from "@monaco-editor/react";

const monacoLanguages = {
  JavaScript: "javascript",
  TypeScript: "typescript",
  Python: "python",
  Java: "java",
  Go: "go",
  Rust: "rust",
  "C++": "cpp",
  C: "c",
  PHP: "php",
  Ruby: "ruby",
  Swift: "swift",
  Kotlin: "kotlin"
};

export default function CodeEditor({
  code,
  onCodeChange,
  language,
  onLanguageChange,
  focus,
  onFocusChange,
  languageOptions,
  focusOptions,
  maxCodeChars,
  codeLength,
  onReview,
  overLimit,
  loading
}) {
  const progress = Math.min((codeLength / maxCodeChars) * 100, 100);

  return (
    <div className="editor-stack">
      <div className="card-heading">
        <div>
          <h2>Your code</h2>
          <p>Paste the code you want the AI to review.</p>
        </div>
      </div>

      <div className="toolbar-row">
        <div className="select-block">
          <label htmlFor="language">Language</label>
          <select id="language" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
            {languageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="select-block">
          <label htmlFor="focus">Review focus</label>
          <select id="focus" value={focus} onChange={(event) => onFocusChange(event.target.value)}>
            {focusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

      </div>

      <div className="editor-card">
        <Editor
          height="min(520px, 52vh)"
          language={monacoLanguages[language] || "javascript"}
          value={code}
          theme="vs-dark"
          onChange={(value) => onCodeChange(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 18, bottom: 18 }
          }}
        />
      </div>

      <div className="editor-footer">
        <div className="counter-wrap">
          <div className="counter-row">
            <span className={overLimit ? "helper-text warning" : "helper-text"} aria-live="polite">
              {codeLength.toLocaleString()} / {maxCodeChars.toLocaleString()} characters
            </span>
            <span className="counter-label">No uploads</span>
          </div>
          <div className={`progress-track${overLimit ? " is-over" : ""}`} aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button className="primary-button" type="button" onClick={onReview} disabled={loading || overLimit}>
          {loading ? <><span className="spinner" aria-hidden="true" /> Reviewing code...</> : <><span aria-hidden="true">✦</span> Review code</>}
        </button>
      </div>
    </div>
  );
}
