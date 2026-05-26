import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

export const config = {
  maxDuration: 10
};

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

function sanitizeHost(host) {
  if (!host) return null;
  if (/^https?:\/\//i.test(host)) return host.replace(/\/+$/g, "");
  return `https://${host.replace(/\/+$/g, "")}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { CHROMA_HOST, CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE } = process.env;

  if (!CHROMA_HOST || !CHROMA_API_KEY) {
    return res.status(400).json({ ok: false, error: "CHROMA_HOST and CHROMA_API_KEY must be set in environment" });
  }

  const base = sanitizeHost(CHROMA_HOST);
  const tryPaths = ["/", "/health", "/v1/collections", "/collections", "/api/collections", "/v1/collections?db=" + encodeURIComponent(CHROMA_DATABASE || "")];

  const headers = {
    "x-api-key": CHROMA_API_KEY,
    Authorization: `ApiKey ${CHROMA_API_KEY}`,
    "x-tenant-id": CHROMA_TENANT || ""
  };

  const results = [];

  for (const p of tryPaths) {
    const url = `${base.replace(/\/$/, "")}${p}`;
    try {
      const resp = await fetch(url, { method: "GET", headers });
      const text = await resp.text().catch(() => "");
      results.push({ url, status: resp.status, ok: resp.ok, snippet: text.slice(0, 1024) });

      if (resp.ok) {
        return res.json({ ok: true, url, status: resp.status, snippet: text.slice(0, 1024), database: CHROMA_DATABASE || null });
      }
    } catch (err) {
      results.push({ url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return res.status(502).json({ ok: false, error: "Chroma verification failed", tries: results });
}
