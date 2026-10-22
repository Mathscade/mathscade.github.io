/* =====================================================================
   COLLISIONS
   - Walls: every car is held inside its own corridor of track (see Track.locate).
     Hitting the outer wall pushes the car back, bounces it and causes damage.
   - Cars: each car is two circles (nose and tail). Overlaps are pushed apart,
     closing speed is exchanged as an impulse, and the hit is graded minor /
     medium / major for damage, speed loss and a little random spin.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.Collision = {
  /** Keep the car inside the walls. Returns the impact speed (m/s) if it hit one. */
  walls(car, track, loc, intensity) {
    const C = F1.CONFIG, half = C.CAR.width / 2;
    const limit = track.wallOff - half;
    const over = Math.abs(loc.lat) - limit;
    if (over <= 0) return 0;
    const side = Math.sign(loc.lat), nx = loc.nx * side, ny = loc.ny * side;   // outward normal
    car.x -= nx * over; car.y -= ny * over;
    const vn = car.vx * nx + car.vy * ny;
    if (vn <= 0) return 0;
    const e = C.COLLISION.restitution;
    car.vx -= nx * vn * (1 + e); car.vy -= ny * vn * (1 + e);
    // glancing blows keep most speed, head-on hits lose a lot
    const keep = Math.max(0.45, 1 - vn * 0.025);
    car.vx *= keep; car.vy *= keep;
    // nudge the nose back towards the track direction so cars don't stay pinned to the wall
    const th = Math.atan2(loc.diry, loc.dirx);
    let d = th - car.h; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 1.7) car.h += d * 0.25;
    return vn * intensity;
  },

  /** Car-to-car contact for everyone on track. Calls onHit(a, b, closingSpeed, severity) once per real hit. */
  cars(list, onHit, now, intensity) {
    const C = F1.CONFIG, R = 1.6, off = C.CAR.length / 2 - R;
    const pts = list.map(c => {
      const fx = Math.cos(c.h), fy = Math.sin(c.h);
      return [[c.x + fx * off, c.y + fy * off], [c.x - fx * off, c.y - fy * off]];
    });
    for (let i = 0; i < list.length; i++) {
      const A = list[i]; if (A.ghostT > 0 || A.retired) continue;
      for (let j = i + 1; j < list.length; j++) {
        const B = list[j]; if (B.ghostT > 0 || B.retired) continue;
        if (Math.abs(A.x - B.x) > 7 || Math.abs(A.y - B.y) > 7) continue;
        let hit = null;
        for (const pa of pts[i]) for (const pb of pts[j]) {
          const dx = pa[0] - pb[0], dy = pa[1] - pb[1], d = Math.hypot(dx, dy);
          if (d < R * 2 && (!hit || d < hit.d)) hit = { d, nx: d ? dx / d : 1, ny: d ? dy / d : 0 };
        }
        if (!hit) continue;
        const o = (R * 2 - hit.d) / 2 + 0.01;
        A.x += hit.nx * o; A.y += hit.ny * o; B.x -= hit.nx * o; B.y -= hit.ny * o;
        const rel = (A.vx - B.vx) * hit.nx + (A.vy - B.vy) * hit.ny;
        if (rel >= 0) continue;                                  // already separating
        const jmp = -(1 + C.COLLISION.restitution) * rel / 2;
        A.vx += hit.nx * jmp; A.vy += hit.ny * jmp; B.vx -= hit.nx * jmp; B.vy -= hit.ny * jmp;
        const closing = -rel * intensity;
        const sev = closing >= C.COLLISION.major ? 'major' : closing >= C.COLLISION.minor ? 'medium' : 'minor';
        const loss = sev === 'major' ? 0.82 : sev === 'medium' ? 0.92 : 0.98;
        for (const c of [A, B]) { c.vx *= loss; c.vy *= loss; }
        if (sev === 'major') { A.spin += (Math.random() - 0.5) * 2 * C.COLLISION.spinOnMajor; B.spin += (Math.random() - 0.5) * 2 * C.COLLISION.spinOnMajor; }
        else if (sev === 'medium') { A.spin += (Math.random() - 0.5) * 0.8; B.spin += (Math.random() - 0.5) * 0.8; }
        const key = A.id < B.id ? A.id + '|' + B.id : B.id + '|' + A.id;
        onHit(A, B, closing, sev, key, (A.x + B.x) / 2, (A.y + B.y) / 2);
      }
    }
  },
};
