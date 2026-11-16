# Djzariyya

Flashcards and multiple-choice quizzes for learning Algerian Darija.

- **Flashcards** and **Quiz** modes
- Study the whole word bank or any mix of categories
- Darija → English or English → Darija
- Quizzes of all selected words or any number you type in; four options per question,
  with wrong answers drawn fresh each time from the categories you selected

A Python server (FastAPI) serves the word bank API and the web page. The web
page is plain JavaScript, built with Vite.

## Requirements

- Python 3.12+ and [uv](https://docs.astral.sh/uv/) to run the server
- Node 22+ to build the front end

## Run it

```bash
uv sync           # Python dependencies, exact versions from uv.lock
npm ci            # Node dependencies, exact versions from package-lock.json
```

**Production style** (one process serves everything on http://localhost:8000):

```bash
npm run build
uv run python -m server
```

**Development** (hot reload on both sides; open http://localhost:5173):

```bash
uv run uvicorn server.main:app --reload    # terminal 1: API on port 8000
npm run dev                                # terminal 2: front end, forwards /api to 8000
```

## Commands

| Command                        | What it does                                        |
| ------------------------------ | --------------------------------------------------- |
| `uv run python -m server`      | Run the server (API + built front end)              |
| `uv run pytest`                | Server tests                                        |
| `uv run ruff check .`          | Python lint                                         |
| `uv run ruff format --check .` | Python formatting check                             |
| `npm run dev`                  | Front-end dev server                                |
| `npm run lint`                 | JavaScript lint (ESLint)                            |
| `npm test`                     | Front-end logic + word bank data tests (Vitest)     |
| `npm run build`                | Build the front end into `dist/`                    |
| `npm run check`                | JavaScript lint → test → build in one go            |

## Configuration

All configuration is by environment variable.

| Variable        | Default              | Purpose                                                        |
| --------------- | -------------------- | -------------------------------------------------------------- |
| `HOST`          | `127.0.0.1`          | Address to listen on. **Set `0.0.0.0` inside a container.**    |
| `PORT`          | `8000`               | Port to listen on                                              |
| `COMMIT_SHA`    | `dev`                | Shown in the footer and at `/api/version`                      |
| `WORDBANK_PATH` | `data/wordbank.json` | Word bank file to serve                                        |
| `STATIC_DIR`    | `dist`               | Folder containing the built front end                          |

## Endpoints

| Route               | Returns                                        |
| ------------------- | ---------------------------------------------- |
| `GET /`             | The web app                                    |
| `GET /api/wordbank` | The word bank (categories and words) as JSON   |
| `GET /api/version`  | `{ "version", "commit" }`                      |
| `GET /healthz`      | `{ "status": "ok" }`, for health probes        |

## Operations

- **Logs:** one JSON object per line on stdout (requests, startup, shutdown).
  Health probe requests are not logged.
- **Shutdown:** on `SIGTERM`/`SIGINT` the server stops accepting connections,
  finishes in-flight requests and exits.
- **Startup:** the server exits with an error if the word bank file is missing
  or malformed. If `dist/` is missing it logs a warning and serves the API only.
- **State:** none. Any number of copies can run side by side.
- **Version:** `pyproject.toml` is the source of truth; keep `package.json` in step.

## Adding words

Everything lives in [`data/wordbank.json`](data/wordbank.json). No code changes
are needed: add a word to a category, or add a new category, and restart the
server.

```json
{ "en": ["Sofa", "Couch"], "darija": ["Kanapé", "Sofa"], "note": "optional" }
```

- `en` / `darija`: one or more accepted variants
- `note` (optional): feminine/plural forms or usage hints, shown on flashcards

`npm test` validates the file (shape, duplicates, unique category ids), so a
bad entry fails before it ships.

## Layout

```
data/wordbank.json   the word bank (edit this to add words)
server/              Python server
  app.py             routes, request logging, static files
  config.py          settings from environment variables
  logs.py            JSON log format
  main.py            ASGI entry point (uvicorn server.main:app)
  __main__.py        production entry point (python -m server)
index.html
src/                 front end
  main.js            UI: screens, state, events; loads data from the API
  style.css
  lib/               pure logic, no DOM: shuffle, deck building, quiz generation
tests/
  test_server.py     server tests (pytest)
  *.test.js          front-end logic and word bank data tests (Vitest)
docs/build_notes.md  decisions, open questions and build log
pyproject.toml, uv.lock          Python project and lockfile
package.json, package-lock.json  Node project and lockfile
```
