# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

This is a two-tier web application (AI virtual character dialogue system) with a Python FastAPI backend and a React/TypeScript/Vite frontend. See `README.md` for full details.

### Services

| Service | Port | Start command | Working directory |
|---|---|---|---|
| FastAPI backend | 8000 | `source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | `backend/` |
| Vite frontend | 5173 | `npm run dev` | `frontend/` |

### Non-obvious caveats

- **Backend venv**: The backend Python virtual environment lives at `backend/venv/`. Always activate it before running backend commands.
- **Backend .env**: A `.env` file must exist in `backend/` for the server to start. Copy from `.env.example` and set at minimum `OPENAI_API_KEY` or `GEMINI_API_KEY` for chat functionality. Without a valid key, the server starts fine but chat requests return errors.
- **Graph memory (Neo4j)**: Disabled by default (`GRAPH_MEMORY_ENABLED=false`). The app works fully without it; enable only if Neo4j credentials are available.
- **GPT-SoVITS (TTS)**: Optional external service on port 9880. Chat text works without it; TTS calls fail gracefully.
- **SQLite database**: Auto-created at `backend/epsilon.db` on first startup. No manual migration needed.
- **ESLint**: The `npm run lint` script is defined in `frontend/package.json` but the ESLint configuration file (`.eslintrc.*`) is missing from the repository. Lint will fail until the config is added.
- **TypeScript strict mode**: `tsc --noEmit` reports pre-existing type errors in the codebase. The Vite build (`npm run build`) succeeds because it does not run `tsc` in strict mode by default (the `build` script chains `tsc && vite build`, but Vite's own transform is more lenient).
- **Frontend proxy**: Vite proxies `/api` requests to `http://localhost:8000`. The backend must be running for API calls to work from the frontend.
- **`python3.12-venv`**: The system package `python3.12-venv` must be installed for `python3 -m venv` to work. The update script handles this.
