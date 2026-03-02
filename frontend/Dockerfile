# Stage 1: Build der Angular App
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Auslieferung über Nginx
FROM nginx:alpine
# Kopiere die gebaute App in das Nginx-Verzeichnis
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
