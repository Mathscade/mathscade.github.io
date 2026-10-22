/* =====================================================================
   PHYSICS: arcade F1 handling.
   The car keeps a world velocity (vx, vy). Each tick we:
     1. turn the car (turn rate falls with speed, like a real car's grip limit)
     2. split velocity into forward and sideways parts in the car's new frame
     3. throttle / brake / drag act on the forward part
     4. tyre grip pulls the sideways part back towards zero; anything grip can't
        hold becomes a slide that scrubs speed (oil, grass and damage lower grip)
   Units: metres, seconds, radians.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.Physics = {
  /** Which surface is the car on, given its distance from the centreline? */
  surfaceAt(track, lat) {
    const a = Math.abs(lat);
    if (a <= track.hw) return 'asphalt';
    if (a <= track.hw + 1.2) return 'kerb';
    return track.def.runoffSurface === 'kerb' ? 'kerb' : track.def.runoffSurface;
  },

  /** Top speed (m/s) after damage, boosts, penalties and surface. */
  topSpeed(car, surface) {
    const C = F1.CONFIG, S = C.SURFACE[surface];
    let v = C.CAR.maxSpeed * F1.Damage.speedFactor(car.health);
    if (S) v *= S.top;
    if (car.boostT > 0) v *= 1 + C.MATHS.boostTop;
    if (car.slipT > 0) v *= 1 + C.ITEMS.slipstreamGain;
    if (car.critical) v = Math.min(v, C.CAR.maxSpeed * C.DAMAGE.criticalSpeedCap);
    if (car.penaltyT > 0) v = Math.min(v, C.CAR.maxSpeed * C.TRACK_LIMITS.penaltyCap);
    return v;
  },

  step(car, dt, track, grade) {
    const C = F1.CONFIG, P = C.CAR, inp = car.input;
    const surface = car.surface || 'asphalt', S = C.SURFACE[surface] || { grip: 1, top: 1, drag: 0 };

    // 1. turning
    let fx = Math.cos(car.h), fy = Math.sin(car.h);
    let vf = car.vx * fx + car.vy * fy;
    const speed = Math.abs(vf);
    const yawCap = Math.min(P.yawMaxLow, P.steerLat / Math.max(speed, 1));
    const lowSpeed = Math.min(1, speed / 4);
    car.h += (inp.steer * yawCap * lowSpeed * Math.sign(vf || 1) + car.spin) * dt;
    car.spin *= Math.exp(-2.4 * dt);

    // 2. velocity in the car's new frame
    fx = Math.cos(car.h); fy = Math.sin(car.h); const rx = -fy, ry = fx;
    vf = car.vx * fx + car.vy * fy; let vl = car.vx * rx + car.vy * ry;

    // 3. engine, brakes, drag
    const top = F1.Physics.topSpeed(car, surface);
    let a = 0;
    if (inp.throttle > 0 && vf >= -0.5) {
      const boost = (car.boostT > 0 ? C.MATHS.boostAccel : 0) + Math.min(car.streak, C.MATHS.streakMax) * C.MATHS.streakAccel;
      if (vf < top) a += P.accel * (1 + boost) * inp.throttle * Math.pow(Math.max(0.06, 1 - vf / top), 0.65);
      else a -= (vf - top) * 1.6;
    } else if (vf > top) a -= (vf - top) * 1.6;
    if (inp.brake > 0) {
      if (vf > 0.6) a -= P.brake * inp.brake;
      else if (vf > -P.reverseMax) a -= 6 * inp.brake;          // reverse slowly when stopped
    }
    if (!inp.throttle && !inp.brake) a -= P.coast * Math.sign(vf);
    if (S.drag) a -= S.drag * Math.sign(vf) * Math.min(1, Math.abs(vf) / 6);
    if (grade) a -= 9.81 * grade * 0.45;                            // uphill slows you, downhill helps (Spa)
    const vfNew = vf + a * dt;
    vf = (inp.throttle || inp.brake) ? vfNew : (Math.sign(vfNew) !== Math.sign(vf) && Math.abs(vf) < 1 ? 0 : vfNew);

    // 4. grip
    let grip = P.latGrip * S.grip * (car.slideT > 0 ? 0.16 : 1);
    const hold = grip * dt;
    car.sliding = Math.abs(vl) > hold * 1.6 && speed > 12;
    if (Math.abs(vl) <= hold) vl = 0;
    else {
      const excess = Math.abs(vl) - hold;
      vl -= Math.sign(vl) * hold;
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), excess * P.scrub * 0.5);   // sliding costs speed
    }

    car.vx = fx * vf + rx * vl; car.vy = fy * vf + ry * vl;
    car.x += car.vx * dt; car.y += car.vy * dt;
    car.speed = vf; car.latSpeed = vl;
  },
};
