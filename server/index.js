import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import reviewRouter from "./routes/review.js";
import chromaRouter from "./routes/chroma.js";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is not set in .env");
}

const app = express();
const port = Number(process.env.PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../client/dist");
const allowedOrigins = new Set(
  [process.env.CLIENT_ORIGIN, process.env.CORS_ORIGINS]
    .flatMap((value) => (value ? value.split(",") : []))
    .map((value) => value.trim())
    .filter(Boolean)
);

app.set("trust proxy", 1);
app.use(express.json({ limit: "12kb" }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    }
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/review", reviewRouter);
app.use("/api/chroma", chromaRouter);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
