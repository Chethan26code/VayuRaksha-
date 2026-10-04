/**
 * Plan Position Indicator (PPI) 2D Radar Canvas Display
 * Realistic tactical radar display with phosphor fading blips, sweep line,
 * range rings, and track symbology (MIL-STD-2525 style).
 */

export class RadarDisplay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.maxRangeMeters = 3000;
    this.blipHistory = []; // { x, y, age }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
  }

  render(tracks, clutterBlips, sweepAngle, degradationRadar, selectedTrackId) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 18;

    // Dark military radar phosphor background
    ctx.fillStyle = '#030d08';
    ctx.fillRect(0, 0, w, h);

    // Radar Scope Outer Ring
    ctx.strokeStyle = '#00aa55';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Range Rings (500m, 1000m, 2000m, 3000m)
    const ranges = [500, 1000, 2000, 3000];
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(0, 255, 120, 0.45)';

    ranges.forEach(r => {
      const ringPx = (r / this.maxRangeMeters) * radius;
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.2)';
      ctx.beginPath();
      ctx.arc(cx, cy, ringPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${r}m`, cx + 4, cy - ringPx + 11);
    });

    // Azimuth Crosshairs
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.15)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
    ctx.stroke();

    // Draw Clutter Blips (Degradation noise)
    ctx.fillStyle = 'rgba(100, 255, 150, 0.35)';
    clutterBlips.forEach(b => {
      const px = cx + (b.x / this.maxRangeMeters) * radius;
      const py = cy - (b.z / this.maxRangeMeters) * radius;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Sweeping Phosphor Beam
    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    grad.addColorStop(0, 'rgba(0, 255, 120, 0.15)');
    grad.addColorStop(1, 'rgba(0, 255, 120, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, sweepAngle - 0.45, sweepAngle);
    ctx.closePath();
    ctx.fill();

    // Leading sweep line
    ctx.strokeStyle = 'rgba(0, 255, 140, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(sweepAngle) * radius, Math.sin(sweepAngle) * radius);
    ctx.stroke();
    ctx.restore();

    // Render Fused Tracks
    tracks.forEach(track => {
      if (track.isNeutralized || !track.position) return;
      const px = cx + (track.position.x / this.maxRangeMeters) * radius;
      const py = cy - (track.position.z / this.maxRangeMeters) * radius;

      // Check boundary
      const distPx = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      if (distPx > radius) return;

      const isSelected = track.trackId === selectedTrackId;

      // Track Symbology
      ctx.save();
      ctx.translate(px, py);

      if (isSelected) {
        // Selection Reticle
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(-9, -9, 18, 18);
      }

      // MIL-STD Hostile / Unknown diamond or blip
      if (track.userClassification === 'bird') {
        ctx.fillStyle = '#88ff88'; // Green for bird
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (track.userStatus === 'ENGAGED') {
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // Unidentified target blip
        ctx.fillStyle = '#00ffaa';
        ctx.fillRect(-3, -3, 6, 6);
      }

      // Track ID Label
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = isSelected ? '#ffff00' : '#00ffaa';
      ctx.fillText(track.trackId, 8, -4);
      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(0, 255, 170, 0.7)';
      ctx.fillText(`${track.range}m`, 8, 5);

      ctx.restore();
    });

    // Center Defended Base Symbol
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  }
}
