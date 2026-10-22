/* =====================================================================
   ITEMS: item boxes and oil slicks.
   - Boxes sit in rows of three on straights and respawn after a delay.
     Driving through one asks an item question; a right answer earns ONE oil slick.
     A car already holding a slick (or already answering an item question) just
     knocks the box out, so boxes can't be farmed.
   - An oil slick is dropped behind the car. Whoever drives over it slides,
     loses speed and spins briefly; the slick then disappears and its owner is told.
   - A few stray slicks appear at random for a little chaos.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.Items = class Items {
  constructor(track, settings) {
    const C = F1.CONFIG.ITEMS, freq = F1.CONFIG.ITEM_FREQ[settings.itemFreq || 'normal'];
    this.enabled = settings.items !== false;
    this.track = track;
    this.respawn = C.respawn / freq;
    this.oilDuration = settings.oilDuration || C.oilDuration;
    // low frequency drops every other row; high frequency keeps them all and respawns faster
    const rows = [...new Set(track.itemSpots.map(b => b.row))];
    const keepRows = freq < 1 ? rows.filter((_, i) => i % 2 === 0) : rows;
    this.boxes = this.enabled ? track.itemSpots.filter(b => keepRows.includes(b.row)).map((b, i) => ({ id: i, x: b.x, y: b.y, s: b.s, readyAt: 0 })) : [];
    this.oils = []; this.oilSeq = 1;
    this.randomOilRate = this.enabled ? C.randomOilPerMinute * freq : 0;
  }

  /** Called every tick by the server. */
  update(now, cars, server, dt) {
    if (!this.enabled) return;
    const C = F1.CONFIG.ITEMS;
    // boxes
    for (const b of this.boxes) {
      if (b.readyAt > now) continue;
      for (const c of cars) {
        if (c.retired || c.finished) continue;
        if (Math.abs(c.x - b.x) > 3.2 || Math.abs(c.y - b.y) > 3.2) continue;
        b.readyAt = now + this.respawn;
        server.onItemBox(c, b);
        break;
      }
    }
    // oil slicks
    this.oils = this.oils.filter(o => o.expires > now);
    for (const o of this.oils) {
      for (const c of cars) {
        if (c.retired || c.ghostT > 0) continue;
        if (c.id === o.owner && now - o.born < C.ownerImmune) continue;
        if (Math.hypot(c.x - o.x, c.y - o.y) > C.oilRadius + 1.2) continue;
        o.expires = 0;                                     // a slick is used up by the car that hits it
        server.onOilHit(c, o);
        break;
      }
    }
    // stray slicks for a bit of chaos
    if (Math.random() < this.randomOilRate / 60 * dt) {
      const s = Math.random() * this.track.length, lat = (Math.random() - 0.5) * this.track.hw;
      const p = this.track.pointAt(s, lat);
      if (!cars.some(c => Math.hypot(c.x - p.x, c.y - p.y) < 120)) this.dropOil(p.x, p.y, null, now);
    }
  }

  dropOil(x, y, owner, now) {
    const o = { id: this.oilSeq++, x, y, owner, born: now, expires: now + this.oilDuration, rot: Math.random() * Math.PI * 2 };
    this.oils.push(o); return o;
  }
};
