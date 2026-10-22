/* =====================================================================
   NETWORKING: how a student's screen talks to the race server.
   The game only ever talks to a transport through these calls:
     join({name, sprite})         -> your player id
     sendInput({throttle, brake, steer})
     useItem() / reset() / answer(questionId, optionIndex)
     state()                      -> latest public snapshot (+ your private view)
     drainEvents()                -> race events since last call
   LocalTransport runs the server in this browser (practice races with
   computer drivers). A live class version swaps in a transport that sends
   the same messages to a hosted RaceServer over a realtime channel, so
   the server stays authoritative and nothing else in the game changes.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.LocalTransport = class LocalTransport {
  constructor(server) { this.server = server; this.me = null; this.cursor = 0; }
  join(info) { const car = this.server.addPlayer(Object.assign({ id: 'you', isBot: false }, info)); this.me = car && car.id; return this.me; }
  sendInput(inp) { this.server.input(this.me, inp); }
  useItem() { this.server.useItem(this.me); }
  reset() { const c = this.server.byId.get(this.me); if (c) this.server.resetCar(c, 'manual'); }
  answer(qid, i) { return this.server.answer(this.me, qid, i); }
  state() { return this.server.snapshot(this.me); }
  drainEvents() { const ev = this.server.events.slice(this.cursor); this.cursor = this.server.events.length; return ev; }
};
