// Multi-agent code review workflow built with LangGraph.js
// Flow: router -> (security | performance | bugs | style, in parallel) -> aggregator -> verifier -> report
// The verifier can send wrong findings back to the agent that made them (max 2 retries).

import { StateGraph, Annotation, Send, START, END } from "@langchain/langgraph";

export const MAX_RETRIES = 2;
const SEVERITIES = ["critical", "high", "medium", "low"];
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const PENALTY = { critical: 20, high: 12, medium: 6, low: 2 };

const JSON_RULES = `Reply with JSON only, no extra text, in this shape:
{"findings":[{"title":"short title","severity":"critical|high|medium|low","line":12,"detail":"what is wrong","fix":"how to fix it"}],"positives":["one good thing about the code"]}
Only report problems you can point to in the code. If you find nothing, return an empty findings list.`;

const AGENT_PROMPTS = {
  security: `You are the SECURITY agent. Look for security problems: injection, unsafe input handling, hard-coded secrets, weak auth, unsafe eval. ${JSON_RULES}`,
  performance: `You are the PERFORMANCE agent. Look for slow code: needless loops, repeated work, blocking calls, memory waste. ${JSON_RULES}`,
  bugs: `You are the BUG agent. Look for logic errors, missing checks, wrong conditions, unhandled errors, null problems. ${JSON_RULES}`,
  style: `You are the STYLE agent. Look for naming, readability, structure, duplication and best-practice problems. ${JSON_RULES}`,
};

const FOCUS_TO_AGENTS = {
  all: ["security", "performance", "bugs", "style"],
  security: ["security"],
  performance: ["performance"],
  bugs: ["bugs"],
  style: ["style"],
  readability: ["style"],
  "best practices": ["style"],
  "code quality": ["bugs", "style"],
};

const concat = { reducer: (a, b) => a.concat(b), default: () => [] };

const ReviewState = Annotation.Root({
  code: Annotation(),
  language: Annotation(),
  focus: Annotation(),
  selectedAgents: Annotation(),
  rawFindings: Annotation(concat),
  positives: Annotation(concat),
  rejectedIds: Annotation(concat),
  verifiedIds: Annotation(concat),
  merged: Annotation(),
  retryCount: Annotation({ reducer: (_, b) => b, default: () => 0 }),
  retryPlan: Annotation(),
  failures: Annotation(concat),
  trace: Annotation(concat),
  report: Annotation(),
});

function parseJSON(text) {
  const clean = String(text ?? "").replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const a = clean.indexOf("{");
    const b = clean.lastIndexOf("}");
    if (a !== -1 && b > a) return JSON.parse(clean.slice(a, b + 1));
    throw new Error("Model did not return valid JSON");
  }
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const isSerious = (f) => f.severity === "critical" || f.severity === "high";
const describe = (f) =>
  `${f.detail}${f.line ? ` (line ${f.line})` : ""}${f.fix ? ` Fix: ${f.fix}` : ""}`.trim();
const toIssue = (f) => ({ title: f.title, description: describe(f) });
const toCritical = (f) => ({ title: f.title, description: describe(f), severity: f.severity });

/**
 * llm: async ({ system, user }) => string   (see llm.js for the Groq version)
 */
export function buildReviewGraph({ llm }) {
  // 1. Router: decide which specialist agents are needed
  const router = async (state) => {
    const key = norm(state.focus || "all");
    const agents = FOCUS_TO_AGENTS[key] ?? FOCUS_TO_AGENTS.all;
    return { selectedAgents: agents, trace: [`router: focus "${state.focus}" -> ${agents.join(", ")}`] };
  };

  const fanOut = (state) =>
    state.selectedAgents.map(
      (agent) => new Send("specialist", { agent, code: state.code, language: state.language, feedback: "", attempt: 0 })
    );

  // 2. Specialist agent (runs once per selected agent, in parallel)
  const specialist = async ({ agent, code, language, feedback, attempt }) => {
    try {
      const user =
        `Language: ${language}\nAttempt: ${attempt}\n` +
        (feedback ? `Feedback from the verifier (fix these mistakes):\n${feedback}\n` : "") +
        `Code:\n${code}`;
      const out = parseJSON(await llm({ system: AGENT_PROMPTS[agent], user }));
      const findings = (out.findings ?? []).map((f, i) => ({
        id: `${agent}-${attempt}-${i}`,
        agent,
        title: String(f.title ?? "Issue"),
        severity: SEVERITIES.includes(norm(f.severity)) ? norm(f.severity) : "medium",
        line: Number.isFinite(Number(f.line)) ? Number(f.line) : null,
        detail: String(f.detail ?? ""),
        fix: String(f.fix ?? ""),
      }));
      return {
        rawFindings: findings,
        positives: (out.positives ?? []).map(String),
        trace: [`${agent} agent (attempt ${attempt}): ${findings.length} finding(s)`],
      };
    } catch (err) {
      // one agent failing must not crash the whole review
      return { failures: [agent], trace: [`${agent} agent (attempt ${attempt}): failed - ${err.message}`] };
    }
  };

  // 3. Aggregator: merge, remove repeats, rank by severity
  const aggregator = async (state) => {
    const rejected = new Set(state.rejectedIds);
    const seen = new Map();
    for (const f of state.rawFindings) {
      if (rejected.has(f.id)) continue;
      const key = `${norm(f.title)}|${f.line ?? ""}`;
      const old = seen.get(key);
      if (!old || SEVERITY_RANK[f.severity] < SEVERITY_RANK[old.severity]) seen.set(key, f);
    }
    const merged = [...seen.values()].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    return { merged, trace: [`aggregator: ${merged.length} unique finding(s) after merge`] };
  };

  // 4. Verifier: double-check serious findings against the code
  const verifier = async (state) => {
    const verified = new Set(state.verifiedIds);
    const toCheck = state.merged.filter((f) => isSerious(f) && !verified.has(f.id));
    const nextCount = state.retryCount + 1;
    if (toCheck.length === 0) {
      return { retryPlan: [], retryCount: nextCount, trace: ["verifier: no new serious findings to check"] };
    }
    let verdicts = [];
    try {
      const list = toCheck.map(({ id, title, line, detail }) => ({ id, title, line, detail }));
      const out = parseJSON(
        await llm({
          system:
            `You are the VERIFIER. For each finding, check the code and decide if the problem really exists. ` +
            `Reply with JSON only: {"verdicts":[{"id":"...","valid":true,"reason":"short reason"}]}`,
          user: `Language: ${state.language}\nCode:\n${state.code}\n\nFindings:\n${JSON.stringify(list)}`,
        })
      );
      verdicts = out.verdicts ?? [];
    } catch (err) {
      // if the verifier fails, keep the findings instead of dropping them
      return { retryPlan: [], retryCount: nextCount, verifiedIds: toCheck.map((f) => f.id), trace: [`verifier: failed - ${err.message}`] };
    }
    const bad = new Map(verdicts.filter((v) => v.valid === false).map((v) => [v.id, String(v.reason ?? "not supported by the code")]));
    const rejected = toCheck.filter((f) => bad.has(f.id));
    const good = toCheck.filter((f) => !bad.has(f.id));
    const byAgent = new Map();
    for (const f of rejected) {
      byAgent.set(f.agent, (byAgent.get(f.agent) ?? "") + `- "${f.title}" was rejected: ${bad.get(f.id)}\n`);
    }
    const retryPlan = [...byAgent].map(([agent, feedback]) => ({ agent, feedback }));
    return {
      rejectedIds: rejected.map((f) => f.id),
      verifiedIds: good.map((f) => f.id),
      retryPlan,
      retryCount: nextCount,
      trace: [`verifier (pass ${nextCount}): ${good.length} confirmed, ${rejected.length} rejected`],
    };
  };

  // Decision: go back to the agents, or finish
  const afterVerifier = (state) => {
    if (state.retryPlan.length > 0 && state.retryCount <= MAX_RETRIES) {
      return state.retryPlan.map(
        (p) => new Send("specialist", { agent: p.agent, code: state.code, language: state.language, feedback: p.feedback, attempt: state.retryCount })
      );
    }
    return "finalReport";
  };

  // 5. Report: build the final review (score is calculated by a fixed rule, not by the AI)
  const report = async (state) => {
    // if every agent failed (for example the API is down), do not return a fake "perfect" review
    if (state.failures.length >= state.selectedAgents.length && state.rawFindings.length === 0) {
      throw new Error("All review agents failed. Please try again.");
    }
    const rejected = new Set(state.rejectedIds);
    const final = state.merged.filter((f) => !rejected.has(f.id));
    const score = Math.max(0, 100 - final.reduce((sum, f) => sum + PENALTY[f.severity], 0));
    const serious = final.filter(isSerious);
    const rest = final.filter((f) => !isSerious(f));
    return {
      report: {
        overallScore: score,
        criticalIssues: serious.map(toCritical),
        codeQuality: rest.filter((f) => f.agent === "bugs" || f.agent === "security").map(toIssue),
        performanceSuggestions: rest.filter((f) => f.agent === "performance").map(toIssue),
        bestPractices: rest.filter((f) => f.agent === "style").map(toIssue),
        positiveHighlights: [...new Set(state.positives.map((p) => p.trim()).filter(Boolean))].slice(0, 5),
        agentsRun: state.selectedAgents,
        failedAgents: [...new Set(state.failures)],
        workflowTrace: [...state.trace, `report: score ${score}`],
      },
    };
  };

  return new StateGraph(ReviewState)
    .addNode("router", router)
    .addNode("specialist", specialist)
    .addNode("aggregator", aggregator)
    .addNode("verifier", verifier)
    .addNode("finalReport", report)
    .addEdge(START, "router")
    .addConditionalEdges("router", fanOut, ["specialist"])
    .addEdge("specialist", "aggregator")
    .addEdge("aggregator", "verifier")
    .addConditionalEdges("verifier", afterVerifier, ["specialist", "finalReport"])
    .addEdge("finalReport", END)
    .compile();
}

export async function runReview({ code, language, focus }, { llm }) {
  const graph = buildReviewGraph({ llm });
  const result = await graph.invoke({ code, language, focus });
  return result.report;
}
