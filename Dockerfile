# The client, as Compose runs it: a static bundle behind nginx.
#
# Two stages. The first runs the same `npm run build` a person runs and produces
# `dist/`. The second serves it. The Vite dev server this image used to run is
# now `task dev` only — a person's inner loop, not the demo stack.
#
# The generated contract in src/gen/ is committed (decision 0002), so the build
# needs neither protoc nor network access.
#
# VITE_SIGNAL_GARDEN_HTTP is read by Vite at build time and baked into the
# bundle the browser downloads, so changing the daemon address means rebuilding
# (`docker compose up --build`). One address to configure, same as src/api/config.ts.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SIGNAL_GARDEN_HTTP=http://localhost:8080
ENV VITE_SIGNAL_GARDEN_HTTP=${VITE_SIGNAL_GARDEN_HTTP}
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173
