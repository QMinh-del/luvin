export type CounterStore = {
  incr(key: string, ttlSec: number): Promise<number>;
  setNx(key: string, ttlSec: number): Promise<boolean>;
};

export class MemoryCounterStore implements CounterStore {
  private readonly counts = new Map<
    string,
    { value: number; expiresAt: number }
  >();
  private readonly flags = new Map<string, number>();

  async incr(key: string, ttlSec: number): Promise<number> {
    const now = Date.now();
    const current = this.counts.get(key);
    if (!current || current.expiresAt <= now) {
      const next = { value: 1, expiresAt: now + ttlSec * 1000 };
      this.counts.set(key, next);
      return 1;
    }
    current.value += 1;
    return current.value;
  }

  async setNx(key: string, ttlSec: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.flags.get(key);
    if (existing && existing > now) {
      return false;
    }
    this.flags.set(key, now + ttlSec * 1000);
    return true;
  }
}
