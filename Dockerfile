FROM node:20.19.4-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20.19.4-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20.19.4-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN apk add --no-cache ffmpeg
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/qa/gemini-proof-red-gloves-tiny.b64 ./qa/gemini-proof-red-gloves-tiny.b64
EXPOSE 3000
CMD ["sh","-c","node scripts/analysis-worker.mjs & exec npm run start"]
