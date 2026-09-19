import type Redis from "ioredis";
import type { CounterStore } from "../auth/counter-store";

export class RedisCounterStore implements CounterStore {
  constructor(private readonly redis: Redis) {}

  async incr(key: string, ttlSec: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttlSec);
    }
    return count;
  }

  async setNx(key: string, ttlSec: number): Promise<boolean> {
    const result = await this.redis.set(key, "1", "EX", ttlSec, "NX");
    return result === "OK";
  }
}
