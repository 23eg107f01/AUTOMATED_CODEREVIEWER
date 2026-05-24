# Automated Code Reviewer

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

The backend CORS policy is locked to localhost for development. Update the allowlist in `server/index.js` before deploying.
