import Redis from 'ioredis';
import { CONFIG } from './config';

const redis = new Redis({
    host : Bun.env.REDIS_HOST,
    port: Number(Bun.env.REDIS_PORT)
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
    console.log('Connected to Redis');
  });
  

export default redis