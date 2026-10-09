// Groq wrapper used by the graph. Same model your app already uses.
import Groq from "groq-sdk";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeGroqLLM({ apiKey = process.env.GROQ_API_KEY, model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile" } = {}) {
  const client = new Groq({ apiKey });
  return async ({ system, user }) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await client.chat.completions.create({
          model,
          temperature: 0.2,
          max_tokens: 1024,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        });
        return res.choices[0].message.content;
      } catch (err) {
        // Groq rate limit (429): wait a little and try once more
        if (err?.status === 429 && attempt === 0) {
          await sleep(2500);
          continue;
        }
        throw err;
      }
    }
  };
}
