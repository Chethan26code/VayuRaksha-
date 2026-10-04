/**
 * Deterministic PRNG using Mulberry32 algorithm.
 * Guarantees that the exact same seed produces identical numerical sequences
 * across all client browsers and server instances.
 */
export const mulberry32 = (seed) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export class SeededRandom {
  constructor(seed = 4721) {
    this.seed = seed;
    this.rng = mulberry32(seed);
  }

  // Returns float [0, 1)
  next() {
    return this.rng();
  }

  // Returns float [min, max)
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Returns integer [min, max] inclusive
  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // Picks random element from array
  choice(array) {
    if (!array || array.length === 0) return null;
    return array[this.rangeInt(0, array.length - 1)];
  }

  // Boolean with probability p
  boolean(p = 0.5) {
    return this.next() < p;
  }
}
