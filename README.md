# Interactive Code Interviewer

Monorepo with a React (Vite) frontend and an Express backend.

## Prerequisites

- Node.js 18+ (recommend using the same version across the team)
- npm 9+

## Setup

```bash
npm install
```

Create a `.env` file for the API server (in `apps/api`):

```bash
OPENAI_API_KEY=your_key_here
```

## Development

Run the API:

```bash
npm run dev:api
```

Run the web app:

```bash
npm run dev
```

By default:

- Web: `http://localhost:5173`
- API: `http://localhost:3001`

## Production Build

Build the web app:

```bash
npm run build
```

Start the API (production):

```bash
npm run start:api
```

## Project Structure

```
interactive-code-interviewer/
  apps/
    web/   # React + Vite frontend
    api/   # Express backend
```

## Configuration

Set frontend API base URL (optional):

```bash
VITE_API_BASE_URL=http://localhost:3001
```
