# Typrun game frontend — Vite 빌드 → nginx 정적 서빙 (SPA fallback)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build   # .env.production 의 VITE_API_BASE_URL 사용

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
