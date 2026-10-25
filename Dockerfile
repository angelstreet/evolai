# Dockerfile for the EvolAI / AI Audit Studio web tier.
#
# Two stages:
#   * builder  \u2014 pnpm install + `pnpm --filter @evolai/web build`
#   * runtime  \u2014 the production Next.js server on port 3000.
#
# Postgres is intentionally NOT bundled here. Use docker-compose.yml
# (next to this Dockerfile) to run the stack \u2014 the API tier connects
# to the sidecar Postgres service via DATABASE_URL.
#
# Why no bundled Postgres in the production image:
#   * PRD \u00a717 calls for portable, single-tenant deployments; an
#     external Postgres is the simplest swap target when a tenant
#     chooses to bring their own.
#   * Keeping the API image stateless makes horizontal scaling
#     trivial (replicas behind a load balancer).
#
# Build:
#   docker build -t evolai-web:latest .
#
# Run:
#   docker run --rm -p 3000:3000 \
#     -e DATABASE_URL=postgres://auditai:auditai@db:5432/auditai \
#     evolai-web:latest

# ---- builder ---------------------------------------------------------
# Pinned to 22.23.4, the first 22.x carrying the CVE-2026-111497 fix
# (HTTP2Shell — an out-of-bounds write in the Brotli decoder Node vendors in
# node:zlib). The Node fix is a cherry-pick, not a version bump, so
# `node:20-bookworm-slim` and a floating `node:22-bookworm-slim` cannot be
# read as "patched" from the tag alone — the patch level is pinned on purpose.
FROM node:22.23.4-bookworm-slim AS builder
WORKDIR /repo
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .prettier* ./
COPY packages packages
COPY services services
COPY apps/web apps/web
COPY infra infra
COPY scripts scripts
COPY tsconfig.base.json eslint.config.mjs ./
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @evolai/web build

# ---- runtime ---------------------------------------------------------
FROM node:22.23.4-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate && \
    apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/packages packages
COPY --from=builder /repo/apps/web apps/web
COPY --from=builder /repo/services services
COPY --from=builder /repo/scripts scripts
COPY --from=builder /repo/infra infra
COPY --from=builder /repo/tsconfig.base.json /repo/eslint.config.mjs ./
RUN pnpm install --frozen-lockfile --prod \
    && pnpm --filter @evolai/web install --frozen-lockfile
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
    CMD curl -fsS http://localhost:3000/about || exit 1
CMD ["pnpm", "--filter", "@evolai/web", "start"]
