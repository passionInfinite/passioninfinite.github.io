/* Interactive visuals for the Model Insights homepage. No dependencies. */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rng = (seed) => {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  };
  const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)].map(Math.round);
  const AMBER = [255, 180, 84], TEAL = [62, 224, 192], BLUE = [122, 162, 255], ICE = [200, 214, 255];
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  /* ---------- A tiny 3D stage: perspective projection, drag to rotate ---------- */
  class Stage {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scene = opts.scene;
      this.yaw = opts.yaw; this.pitch = opts.pitch; this.spin = opts.spin;
      this.fov = opts.fov || 3.4;
      this.k = 100; this.t = 0; this.w = 1; this.h = 1; this.dpr = 1;
      this.vy = 0; this.drag = null; this.visible = false; this.raf = 0; this.last = 0; this.dirty = true;
      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.kick(); }, { threshold: 0 }).observe(canvas);
      canvas.addEventListener('pointerdown', (e) => this.down(e));
      canvas.addEventListener('pointermove', (e) => this.move(e));
      canvas.addEventListener('pointerup', () => { this.drag = null; });
      canvas.addEventListener('pointercancel', () => { this.drag = null; });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
      this.resize();
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.dirty = true; this.kick();
    }
    down(e) {
      this.drag = { x: e.clientX, y: e.clientY };
      this.vy = 0;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    move(e) {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.yaw += dx * 0.008;
      this.pitch = clamp(this.pitch + dy * 0.006, -1.2, 1.2);
      this.vy = dx * 0.0007;
      this.dirty = true; this.kick();
    }
    kick() { if (!this.raf && this.visible) this.raf = requestAnimationFrame((n) => this.frame(n)); }
    frame(now) {
      this.raf = 0;
      if (!this.visible || document.hidden) { this.last = 0; return; }
      const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
      this.last = now;
      if (!this.drag) {
        if (!reduce) this.yaw += this.spin * dt;
        if (Math.abs(this.vy) > 1e-5) { this.yaw += this.vy; this.vy *= 0.95; this.dirty = true; }
      }
      this.t += dt;
      const busy = this.scene.update(dt, this);
      if (!reduce || busy || this.dirty) {
        const { ctx, dpr } = this;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, this.w, this.h);
        this.scene.draw(ctx, this);
      }
      this.dirty = false;
      this.kick();
    }
    /* world -> screen. +y is down, larger z is farther away. */
    p(x, y, z) {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const s = this.fov / (this.fov + z2);
      return { x: this.w / 2 + x1 * s * this.k, y: this.h / 2 + y2 * s * this.k, z: z2, s };
    }
  }

  function wireSeg(root, onPick) {
    const btns = [...root.querySelectorAll('.seg button')];
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onPick(b.dataset.val);
    }));
  }

  /* ---------- Scene 1: a neural network inside a closed box ---------- */
  function latticeScene() {
    const rand = rng(7);
    const L = 6, G = 4, DX = 0.62, DY = 0.34, per = G * G;
    const nodes = [];
    for (let l = 0; l < L; l++) {
      for (let i = 0; i < G; i++) {
        for (let j = 0; j < G; j++) {
          nodes.push({ x: (l - (L - 1) / 2) * DX, y: (i - (G - 1) / 2) * DY, z: (j - (G - 1) / 2) * DY, l });
        }
      }
    }
    const idx = (l, i) => l * per + i;
    const edges = [], out = nodes.map(() => []);
    for (let l = 0; l < L - 1; l++) {
      for (let i = 0; i < per; i++) {
        const picks = new Set();
        while (picks.size < 3) picks.add(Math.floor(rand() * per));
        picks.forEach((k) => {
          const e = { a: idx(l, i), b: idx(l + 1, k), hot: false };
          edges.push(e); out[e.a].push(e);
        });
      }
    }
    const hotNodes = new Set();
    const route = (start) => {
      let n = start; const path = [n]; hotNodes.add(n);
      for (let l = 0; l < L - 1; l++) {
        const e = out[n][Math.floor(rand() * out[n].length)];
        e.hot = true; n = e.b; path.push(n); hotNodes.add(n);
      }
      return path;
    };
    const paths = [route(idx(0, 3)), route(idx(0, 12))];

    const pulses = [];
    let spawn = 0, o = 0;
    const state = { open: false };
    const newPulse = (hot) => {
      let path;
      if (hot) path = paths[Math.floor(rand() * paths.length)];
      else {
        let n = idx(0, Math.floor(rand() * per)); path = [n];
        for (let l = 0; l < L - 1; l++) { n = out[n][Math.floor(rand() * out[n].length)].b; path.push(n); }
      }
      pulses.push({ path, seg: 0, u: 0, hot });
    };
    const vis = (l) => (l >= 1 && l <= L - 2 ? lerp(0.1, 1, o) : 1);

    function update(dt) {
      let busy = false;
      const target = state.open ? 1 : 0;
      if (Math.abs(o - target) > 0.002) { o += (target - o) * Math.min(1, dt * 4.5); busy = true; } else o = target;
      if (!reduce) {
        spawn -= dt;
        if (spawn <= 0 && pulses.length < 16) { newPulse(o > 0.5 && rand() < 0.6); spawn = 0.28 + rand() * 0.25; }
        for (const p of pulses) { p.u += dt * 1.25; if (p.u >= 1) { p.u = 0; p.seg++; } }
        for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].seg >= L - 1) pulses.splice(i, 1);
        busy = true;
      }
      return busy;
    }

    const BX = 1.2, BY = 0.68;
    const FACES = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];

    function draw(ctx, st) {
      st.k = Math.min(st.w / 5.2, st.h / 4.1);
      const u = st.k / 105;
      const P = nodes.map((n) => st.p(n.x, n.y, n.z));
      ctx.lineCap = 'round';

      for (const e of edges) {
        const a = P[e.a], b = P[e.b];
        const v = Math.min(vis(nodes[e.a].l), vis(nodes[e.b].l));
        const depth = clamp(1 - ((a.z + b.z) / 2) * 0.35, 0.35, 1.3);
        const hot = e.hot && o > 0.02;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        if (hot) {
          ctx.strokeStyle = rgb(TEAL, clamp((0.2 + 0.7 * o) * depth, 0, 1));
          ctx.lineWidth = 1 + 1.8 * o * u;
          ctx.shadowColor = rgb(TEAL, 0.9); ctx.shadowBlur = 10 * o;
        } else {
          ctx.strokeStyle = rgb(BLUE, 0.2 * v * depth); ctx.lineWidth = 1;
        }
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      const order = P.map((_, i) => i).sort((i, j) => P[j].z - P[i].z);
      for (const i of order) {
        const n = nodes[i], p = P[i];
        const edgeLayer = n.l === 0 || n.l === L - 1;
        const hot = o > 0.02 && hotNodes.has(i);
        const v = vis(n.l);
        const depth = clamp(1 - p.z * 0.3, 0.4, 1.25);
        let col = n.l === 0 ? ICE : n.l === L - 1 ? AMBER : BLUE;
        if (hot && !edgeLayer) col = mix(BLUE, TEAL, o);
        const r = (edgeLayer ? 3.8 : 3.1) * p.s * u * (hot ? 1 + 0.5 * o : 1);
        if (hot) { ctx.shadowColor = rgb(TEAL, 0.9); ctx.shadowBlur = 12 * o; }
        ctx.fillStyle = rgb(col, clamp((edgeLayer ? 0.95 : 0.85) * v * depth, 0, 1));
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r), 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const q of pulses) {
        if (q.seg >= L - 1) continue;
        const ia = q.path[q.seg], ib = q.path[q.seg + 1];
        const a = P[ia], b = P[ib];
        const v = Math.min(vis(nodes[ia].l), vis(nodes[ib].l));
        const x = lerp(a.x, b.x, q.u), y = lerp(a.y, b.y, q.u), s = lerp(a.s, b.s, q.u);
        if (q.hot) { ctx.shadowColor = rgb(TEAL, 1); ctx.shadowBlur = 12; }
        ctx.fillStyle = q.hot ? rgb(TEAL, 0.5 + 0.5 * v) : `rgba(255,255,255,${0.9 * v})`;
        ctx.beginPath(); ctx.arc(x, y, 2.3 * s * u * (q.hot ? 1.4 : 1), 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }

      /* the box */
      const C = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) C.push(st.p(sx * BX, sy * BY, sz * BY));
      const faces = FACES.map((f) => ({ f, z: f.reduce((s, k) => s + C[k].z, 0) / 4 })).sort((a, b) => b.z - a.z);
      const closed = 1 - o;
      for (const { f } of faces) {
        ctx.beginPath();
        f.forEach((k, n) => (n ? ctx.lineTo(C[k].x, C[k].y) : ctx.moveTo(C[k].x, C[k].y)));
        ctx.closePath();
        ctx.fillStyle = `rgba(12,20,48,${0.5 * closed})`; ctx.fill();
      }
      ctx.strokeStyle = rgb(TEAL, 0.12 + 0.75 * closed); ctx.lineWidth = 1.3;
      for (let a = 0; a < 8; a++) {
        for (const bit of [1, 2, 4]) {
          const b = a ^ bit;
          if (b > a) { ctx.beginPath(); ctx.moveTo(C[a].x, C[a].y); ctx.lineTo(C[b].x, C[b].y); ctx.stroke(); }
        }
      }

      const c = st.p(0, 0, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(46 * u)}px ${FONT}`;
      ctx.fillStyle = rgb(AMBER, 0.9 * closed);
      ctx.fillText('?', c.x, c.y);

      ctx.font = `600 ${Math.max(10, Math.round(11.5 * u))}px ${FONT}`;
      ctx.textBaseline = 'top';
      const li = st.p(nodes[0].x, 0.8, 0), lo = st.p(nodes[nodes.length - 1].x, 0.8, 0);
      ctx.fillStyle = rgb(ICE, 0.8); ctx.fillText('PROMPT', li.x, li.y);
      ctx.fillStyle = rgb(AMBER, 0.9); ctx.fillText('ACTION', lo.x, lo.y);
      if (o > 0.3) {
        const m = P[paths[0][3]];
        ctx.fillStyle = rgb(TEAL, clamp(o, 0, 1)); ctx.fillText('CIRCUIT', m.x, m.y - 26 * u);
      }
    }
    return { state, update, draw };
  }

  /* ---------- Scene 2: defence layers around a model, plus the missing core ---------- */
  const RINGS = [
    { r: 0.80, tilt: [1.0, 0.25], col: [122, 162, 255], name: 'Guardrails & filters' },
    { r: 1.06, tilt: [-0.55, 0.95], col: [157, 140, 255], name: 'Permissions & sandboxes' },
    { r: 1.32, tilt: [0.45, -0.75], col: [70, 194, 255], name: 'Observability (e.g. OpenTelemetry)' },
    { r: 1.58, tilt: [-1.15, 0.3], col: [255, 143, 177], name: 'Human review' },
  ];

  function ringScene() {
    const rand = rng(21);
    const N = 120;
    const rot = (v, ax, az) => {
      const [x, y, z] = v;
      const y1 = y * Math.cos(ax) - z * Math.sin(ax), z1 = y * Math.sin(ax) + z * Math.cos(ax);
      return [x * Math.cos(az) - y1 * Math.sin(az), x * Math.sin(az) + y1 * Math.cos(az), z1];
    };
    RINGS.forEach((rg) => {
      rg.pts = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TAU;
        rg.pts.push(rot([rg.r * Math.cos(a), 0, rg.r * Math.sin(a)], rg.tilt[0], rg.tilt[1]));
      }
    });
    const M = 44, core = [];
    for (let i = 0; i < M; i++) {
      const y = 1 - (2 * i + 1) / M, rr = Math.sqrt(1 - y * y), th = i * 2.399963;
      core.push([Math.cos(th) * rr * 0.38, y * 0.38, Math.sin(th) * rr * 0.38]);
    }
    const links = [];
    for (let i = 0; i < M; i++) for (let j = i + 1; j < M; j++) {
      const d = Math.hypot(core[i][0] - core[j][0], core[i][1] - core[j][1], core[i][2] - core[j][2]);
      if (d < 0.34) links.push([i, j]);
    }

    const state = { open: false };
    const parts = [];
    let o = 0, spawn = 0;
    const newPart = () => {
      const z = 2 * rand() - 1, a = rand() * TAU, r = Math.sqrt(1 - z * z);
      return { d: [r * Math.cos(a), z, r * Math.sin(a)], r: 0.42, v: 0.35 + rand() * 0.3, ph: rand() * TAU };
    };

    function update(dt) {
      let busy = false;
      const target = state.open ? 1 : 0;
      if (Math.abs(o - target) > 0.002) { o += (target - o) * Math.min(1, dt * 4); busy = true; } else o = target;
      if (!reduce) {
        spawn -= dt;
        if (spawn <= 0 && parts.length < 70) { parts.push(newPart()); spawn = 0.07 + rand() * 0.08; }
        for (const q of parts) q.r += q.v * dt;
        for (let i = parts.length - 1; i >= 0; i--) if (parts[i].r > 1.9) parts.splice(i, 1);
        busy = true;
      }
      return busy;
    }

    function draw(ctx, st) {
      st.k = Math.min(st.w / 4.2, st.h / 4.0);
      const u = st.k / 110;
      const RP = RINGS.map((rg) => rg.pts.map((q) => st.p(q[0], q[1], q[2])));
      const ringAlpha = lerp(0.95, 0.5, o);
      const pcol = mix(AMBER, TEAL, o);
      ctx.lineCap = 'butt';

      const pass = (front) => {
        RINGS.forEach((rg, ri) => {
          const P = RP[ri];
          for (let i = 0; i < N; i++) {
            const a = P[i], b = P[i + 1], z = (a.z + b.z) / 2;
            if ((z < 0) !== front) continue;
            ctx.strokeStyle = rgb(rg.col, clamp(0.55 - z * 0.3, 0.2, 1) * ringAlpha);
            ctx.lineWidth = (front ? 1.8 : 1.3) * Math.max(0.8, u);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        });
        for (const q of parts) {
          const p = st.p(q.d[0] * q.r, q.d[1] * q.r, q.d[2] * q.r);
          if ((p.z < 0) !== front) continue;
          const fade = clamp((1.9 - q.r) / 0.5, 0, 1) * clamp((q.r - 0.42) / 0.15, 0, 1);
          const flick = 1 - (1 - o) * 0.4 * (0.5 + 0.5 * Math.sin(st.t * 18 + q.ph));
          ctx.fillStyle = rgb(pcol, 0.9 * fade * flick);
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.4 * p.s * u, 0, TAU); ctx.fill();
        }
      };

      pass(false);

      const c = st.p(0, 0, 0), R = 0.42 * c.s * st.k;
      if (o > 0.01) {
        const g = ctx.createRadialGradient(c.x, c.y, R * 0.6, c.x, c.y, R * 3.2);
        g.addColorStop(0, rgb(TEAL, 0.35 * o)); g.addColorStop(1, rgb(TEAL, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R * 3.2, 0, TAU); ctx.fill();
      }
      const bg = ctx.createRadialGradient(c.x - R * 0.3, c.y - R * 0.3, R * 0.1, c.x, c.y, R);
      bg.addColorStop(0, rgb(mix([34, 44, 84], [20, 110, 112], o), 1));
      bg.addColorStop(1, rgb(mix([5, 8, 20], [8, 40, 50], o), 1));
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgb(mix(AMBER, TEAL, o), 0.55 + 0.3 * o); ctx.lineWidth = 1.5; ctx.stroke();

      const Q = core.map((q) => st.p(q[0], q[1], q[2]));
      ctx.lineWidth = 1;
      for (const [i, j] of links) {
        ctx.strokeStyle = rgb(TEAL, (0.04 + 0.5 * o) * clamp(0.9 - (Q[i].z + Q[j].z) * 0.6, 0.2, 1));
        ctx.beginPath(); ctx.moveTo(Q[i].x, Q[i].y); ctx.lineTo(Q[j].x, Q[j].y); ctx.stroke();
      }
      for (const q of Q) {
        ctx.fillStyle = rgb(mix(ICE, TEAL, o), (0.1 + 0.8 * o) * clamp(0.9 - q.z * 1.2, 0.2, 1));
        ctx.beginPath(); ctx.arc(q.x, q.y, 1.8 * q.s * u, 0, TAU); ctx.fill();
      }

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(R * 1.1)}px ${FONT}`;
      ctx.fillStyle = rgb(AMBER, 0.9 * (1 - o));
      ctx.fillText('?', c.x, c.y);
      ctx.font = `600 ${Math.max(10, Math.round(11 * u))}px ${FONT}`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = rgb(ICE, 0.75);
      ctx.fillText('THE MODEL', c.x, c.y + R + 6 * u);

      pass(true);
    }
    return { state, update, draw };
  }

  /* ---------- Agent trace explorer: what observability shows vs. the "why" ---------- */
  const STEPS = [
    { name: 'plan_next_step', kind: 'llm_call',
      attrs: [['span.kind', 'llm'], ['started', '14:02:11.020'], ['duration', '1.8 s'], ['tokens in/out', '2,140 / 96'], ['status', 'OK']],
      why: [['The task you gave it', 78], ['System prompt', 22]],
      note: 'Unremarkable. The task drove the plan.', flag: false },
    { name: 'read_file', kind: 'tool_call',
      attrs: [['span.kind', 'tool'], ['started', '14:02:12.870'], ['duration', '42 ms'], ['tool.args', 'path="app/config.yaml"'], ['status', 'OK']],
      why: [['The task you gave it', 64], ['Its own plan', 30], ['System prompt', 6]],
      note: 'Also expected. Reading the file follows from the plan.', flag: false },
    { name: 'run_exploit_simulation', kind: 'tool_call',
      attrs: [['span.kind', 'tool'], ['started', '14:02:13.011'], ['duration', '6.4 s'], ['tool.args', 'target="payments-api"'], ['status', 'OK']],
      why: [['Text hidden inside the file', 46], ['The task you gave it', 34], ['System prompt', 20]],
      note: 'Worth a look: text inside an untrusted file pulled the model toward this action. The trace logged the call. Only a view inside the model shows what drove it.', flag: true },
    { name: 'open_ticket', kind: 'action',
      attrs: [['span.kind', 'tool'], ['started', '14:02:19.480'], ['duration', '310 ms'], ['tool.args', 'severity="high"'], ['status', 'OK']],
      why: [['The task you gave it', 71], ['System prompt', 29]],
      note: 'As expected. The task asked for a ticket.', flag: false },
  ];

  function initTrace() {
    const list = document.getElementById('trace-steps');
    const dl = document.getElementById('otel-attrs');
    const why = document.getElementById('why-body');
    const peek = document.getElementById('peek');
    if (!list || !dl || !why || !peek) return;
    let sel = 2, open = false;

    STEPS.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'trace-step';
      b.innerHTML = `<span class="trace-name"></span><span class="trace-kind"></span>`;
      b.querySelector('.trace-name').textContent = s.name;
      b.querySelector('.trace-kind').textContent = s.kind;
      b.addEventListener('click', () => { sel = i; render(); });
      list.appendChild(b);
    });

    function render() {
      const s = STEPS[sel];
      [...list.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === sel)));
      dl.innerHTML = '';
      s.attrs.forEach(([k, v]) => {
        const dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = k; dd.textContent = v; dl.append(dt, dd);
      });
      peek.setAttribute('aria-pressed', String(open));
      peek.textContent = open ? 'Close the box again' : 'Peek inside (illustrative)';
      why.innerHTML = '';
      if (!open) {
        why.innerHTML = '<div class="why-locked"><div class="why-q" aria-hidden="true">?</div><p></p></div>';
        why.querySelector('p').innerHTML = 'The trace records <strong>that</strong> the model chose <code></code>. It cannot say what inside the model drove that choice. Today, that part is a black box.';
        why.querySelector('code').textContent = s.name;
        return;
      }
      const bars = [];
      s.why.forEach(([label, pct], i) => {
        const row = document.createElement('div'); row.className = 'why-row';
        row.innerHTML = '<span><em></em><b></b></span><div class="bar"><i></i></div>';
        row.querySelector('em').textContent = label; row.querySelector('b').textContent = pct + '%';
        if (s.flag && i === 0) row.querySelector('.bar').classList.add('flag');
        why.appendChild(row); bars.push([row.querySelector('i'), pct]);
      });
      const note = document.createElement('p');
      note.className = 'why-note' + (s.flag ? ' flag' : ''); note.textContent = s.note;
      const tag = document.createElement('p');
      tag.className = 'why-tag'; tag.textContent = 'Illustrative mock-up with made-up numbers. Real interpretability results are messier, and the posts here will show them with their limits.';
      why.append(note, tag);
      requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach(([el, pct]) => { el.style.width = pct + '%'; })));
    }
    peek.addEventListener('click', () => { open = !open; render(); });
    render();
  }

  /* ---------- Wiring ---------- */
  function initHero() {
    const root = document.getElementById('stage-hero');
    if (!root) return;
    const scene = latticeScene();
    const stage = new Stage(root.querySelector('canvas'), { scene, yaw: 0.55, pitch: -0.28, spin: 0.14, fov: 7 });
    const cap = document.getElementById('cap-hero');
    const text = {
      closed: 'Prompt in, action out. What happens in between is a black box.',
      open: 'Interpretability opens the box. The glowing path is a circuit: the internal route that helped produce the action.',
    };
    wireSeg(root, (v) => { scene.state.open = v === 'open'; if (cap) cap.textContent = text[v]; stage.dirty = true; stage.kick(); });
  }

  function initRings() {
    const root = document.getElementById('stage-rings');
    if (!root) return;
    const scene = ringScene();
    const stage = new Stage(root.querySelector('canvas'), { scene, yaw: 0.4, pitch: -0.35, spin: 0.12, fov: 6 });
    const legend = document.getElementById('legend-rings');
    if (legend) {
      RINGS.forEach((rg) => {
        const li = document.createElement('div');
        li.innerHTML = '<i></i><span></span>';
        li.querySelector('i').style.background = rgb(rg.col, 1);
        li.querySelector('span').textContent = rg.name;
        legend.appendChild(li);
      });
    }
    const cap = document.getElementById('cap-rings');
    const text = {
      today: 'Today: we wrap the model in layers. They are essential and they stay. But each one acts on actions after the model has already decided.',
      vision: 'The vision: add the missing layer at the core. If we can see why a model picks an action, and shape those internals, secure actions come from the source, and every outer layer gets stronger.',
    };
    wireSeg(root, (v) => { scene.state.open = v === 'vision'; if (cap) cap.textContent = text[v]; stage.dirty = true; stage.kick(); });
  }

  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    els.forEach((e) => io.observe(e));
  }

  const start = () => {
    try { initHero(); initRings(); initTrace(); initReveal(); } finally { window.__vizReady = true; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
