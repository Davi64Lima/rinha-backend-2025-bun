# ------------------------
# Etapa 1: Build com dependências
# ------------------------
    FROM oven/bun:1.2.19 AS builder

    WORKDIR /app
    
    # Copia apenas os arquivos essenciais primeiro (para cache eficiente)
    COPY bun.lock package.json tsconfig.json ./
    
    # Instala apenas produção, sem cache local
    RUN bun install --production --no-install-cache
    
    # Copia o restante do código (após instalar dependências p/ cache otimizado)
    COPY . .
    
    # ------------------------
    # Etapa 2: Runtime (mínimo possível)
    # ------------------------
    FROM oven/bun:1.2.19-slim AS runtime
    
    WORKDIR /app
    
    # Copia o app pronto da etapa de build
    COPY --from=builder /app /app
    
    # Exponha a porta do app (ajuste conforme sua app escuta)
    EXPOSE 3000
    
    # Define o comando default
    CMD ["bun", "src/main.ts"]
    