# ----------- BUILD STAGE -----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ----------- RUN STAGE -----------
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main"]
