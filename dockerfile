# ------------------------
# Etapa 1: build
# ------------------------
    FROM oven/bun:1.1.13 AS builder

    # Define diretório de trabalho
    WORKDIR /app
    
    # Copia arquivos de projeto
    COPY . .
    
    # Instala dependências
    RUN bun install --production
    
    # ------------------------
    # Etapa 2: imagem final
    # ------------------------
    FROM oven/bun:1.1.13-slim
    
    WORKDIR /app
    
    # Copia apenas arquivos necessários
    COPY --from=builder /app /app
    
    # Exponha a porta que o Bun irá servir (9999)
    EXPOSE 3000
    
    # Comando padrão
    CMD ["bun", "src/main.ts"]
    