ARG NODE_VERSION=24.15.0
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:${NODE_VERSION}-alpine AS wiki-deps
WORKDIR /wiki
COPY wiki ./
RUN npm ci

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS wiki-build
WORKDIR /wiki
COPY --from=wiki-deps /wiki/node_modules ./node_modules
COPY wiki ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=wiki-build /wiki/out/docs /usr/share/nginx/html/docs
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY nginx-entrypoint.sh /drakkar-nginx-entrypoint.sh
COPY docker-entrypoint.d/10-runtime-config.sh /docker-entrypoint.d/10-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/10-runtime-config.sh /drakkar-nginx-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/drakkar-nginx-entrypoint.sh"]
