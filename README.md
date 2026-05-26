# AUTOMATED

Repository: https://github.com/23eg107f01/AUTOMATED_CODEREVIEWER

A full-stack code review demo with a React + Vite frontend, an Express backend, and Groq-powered AI review generation.

## Stack

- React + Vite
- Monaco Editor
- Node.js + Express
- Groq SDK (`llama-3.3-70b-versatile`)

## Setup

1. Copy `.env.example` to `.env` and add `GROQ_API_KEY`.
2. Install dependencies from the project root:

```bash
npm install
```

3. Start both apps:

```bash
npm run dev
```

The frontend runs on Vite and proxies `/api` requests to the backend.

## Deployment

For a frontend-only Vercel deployment, use the `client` folder as the project root.

Set these environment variables as needed:

- `VITE_REVIEW_API_BASE_URL` - the public URL of the backend that serves `POST /api/review`
- `CLIENT_ORIGIN` - the public origin allowed to call the backend from browsers
- `CORS_ORIGINS` - optional comma-separated list of additional allowed origins

If you deploy the backend separately, make sure its CORS allowlist includes your Vercel domain.

## Backend API

`POST /api/review`

Request body:

```json
{
  "code": "const value = 1;",
  "language": "JavaScript",
  "focus": "All"
}
```

Response fields:

- `overallScore`
- `criticalIssues`
- `codeQuality`
- `performanceSuggestions`
- `bestPractices`
- `positiveHighlights`

## Limits

- Code input is capped at 4000 characters.
- Supported languages are limited to the review-safe set defined in the app.
- Review requests are rate-limited to 10 per minute per IP.
- Reviews are not stored.

## Production note

The backend CORS policy is now environment-driven. Set `CLIENT_ORIGIN` or `CORS_ORIGINS` before deploying the backend.
