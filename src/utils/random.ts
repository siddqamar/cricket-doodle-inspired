/** Tiny seeded RNG for reproducible delivery recipes if needed. */
export class RNG {
  private s: number;

  constructor(seed = Date.now() % 1e9) {
    this.s = seed >>> 0 || 1;
  }

  next(): number {
    // xorshift32
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return (this.s & 0xffffffff) / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}
