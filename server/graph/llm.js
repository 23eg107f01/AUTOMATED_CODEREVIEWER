// Groq wrapper used by the graph. Same model your app already uses.
import Groq from "groq-sdk";

export function makeGroqLLM({ apiKey = process.env.GROQ_API_KEY, model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile" } = {}) {
  const client = new Groq({ apiKey });
  return async ({ system, user }) => {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return res.choices[0].message.content;
  };
}
