const redis = Bun.redis;

try {
  const pong = await redis.ping();
  console.log("Redis conectado:", pong);
} catch (err) {
  console.error("Erro ao conectar ao Redis:", err);
  process.exit(1);
}

export {};
