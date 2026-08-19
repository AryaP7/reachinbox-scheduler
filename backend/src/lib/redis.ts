import IORedis from 'ioredis';
import { config } from '../config';

// BullMQ requires maxRetriesPerRequest: null on its connection.
export const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});
