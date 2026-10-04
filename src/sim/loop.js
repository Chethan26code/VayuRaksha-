/**
 * Deterministic Simulation Loop (Fixed 60 Hz Update)
 * Decouples game/threat physics from visual rendering frame rate.
 * Prevents simulation drift and guarantees identical replays across all hardware.
 */

export class SimulationLoop {
  constructor(onUpdate, onRender) {
    this.DT = 1 / 60; // 60 updates per second (16.666 ms)
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.accumulator = 0;
    this.lastTime = 0;
    this.isRunning = false;
    this.simTime = 0;
    this.speedMultiplier = 1.0;
    this.rafId = null;

    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  reset() {
    this.stop();
    this.accumulator = 0;
    this.simTime = 0;
  }

  setSpeed(multiplier = 1.0) {
    this.speedMultiplier = Math.max(0.25, Math.min(4.0, multiplier));
  }

  frame(now) {
    if (!this.isRunning) return;

    const delta = Math.min((now - this.lastTime) / 1000, 0.25) * this.speedMultiplier;
    this.lastTime = now;
    this.accumulator += delta;

    while (this.accumulator >= this.DT) {
      this.simTime += this.DT;
      if (this.onUpdate) {
        this.onUpdate(this.DT, this.simTime);
      }
      this.accumulator -= this.DT;
    }

    if (this.onRender) {
      this.onRender(this.accumulator / this.DT, this.simTime);
    }

    this.rafId = requestAnimationFrame(this.frame);
  }
}
