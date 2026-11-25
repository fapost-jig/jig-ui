# The team server (docs/team-server.mdx): built from these sources, run as `node`, its data on the /data volume.
# Both stages pin node:24-slim by digest; Dependabot moves the digest.
FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# The volume's folder belongs to `node` before the volume is mounted, so a new volume does too.
RUN mkdir -m 700 /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4870
CMD ["node", "dist/cli.js", "team-server"]
