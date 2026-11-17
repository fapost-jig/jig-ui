# The team server (docs/team-server.mdx): built from these sources, run as `node`, its data on the /data volume.
# Both stages pin node:24-slim by digest; Dependabot moves the digest.
FROM node:24-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
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
