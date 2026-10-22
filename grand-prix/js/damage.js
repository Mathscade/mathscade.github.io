/* =====================================================================
   DAMAGE: health 0-100 per car.
   Health maps to a share of top speed through CONFIG.DAMAGE.speedTable
   (100% -> full speed, 75% -> 95%, 50% -> 85%, 25% -> 70%, critical -> 50%).
   At or below the critical level the car needs a maths repair.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.Damage = {
  speedFactor(health) {
    const T = F1.CONFIG.DAMAGE.speedTable;
    if (health >= T[0][0]) return T[0][1];
    for (let i = 0; i < T.length - 1; i++) {
      const [h0, s0] = T[i], [h1, s1] = T[i + 1];
      if (health <= h0 && health >= h1) return s1 + (s0 - s1) * (health - h1) / (h0 - h1);
    }
    return T[T.length - 1][1];
  },
  label(health) {
    if (health > 75) return 'Perfect condition';
    if (health > 50) return 'Minor damage';
    if (health > 25) return 'Damaged';
    if (health > F1.CONFIG.DAMAGE.critical) return 'Severe damage';
    return 'Critical damage';
  },
  /** Apply damage. Returns true if this hit tipped the car into critical damage. */
  apply(car, amount, repairOn) {
    if (amount <= 0 || car.finished) return false;
    const crit = F1.CONFIG.DAMAGE.critical;
    const before = car.health;
    car.health = Math.max(repairOn ? 0 : crit, car.health - amount);
    car.stats.damage += before - car.health;
    if (repairOn && !car.critical && car.health <= crit) { car.critical = true; return true; }
    return false;
  },
  repair(car, amount) {
    car.health = Math.min(100, car.health + amount);
    if (car.health > F1.CONFIG.DAMAGE.critical) car.critical = false;
  },
};
