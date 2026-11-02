FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health > /dev/null || exit 1

# Apply pending migrations, then start the API (+ in-process worker).
CMD ["sh", "-c", "npm run migrate && npm start"]
