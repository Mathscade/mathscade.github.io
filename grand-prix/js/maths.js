/* =====================================================================
   MATHS: one question service for the whole race, built on the shared
   Mathcade question bank (QBANK). Three kinds of question:
     boost  - always on offer on the pit wall; right answers give speed
     item   - from an item box; right answer earns an oil slick
     repair - forced at critical damage; right answer repairs the car
   The server keeps the right answer. Clients only ever see the prompt and
   the four options, and answers are checked against the question id, so
   answers can't be faked or replayed.
   Difficulty follows the other Mathcade games:
     easy   = quick maths (times tables, squares, mental percentages)
     medium = chosen topic, easier questions
     hard   = chosen topic, harder questions
   To add a topic, add a generator to the question bank; nothing here changes.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.QuestionService = class QuestionService {
  constructor(settings) {
    this.difficulty = settings.difficulty || 'medium';
    this.topic = settings.topic || 'mixed';
    this.seq = 1; this.recent = [];
  }
  static topics() { return QBANK.ALL_TOPICS.map(t => ({ id: t.id, name: t.name })); }

  pool() {
    if (this.difficulty === 'easy') return QBANK.ALL_TOPICS.filter(t => ['timestables', 'squares', 'mentalpercent'].includes(t.id));
    return this.topic === 'mixed' ? QBANK.TOPICS : QBANK.ALL_TOPICS.filter(t => t.id === this.topic);
  }

  /** A fresh question. The returned object holds the answer, so it stays on the server. */
  make(kind) {
    const pool = this.pool(), hard = this.difficulty === 'hard';
    for (let i = 0; i < 10; i++) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      let q; try { q = QBANK.buildQuestion(t, hard ? 'hard' : 'easy'); } catch (e) { continue; }
      if (!q || !q.options || q.options.length < 2) continue;
      if (this.recent.includes(q.prompt) && i < 9) continue;
      this.recent.push(q.prompt); if (this.recent.length > 40) this.recent.shift();
      return { id: this.seq++, kind, prompt: q.prompt, options: q.options, correct: q.correctIndex };
    }
    const a = 2 + Math.floor(Math.random() * 10), b = 2 + Math.floor(Math.random() * 10);
    const opts = [a * b, a * b + a, a * b - b, a * (b + 1) + 1].map(String);
    return { id: this.seq++, kind, prompt: `${a} × ${b}`, options: opts, correct: 0 };
  }

  /** What a client is allowed to see. */
  static publicView(q) { return q ? { id: q.id, kind: q.kind, prompt: q.prompt, options: q.options } : null; }
};
