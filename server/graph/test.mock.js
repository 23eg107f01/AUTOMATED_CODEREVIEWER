// Runs the graph with a fake LLM (no API key needed). Run: node server/graph/test.mock.js
import assert from "node:assert/strict";
import { runReview, buildReviewGraph } from "./reviewGraph.js";

const CODE = `function login(user, pass) {\n  const q = "SELECT * FROM users WHERE name='" + user + "'";\n  return db.query(q);\n}`;

function mockLLM({ failAgent } = {}) {
  return async ({ system, user }) => {
    if (system.includes("SECURITY agent")) {
      if (user.includes("Attempt: 0"))
        return JSON.stringify({ findings: [
          { title: "SQL injection", severity: "high", line: 2, detail: "User input goes straight into the query.", fix: "Use a parameterised query." },
          { title: "Hard-coded secret", severity: "critical", line: 9, detail: "A secret key is in the code.", fix: "Move it to env vars." }, // wrong on purpose
        ], positives: ["Function is short and clear"] });
      return JSON.stringify({ findings: [{ title: "SQL injection", severity: "high", line: 2, detail: "Same problem.", fix: "Use a parameterised query." }], positives: [] });
    }
    if (system.includes("PERFORMANCE agent")) {
      if (failAgent === "performance") throw new Error("network error");
      return JSON.stringify({ findings: [{ title: "Query selects all columns", severity: "medium", line: 2, detail: "SELECT * is slow on big tables.", fix: "Select only needed columns." }], positives: [] });
    }
    if (system.includes("BUG agent"))
      return JSON.stringify({ findings: [{ title: "No error handling", severity: "high", line: 3, detail: "db.query can fail and nothing catches it.", fix: "Wrap in try/catch." }], positives: [] });
    if (system.includes("STYLE agent"))
      return JSON.stringify({ findings: [{ title: "Vague names", severity: "low", line: 1, detail: "pass and q are unclear.", fix: "Use password and sql." }], positives: ["Uses a function"] });
    if (system.includes("VERIFIER")) {
      const list = JSON.parse(user.split("Findings:\n")[1]);
      return JSON.stringify({ verdicts: list.map((f) => ({ id: f.id, valid: f.title !== "Hard-coded secret", reason: f.title === "Hard-coded secret" ? "No secret exists in this code" : "confirmed" })) });
    }
    throw new Error("unknown prompt");
  };
}

// Test 1: full run with the verifier loop
const r1 = await runReview({ code: CODE, language: "JavaScript", focus: "All" }, { llm: mockLLM() });
console.log(r1.workflowTrace.join("\n"));
console.log(JSON.stringify({ ...r1, workflowTrace: undefined }, null, 2));
assert.equal(r1.agentsRun.length, 4);
assert.ok(r1.workflowTrace.some((t) => t.includes("attempt 1")), "security agent should be re-run");
assert.ok(!r1.criticalIssues.some((i) => i.title === "Hard-coded secret"), "wrong finding must be removed");
assert.equal(r1.criticalIssues.filter((i) => i.title === "SQL injection").length, 1, "no duplicates");
assert.deepEqual(Object.keys(r1.criticalIssues[0]).sort(), ["description", "severity", "title"], "issue objects like the existing API");
assert.deepEqual(Object.keys(r1.performanceSuggestions[0]).sort(), ["description", "title"]);
assert.equal(r1.overallScore, 100 - 12 - 12 - 6 - 2);
for (const k of ["overallScore","criticalIssues","codeQuality","performanceSuggestions","bestPractices","positiveHighlights"]) assert.ok(k in r1, k);

// Test 2: one agent fails, the review still finishes
const r2 = await runReview({ code: CODE, language: "JavaScript", focus: "All" }, { llm: mockLLM({ failAgent: "performance" }) });
assert.ok(r2.workflowTrace.some((t) => t.includes("performance agent") && t.includes("failed")));
assert.equal(r2.performanceSuggestions.length, 0);

// Test 3: focus picks only one agent
const r3 = await runReview({ code: CODE, language: "JavaScript", focus: "Security" }, { llm: mockLLM() });
assert.deepEqual(r3.agentsRun, ["security"]);

// Test 4: the "Readability" focus from your frontend maps to the style agent
const r4 = await runReview({ code: CODE, language: "JavaScript", focus: "Readability" }, { llm: mockLLM() });
assert.deepEqual(r4.agentsRun, ["style"]);

// Test 5: if every agent fails, throw (no fake "perfect score")
await assert.rejects(
  runReview({ code: CODE, language: "JavaScript", focus: "All" }, { llm: async () => { throw new Error("API down"); } }),
  /All review agents failed/
);

// Diagram straight from the real graph
console.log("\n" + (await buildReviewGraph({ llm: mockLLM() }).getGraphAsync()).drawMermaid());
console.log("\nALL TESTS PASSED");
