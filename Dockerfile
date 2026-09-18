# syntax=docker/dockerfile:1

FROM node:22-slim AS base
WORKDIR /app
# Skip husky's git-hook install — there's no .git in a container build context.
ENV HUSKY=0

# ---- dev: hot-reloading server, run via docker-compose.dev.yml ----
FROM base AS dev
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5055
CMD ["npm", "run", "dev"]

# ---- build: compiles TypeScript to dist/ (needs devDependencies for tsc) ----
FROM base AS build
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- prod: slim runtime image, compiled JS only, no dev tooling ----
FROM base AS prod
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 5055
CMD ["npm", "run", "start:prod"]
