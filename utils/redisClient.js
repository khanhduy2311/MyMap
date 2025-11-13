// utils/redisClient.js
const Redis = require('ioredis');

// Support cả local và Render Redis URL
let redisConfig;

if (process.env.REDIS_URL) {
  // Render/Production: Dùng Redis URL (format: redis://user:pass@host:port)
  redisConfig = process.env.REDIS_URL;
  console.log('📍 Using Redis URL from environment');
} else {
  // Local development
  redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
  console.log('📍 Using local Redis configuration');
}

// Khởi tạo Redis client
const redis = new Redis(redisConfig, {
  retryStrategy: (times) => {
    if (times > 5) {
      console.log('❌ Too many Redis reconnection attempts');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  connectTimeout: 10000,
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully!');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️  Continuing without Redis in development mode');
  }
});

// Job Manager sử dụng Redis
class JobManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.JOB_TTL = 10 * 60; // 10 phút
  }

  async createJob(jobId, jobData) {
    const key = `job:${jobId}`;
    await this.redis.setex(key, this.JOB_TTL, JSON.stringify(jobData));
    console.log(`📝 Job created in Redis: ${jobId}`);
    return jobId;
  }

  async getJob(jobId) {
    const key = `job:${jobId}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  async updateJob(jobId, updates) {
    const key = `job:${jobId}`;
    const existing = await this.getJob(jobId);
    if (!existing) {
      throw new Error(`Job ${jobId} not found`);
    }
    const updated = { ...existing, ...updates };
    await this.redis.setex(key, this.JOB_TTL, JSON.stringify(updated));
    return updated;
  }

  async deleteJob(jobId) {
    const key = `job:${jobId}`;
    await this.redis.del(key);
    console.log(`🗑️ Job deleted from Redis: ${jobId}`);
  }

  async getAllJobIds() {
    const keys = await this.redis.keys('job:*');
    return keys.map(k => k.replace('job:', ''));
  }
}

const jobManager = new JobManager(redis);

module.exports = { redis, jobManager };
