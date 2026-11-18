FROM node:22-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html  vite.config.js ./
COPY src ./src
RUN npm run build

FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev
COPY server ./server
COPY data ./data
COPY --from=frontend /app/dist ./dist
RUN useradd --create-home app
USER app
ARG COMMIT_SHA=dev
ENV COMMIT_SHA=$COMMIT_SHA
ENV PATH="/app/.venv/bin:$PATH" HOST=0.0.0.0 PORT=8000
EXPOSE 8000
CMD ["python", "-m", "server"]
