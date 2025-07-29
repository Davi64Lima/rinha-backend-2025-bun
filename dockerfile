FROM oven/bun:1.1.45 as builder

WORKDIR /app
COPY . .

RUN bun install

# Compila o TypeScript para dist/
RUN bunx tsc

FROM oven/bun:1.1.45
WORKDIR /app

# Copia arquivos compilados
COPY --from=builder /app/dist ./dist

# Copia arquivos de config para instalação
COPY bunfig.toml package.json ./

RUN bun install --production

CMD ["bun", "dist/main.js"]
