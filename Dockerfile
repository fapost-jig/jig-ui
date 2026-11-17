# The team server (docs/team-server.mdx): built from these sources, run as `node`, its data on the /data volume.
# Both stages pin node:24-slim by digest; Dependabot moves the digest.
FROM node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc
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
