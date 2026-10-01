# IntroMaker — production image: Next.js standalone server + headless Chromium for live capture.
#   docker build -t intromaker .
#   docker run -p 3000:3000 -v intromaker-data:/data intromaker

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 INTROMAKER_STANDALONE=1
RUN npm run check:licenses && npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    INTROMAKER_DATA_DIR=/data \
    INTROMAKER_PROXY_HOPS=1
# Headless Chromium matching the app's playwright-core, plus its system libraries.
COPY --from=deps /app/node_modules/playwright-core ./node_modules/playwright-core
RUN node node_modules/playwright-core/cli.js install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache
COPY --from=build /app/.next/standalone ./
# Next's optional image optimiser (sharp / libvips, LGPL-3.0) is traced in but never used
# (images.unoptimized): leave it out, so the image ships only permissively licensed code.
RUN rm -rf node_modules/sharp node_modules/@img
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY docker-entry.js ./
RUN mkdir -p /data && chown -R node:node /data /ms-playwright
# No USER or VOLUME here: docker-entry.js starts as root only to hand the mounted data volume to
# the `node` user, then drops to it before serving (hosts mount volumes owned by root). Railway
# rejects the VOLUME instruction; mount a volume at /data on the host instead.
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "docker-entry.js"]
