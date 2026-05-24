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
  return (
    <div className="editor-stack">
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

        <div className="count-pill" aria-live="polite">
          {codeLength} / {maxCodeChars}
        </div>
      </div>

      <div className="editor-card">
        <Editor
          height="520px"
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
        <p className={overLimit ? "helper-text warning" : "helper-text"}>
          {overLimit
            ? "Code exceeds the 4000 character limit. Trim the snippet before reviewing."
            : "Monaco Editor is text-only. No file uploads are supported."}
        </p>
        <button className="primary-button" type="button" onClick={onReview} disabled={loading || overLimit}>
          {loading ? "Reviewing..." : "Generate Review"}
        </button>
      </div>
    </div>
  );
}
