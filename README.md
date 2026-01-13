# Interactive Code Interviewer

Prototype app for a live coding interview experience with a Monaco editor and a chat-based coach.

## Features
- Monaco editor with starter prompt
- Chat panel that sends code + conversation to the API
- Express API that proxies requests to OpenAI

## Prerequisites
- Node.js 18+
- An OpenAI API key

## Setup
1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `apps/api/.env` and set `OPENAI_API_KEY`.

## Development
Run web + API together:

```bash
npm run dev
```

Or run separately:

```bash
npm run dev:web
npm run dev:api
```

Web runs on `http://localhost:5173` by default. API runs on `http://localhost:3001`.

## Production
Build web + API:

```bash
npm run build
```

Start API:

```bash
npm run start
```

