(async () => {
  const S = await fetch("data/graph.json", { cache: "no-store" }).then(r => r.json());
  const T = S.types;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const colorOf = n => T[n.type].color;
  const radius = n => (T[n.type].hub || n.type === "experience" ? 11 : n.orbit ? 6 : 8);

  // ── 머리말 · 범례 ───────────────────────
  $("brand").textContent = S.brand;
  $("graph-title").textContent = S.graphTitle;
  document.title = S.title;

  const usedTypes = Object.keys(T).filter(k => S.nodes.some(n => n.type === k));
  const legendDot = k => `<span class="legend-dot${T[k].hollow ? " hollow" : ""}" style="--c:${T[k].color}"></span>`;
  $("legend").innerHTML =
    `<span class="legend-title">Entity Types</span>
     <div class="legend-items">${usedTypes.map(k =>
       `<span class="legend-item">${legendDot(k)}${esc(T[k].name)}</span>`).join("")}</div>`;

  // ── 데이터 · 배치 ───────────────────────
  const nodes = S.nodes.map(n => ({ ...n }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const isHub = n => !!T[n.type].hub;
  const hubs = nodes.filter(isHub);
  // 허브는 가능성(점선) 노드와는 직접 잇지 않는다
  const spokes = hubs.flatMap(h => nodes.filter(n => !isHub(n) && !T[n.type].hollow).map(n => [h.id, n.id]));
  const edges = S.edges.concat(nodes.filter(n => n.orbit).map(n => [n.id, n.orbit]), spokes)
    .filter(([a, b]) => byId.has(a) && byId.has(b))
    .map(([a, b, kind]) => ({ source: a, target: b, core: kind === "core", layoutOnly: kind === "layout" }));   // 세 번째 값: "core" = 핵심 연결, "layout" = 배치에만 쓰는 숨은 연결
  const isSat = n => !!n.orbit;
  const isSatEdge = e => isSat(e.source) || isSat(e.target);
  const ref = v => (typeof v === "string" ? byId.get(v) : v);
  const isSpoke = e => isHub(ref(e.source)) || isHub(ref(e.target));
  hubs.forEach(h => { h.x = h.fx = 0; h.y = h.fy = 0; });   // 허브는 한가운데 고정



  // 이름 글자 크기를 미리 재서 "원 + 이름" 사각형끼리 겹치지 않게 배치한다 (글자가 겹치면 호버가 깜빡인다)
  const measure = document.createElement("canvas").getContext("2d");
  nodes.forEach(n => {
    const big = isHub(n) || n.type === "experience";
    measure.font = `${T[n.type].hollow ? "italic " : ""}${big ? 700 : 500} ${big ? 18 : 16.5}px system-ui, "Pretendard Variable", sans-serif`;
    // 호버 때 바뀌는 이름(hoverLabel)이 있으면 둘 중 긴 쪽 기준으로 자리를 잡는다
    n.lw = Math.max(...[n.label, n.hoverLabel].filter(Boolean).map(t => measure.measureText(t).width));
    n.lh = big ? 18 : 16.5;
  });
  const box = n => { const r = radius(n); return { l: -r - 6, r: r + 5 + n.lw + 8, t: -n.lh / 2 - 6, b: n.lh / 2 + 6 }; };
  function labelCollide(strength = 0.6) {
    let list = [];
    function force() {
      for (let i = 0; i < list.length; i++) {
        const a = list[i], A = box(a);
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j], B = box(b);
          const ox = Math.min(a.x + A.r, b.x + B.r) - Math.max(a.x + A.l, b.x + B.l);
          if (ox <= 0) continue;
          const oy = Math.min(a.y + A.b, b.y + B.b) - Math.max(a.y + A.t, b.y + B.t);
          if (oy <= 0) continue;
          // 덜 겹친 축으로 밀어낸다. 고정된 허브는 움직이지 않는다
          const wa = a.fx != null ? 0 : b.fx != null ? 1 : 0.5, wb = 1 - wa;
          if (ox < oy) {
            const d = (a.x + (A.l + A.r) / 2 < b.x + (B.l + B.r) / 2 ? -1 : 1) * ox * strength;
            a.x += d * wa; b.x -= d * wb;
          } else {
            const d = (a.y < b.y ? -1 : 1) * oy * strength;
            a.y += d * wa; b.y -= d * wb;
          }
        }
      }
    }
    force.initialize = ns => { list = ns; };
    return force;
  }

  // ── 배치: 허브를 중심으로 한 동심 타원 ──
  //   안쪽 고리 = 경험 · 바깥 고리 = 분야·조직·취향 · 가장 바깥 = 위성 가능성
  //   화면 비율에 맞춰 가로로 늘린 타원을 써서 빈 공간 없이 화면을 채운다
  const main = nodes.filter(n => !isSat(n));
  const mainLinks = edges.filter(e => !isSat(byId.get(e.source)) && !isSat(byId.get(e.target)))
    .map(e => ({ source: e.source, target: e.target }));
  const mainNbr = new Map(main.map(n => [n.id, []]));
  mainLinks.filter(e => !isSpoke(e)).forEach(e => { mainNbr.get(e.source).push(e.target); mainNbr.get(e.target).push(e.source); });

  const stage = $("graph").getBoundingClientRect();
  const KX = Math.max(1.2, Math.min(1.9, (stage.width || 1440) / Math.max(1, (stage.height || 800) - 100) * 0.8));
  // 고리 반지름: 경험 하나에만 딸린 노드는 바깥 고리, 여러 경험·영역을 잇는 노드는 그 사이 안쪽 고리
  const expCount = n => (mainNbr.get(n.id) || []).filter(id => byId.get(id).type === "experience").length;
  const ring = n => isHub(n) ? 0 : n.type === "experience" ? 190 : T[n.type].hollow ? null : expCount(n) === 1 ? 330 : 270;
  const ellipse = (a, r) => [Math.cos(a) * r * KX, Math.sin(a) * r];

  // 경험 순서: 모든 순서를 비교해, 분야·조직이 이어진 경험들끼리 가장 가깝게 모이는 순서를 고른다
  //   (경험은 고리 위에 같은 간격으로 고정 → 선이 덜 엇갈리고 구조가 고르게 보인다)
  const exps = main.filter(n => n.type === "experience");
  const E = exps.length;
  const others = main.filter(n => n.type !== "experience" && !isHub(n));
  const solid = mainLinks.filter(e => !isSpoke(e)).map(e => [byId.get(e.source), byId.get(e.target)]);
  const crosses = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  // 순서 하나를 시험 배치해 선 교차 수를 센다 (분야·조직은 이어진 노드들의 평균 각도에 놓고 계산)
  function crossingsFor(slots) {
    exps.forEach((n, k) => { n.angle = (slots[k] / E) * Math.PI * 2; [n.x, n.y] = ellipse(n.angle, 190); });
    others.forEach(n => { n.angle = null; });
    for (let round = 0; round < 3; round++) others.forEach(n => {
      const placed = mainNbr.get(n.id).map(id => byId.get(id)).filter(m => m.angle != null);
      if (!placed.length) return;
      n.angle = Math.atan2(d3.sum(placed, m => Math.sin(m.angle)), d3.sum(placed, m => Math.cos(m.angle)));
      [n.x, n.y] = ellipse(n.angle, ring(n) ?? 260);
    });
    let c = 0;
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const [a, b] = solid[i], [p, q] = solid[j];
      if (a === p || a === q || b === p || b === q || [a, b, p, q].some(m => m.angle == null)) continue;
      if (crosses(a, b, p, q)) c++;
    }
    return c;
  }
  let best = d3.range(E), bestCost = Infinity;
  if (E <= 9) (function permute(prefix, rest) {   // 첫 경험은 고정해 회전 대칭을 줄인다 (8개면 5040가지)
    if (!rest.length) {
      const slots = []; prefix.forEach((k, pos) => { slots[k] = pos; });
      const c = crossingsFor(slots);
      if (c < bestCost) { bestCost = c; best = prefix.slice(); }
      return;
    }
    rest.forEach((k, idx) => permute(prefix.concat(k), rest.filter((_, r) => r !== idx)));
  })([0], d3.range(1, E));
  others.forEach(n => { n.angle = null; n.x = n.y = undefined; });
  best.forEach((k, pos) => {
    const n = exps[k];
    n.angle = (pos / E) * Math.PI * 2 - Math.PI / 2;
    [n.x, n.y] = ellipse(n.angle, ring(n));
    n.fx = n.x; n.fy = n.y;   // 배치하는 동안만 고정
  });

  // 나머지 노드: 이어진 노드들의 평균 각도에서 출발
  const meanAngle = list => Math.atan2(d3.sum(list, m => Math.sin(m.angle)), d3.sum(list, m => Math.cos(m.angle)));
  for (let round = 0; round < 4; round++) {
    main.filter(n => n.type !== "experience" && !isHub(n)).forEach(n => {
      const placed = mainNbr.get(n.id).map(id => byId.get(id)).filter(m => m.angle != null);
      if (!placed.length) return;
      n.angle = meanAngle(placed);
      [n.x, n.y] = ellipse(n.angle, ring(n) ?? 260);
    });
  }
  main.forEach((n, i) => { if (n.x == null) { n.angle = i; [n.x, n.y] = ellipse(i, 300); } });

  // 타입별 고리로 당기는 힘 (가능성 다리 노드는 고리 없이 이어진 노드 사이에 자리 잡는다)
  // 허브 주변 여백: 허브 둘레 타원 안쪽(가로 HUB_R*KX, 세로 HUB_R)에는 다른 노드가 들어오지 못하게 밀어낸다
  const HUB_R = 145;
  function hubClear(alpha) {
    nodes.forEach(n => {
      if (isHub(n) || n.fx != null) return;
      const ex = n.x / KX, d = Math.hypot(ex, n.y) || 1;
      if (d >= HUB_R) return;
      const push = (HUB_R - d) * (alpha == null ? 1 : Math.min(1, alpha * 4));
      n.x += (ex / d) * push * KX; n.y += (n.y / d) * push;
    });
  }
  function rings(strength) {
    return alpha => nodes.forEach(n => {
      const r = n.orbit ? null : ring(n);
      if (r == null || n.fx != null) return;
      const a = Math.atan2(n.y, n.x / KX), [tx, ty] = ellipse(a, r);
      n.vx += (tx - n.x) * strength * alpha;
      n.vy += (ty - n.y) * strength * alpha;
    });
  }
  const pre = d3.forceSimulation(main)
    .force("link", d3.forceLink(mainLinks).id(d => d.id)
      .distance(e => (isSpoke(e) ? 200 : e.core ? 80 : 120)).strength(e => (isSpoke(e) ? 0 : e.core ? 0.9 : 0.5)))
    .force("charge", d3.forceManyBody().strength(-260).distanceMax(240))
    .force("rings", rings(0.2))
    .force("labels", labelCollide(0.5))
    .force("hubClear", hubClear)
    .stop();
  for (let i = 0; i < 500; i++) pre.tick();

  // 위성: 부모에서 허브 반대쪽(바깥)으로
  const outAngle = p => Math.atan2(p.y, p.x / KX);
  nodes.filter(isSat).forEach(n => {
    const p = byId.get(n.orbit), a = outAngle(p);
    n.x = p.x + Math.cos(a) * 60 * KX; n.y = p.y + Math.sin(a) * 60;
  });
  function outward(alpha) {
    nodes.forEach(n => {
      if (!isSat(n)) return;
      const p = byId.get(n.orbit), a = outAngle(p);
      const tx = p.x + Math.cos(a) * 60 * KX, ty = p.y + Math.sin(a) * 60;
      n.vx += (tx - n.x) * 0.3 * alpha;
      n.vy += (ty - n.y) * 0.3 * alpha;
    });
  }

  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id)
      .distance(e => (isSpoke(e) ? 200 : isSatEdge(e) ? 60 : e.core ? 80 : 110))
      .strength(e => (isSpoke(e) ? 0 : isSatEdge(e) ? 0.4 : e.core ? 0.9 : 0.5)))
    .force("charge", d3.forceManyBody().strength(n => (isSat(n) ? -60 : -260)).distanceMax(240))
    .force("rings", rings(0.2))
    .force("outward", outward)
    .force("labels", labelCollide(0.5))
    .force("hubClear", hubClear)
    .alpha(0.5)
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();
  // 손으로 미세 조정: 노드에 "shift": [dx, dy]가 있으면 그 노드를 옮기고, 주변 노드도 거리에 따라 조금씩 함께 옮긴다
  nodes.filter(n => Array.isArray(n.shift) && n.fx == null).forEach(c => {
    const [dx, dy] = c.shift, R = 260, cx = c.x, cy = c.y;
    nodes.forEach(n => {
      if (isHub(n)) return;
      const d = Math.hypot(n.x - cx, n.y - cy);
      const w = n === c ? 1 : Math.max(0, 1 - d / R) * 0.6;
      n.x += dx * w; n.y += dy * w;
    });
  });
  // 마무리: 남은 글자 겹침만 몇 번 더 정리
  const tidy = labelCollide(0.5); tidy.initialize(nodes);
  for (let i = 0; i < 160; i++) { hubClear(); tidy(); }   // 여백 확보 → 글자 겹침 정리를 번갈아 반복
  for (let i = 0; i < 120; i++) tidy();   // 마지막은 글자 겹침 없애기를 우선
  // 개별 미세 이동: "nudge": [dx, dy]는 배치가 끝난 뒤 그 노드만 옮긴다 (다른 노드 위치는 그대로)
  nodes.filter(n => Array.isArray(n.nudge)).forEach(n => { n.x += n.nudge[0]; n.y += n.nudge[1]; });
  exps.forEach(n => { n.fx = n.fy = null; });

  // "layout" 연결은 배치 계산에만 쓰고 화면에는 그리지 않는다 (노드 위치를 유지한 채 선만 끊을 때)
  const shown = edges.filter(e => !e.layoutOnly);
  const incident = n => shown.filter(e => e.source === n || e.target === n);
  const other = (e, n) => (e.source === n ? e.target : e.source);

  // ── 살아 있는 배치: 평소엔 제자리(home)로, 커서를 올리면 그 노드를 중심으로 포메이션이 바뀐다 ──
  const setHome = () => nodes.forEach(n => { n.hx = n.x; n.hy = n.y; });
  setHome();
  let focus = null, focusNear = new Set();
  function focusForce(alpha) {
    if (!focus) return;
    const h = focus;
    nodes.forEach(n => {
      if (n === h || n.fx != null) return;
      let tx, ty;
      if (focusNear.has(n)) {            // 이어진 노드는 중심 쪽으로 끌려온다
        const k = isHub(h) ? 0.88 : 0.7;   // 허브는 모두와 이어져 있어 살짝만 모은다
        tx = h.x + (n.hx - h.hx) * k;
        ty = h.y + (n.hy - h.hy) * k;
      } else {                           // 가까운 다른 노드는 살짝 비켜난다
        const dx = n.hx - h.hx, dy = n.hy - h.hy, d = Math.hypot(dx, dy) || 1;
        if (d > 280) return;
        const push = 40 * (1 - d / 280);
        tx = n.hx + (dx / d) * push;
        ty = n.hy + (dy / d) * push;
      }
      n.vx += (tx - n.x) * 0.5 * alpha;
      n.vy += (ty - n.y) * 0.5 * alpha;
    });
  }
  const live = d3.forceSimulation(nodes)
    .force("home", () => nodes.forEach(n => {      // alpha와 무관하게 항상 제자리로 당긴다 → 끝까지 정확히 복귀
      n.vx += (n.hx - n.x) * 0.06;
      n.vy += (n.hy - n.y) * 0.06;
    }))
    .force("focus", focusForce)
    .alphaDecay(0.02)
    .stop();
  function setFocus(n) {
    focus = n;
    focusNear = n ? new Set(incident(n).map(e => other(e, n))) : new Set();
    live.alphaTarget(n ? 0.3 : 0).restart();
  }

  // ── 그리기 ──────────────────────────────
  const svg = d3.select("#graph");
  const g = svg.append("g");
  const link = g.append("g").selectAll("path").data(shown).join("path")
    .attr("class", e => "link" + (isSpoke(e) ? " spoke" : "") + (e.core ? " core" : "") + (T[e.source.type].hollow || T[e.target.type].hollow ? " dashed" : ""));

  const typeRank = n => Object.keys(T).indexOf(n.type);
  const stackOrder = (a, b) => typeRank(b) - typeRank(a);   // 순서가 앞인 타입일수록 나중에(위에) 그린다
  const node = g.append("g").selectAll("g").data([...nodes].sort(stackOrder)).join("g")
    .attr("class", n => `node ${n.type}${T[n.type].hollow ? " hollow" : ""}`)
    .attr("style", n => `--c:${colorOf(n)}`)
    .attr("id", n => `node-${n.id}`)
    .attr("tabindex", 0).attr("role", "link").attr("aria-label", n => n.label);
  node.append("circle").attr("class", "hit").attr("r", n => radius(n) + 8);
  node.append("rect").attr("class", "hit");   // 이름 글자 영역도 호버·클릭 대상 (크기는 sizeHits에서)
  node.append("circle").attr("class", "dot").attr("r", radius).attr("fill", colorOf);
  node.append("text").attr("dx", n => radius(n) + 5).attr("dy", 4).text(n => n.label);
  // 이름 영역에 투명한 판을 깐다. 판은 떠오르지 않아 커서 아래에서 빠져나가지 않는다
  function sizeHits() {
    node.each(function (n) {
      const text = this.querySelector("text");
      let b = text.getBBox();
      if (n.hoverLabel) {   // 호버 이름이 더 길면 그만큼 감지 영역도 넓힌다
        text.textContent = n.hoverLabel;
        const h = text.getBBox();
        text.textContent = n.label;
        if (h.width > b.width) b = h;
      }
      d3.select(this).select("rect.hit")
        .attr("x", b.x - 4).attr("y", b.y - 4).attr("width", b.width + 8).attr("height", b.height + 8);
    });
  }
  sizeHits();

  // 무중력처럼 노드마다 다른 박자로 천천히 떠다닌다 (선도 함께 따라간다)
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  nodes.forEach((n, i) => { n.ph = i * 1.7; n.amp = 3 + (i % 3) * 1.5; n.ox = 0; n.oy = 0; });
  const px = n => n.x + n.ox, py = n => n.y + n.oy;

  function draw() {
    link.attr("d", e => `M${px(e.source)},${py(e.source)}L${px(e.target)},${py(e.target)}`);
    node.attr("transform", n => `translate(${px(n)},${py(n)})`);
  }
  draw();
  if (!still) d3.timer(t => {
    if (!$("detail").hidden) return;
    nodes.forEach(n => {
      n.ox = Math.sin(t / 3100 + n.ph) * n.amp * 0.6;
      n.oy = Math.sin(t / 2300 + n.ph * 1.3) * n.amp;
    });
    draw();
  });

  // ── 확대 · 이동 ─────────────────────────
  const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", ev => g.attr("transform", ev.transform));
  svg.call(zoom).on("dblclick.zoom", null);

  function fit(animate) {
    const el = svg.node(), w = el.clientWidth, h = el.clientHeight, mobile = w < 640;
    const top = 60, bottom = mobile ? 130 : 40, side = mobile ? 12 : 40;
    const b = g.node().getBBox();
    const k = Math.min((w - side * 2) / (b.width + 20), (h - top - bottom) / (b.height + 20), 1.3);
    const t = d3.zoomIdentity
      .translate(w / 2 - (b.x + b.width / 2) * k, top + (h - top - bottom) / 2 - (b.y + b.height / 2) * k)
      .scale(k);
    (animate ? svg.transition().duration(500) : svg).call(zoom.transform, t);
  }
  fit(false);
  if (document.fonts) document.fonts.ready.then(() => { sizeHits(); fit(false); });
  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => fit(true), 200); });

  $("btn-refresh").addEventListener("click", () => {
    const before = nodes.map(n => [n.x, n.y]);
    nodes.forEach(n => { if (n.fx == null) { n.x += (Math.random() - 0.5) * 120; n.y += (Math.random() - 0.5) * 120; } });
    sim.alpha(0.8);
    for (let i = 0; i < 300; i++) sim.tick();
    setHome();
    nodes.forEach((n, i) => { [n.x, n.y] = before[i]; n.vx = n.vy = 0; });
    live.alpha(0.6).restart();
    setTimeout(() => fit(true), 900);
  });
  $("btn-full").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });

  // ── 호버: 이어진 것들이 함께 떠오름 · 클릭: 상세 페이지 ──
  // 커서 아래 노드를 맨 위 레이어에 복제해 보여준다.
  // (원본을 DOM에서 옮기면 커서 아래 요소가 바뀌어 호버가 깜빡이므로 <use> 사본을 쓴다)
  const topCopy = g.append("use").attr("class", "top-copy");
  function lift(n) {
    setFocus(n);
    topCopy.attr("href", `#node-${n.id}`);
    const rel = incident(n);
    const near = new Set([n, ...rel.map(e => other(e, n))]);
    svg.classed("hovering", true).classed("hot-possibility", !!T[n.type].hollow);
    link.classed("lift", e => rel.includes(e));
    node.classed("lift", d => near.has(d)).classed("hot", d => d === n)
      .filter(d => near.has(d) && d !== n).raise();   // 커서 아래 노드는 옮기지 않아야 mouseleave가 제대로 온다
    if (n.hoverLabel) node.filter(d => d === n).select("text").text(n.hoverLabel);
  }
  function unlift() {
    if (focus && !dragging) setFocus(null);
    if (svg.classed("hovering")) node.sort(stackOrder);   // 호버로 앞으로 꺼낸 노드를 원래 쌓임 순서로
    svg.classed("hovering", false).classed("hot-possibility", false);
    node.classed("lift", false).classed("hot", false);
    link.classed("lift", false);
    topCopy.attr("href", null);
    node.filter(d => d.hoverLabel).select("text").text(d => d.label);
  }
  let dragging = false;
  const open = n => { location.hash = `#/n/${n.id}`; };
  // 노드 밖으로 나가면 언제나 전체 보기로 돌아간다
  svg.on("mousemove.unlift", ev => { if (!ev.target.closest(".node")) unlift(); })
     .on("mouseleave.unlift", unlift);

  node
    .on("mouseenter", (ev, n) => lift(n))
    .on("mouseleave", unlift)
    .on("click", (ev, n) => open(n))
    .on("keydown", (ev, n) => { if (ev.key === "Enter") open(n); })
    .call(d3.drag().clickDistance(4)
      .on("start", (ev, n) => { dragging = true; setFocus(n); n.fx = n.x; n.fy = n.y; })
      .on("drag", (ev, n) => { n.fx = ev.x; n.fy = ev.y; })
      .on("end", (ev, n) => { dragging = false; n.fx = isHub(n) ? n.hx : null; n.fy = isHub(n) ? n.hy : null; setFocus(null); unlift(); }));

  // ── 상세 페이지 ─────────────────────────
  const detail = $("detail");
  let hideTimer, current = null, currentMd = null, canEdit = false, editing = false;
  // breaks: 엔터 한 번도 그대로 줄바꿈으로 보이게
  const mdToHtml = md => marked.parse(md || "", { gfm: true, breaks: true });
  const typeOrder = Object.keys(T);
  const byType = (a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) || a.label.localeCompare(b.label);

  // 내 Mac의 serve.py로 띄웠을 때만 편집 버튼이 나타난다
  if (["127.0.0.1", "localhost"].includes(location.hostname)) {
    fetch("api/ping").then(r => r.ok && r.json()).then(j => {
      canEdit = !!(j && j.edit);
      if (canEdit && current && !detail.hidden) showDetail(current);
    }).catch(() => {});
  }

  function setBadge(typeKey) {
    const t = T[typeKey], badge = $("d-badge");
    badge.textContent = t.name;
    badge.className = "badge" + (t.hollow ? " hollow" : "");
    badge.style.setProperty("--c", t.color);
  }

  function showDetail(n) {
    clearTimeout(hideTimer);
    if (current !== n) exitEdit();
    current = n;
    const t = T[n.type];
    $("d-kind").textContent = "Node Details";
    setBadge(n.type);
    $("d-title").textContent = n.detailLabel || n.hoverLabel || n.label;
    const rows = [["Type", t.name], ["Period", n.period]]
      .filter(([, v]) => v);
    $("d-rows").innerHTML = rows.map(([k, v]) => `<div class="row"><span class="k">${k}:</span><span class="v">${esc(v)}</span></div>`).join("");
    $("d-summary-wrap").hidden = T[n.type].hollow || (!n.summary && !editing);   // 가능성은 요약 없이 본문만
    $("d-summary").textContent = n.summary || "";

    const rel = incident(n).map(e => other(e, n)).sort(byType);
    $("d-count").textContent = rel.length;
    $("d-related").innerHTML = rel.map(o =>
      `<a class="tag" href="#/n/${esc(o.id)}" style="--c:${colorOf(o)}">${legendDot(o.type)}${esc(o.label)}</a>`).join("");
    $("d-edit").hidden = $("c-edit").hidden = !canEdit || editing;

    loadStory(n);
    detail.hidden = false;
    if (!editing) detail.scrollTop = 0;
    requestAnimationFrame(() => detail.classList.add("show"));
    document.title = `${n.detailLabel || n.hoverLabel || n.label} — ${S.title}`;
    unlift();
  }

  const videoWatch = new IntersectionObserver(entries => entries.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause();
  }), { root: detail, threshold: 0.25 });

  // ── 본문(Story): content/<id>.md ─────────
  // 가능성 노드는 본문을 따로 쓰지 않았으면 이 문장을 보여준다
  const POSSIBILITY_STORY = "무한한 가능성이 존재합니다. 다양한 섹터의 경험을 연결하고 있습니다.";
  function renderStory(n) {
    const md = currentMd?.trim() ? currentMd : T[n.type].hollow ? POSSIBILITY_STORY : "";
    const has = md.trim().length > 0;
    const linkHtml = n.link ? `<p><a href="${esc(n.link.href)}" target="_blank" rel="noopener">${esc(n.link.text || n.link.href)} ↗</a></p>` : "";
    $("d-body").innerHTML = has ? mdToHtml(md) + linkHtml
      : canEdit ? `<p class="todo">✎ Edit을 눌러 이야기와 그림을 올려보세요.</p>` + linkHtml
      : linkHtml;
    // 본문 영상(.gs-video)은 화면에 보일 때만 불러와 재생한다 (여러 개라도 가볍게)
    $("d-body").querySelectorAll("video.gs-video").forEach(v => videoWatch.observe(v));
    // 외부 링크(Colab 등)는 새 탭으로 연다
    $("d-body").querySelectorAll('a[href^="http"]').forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
    // 게시된 사이트에서는 내용이 없으면 Story 칸을 숨긴다
    $("d-body-wrap").hidden = !has && !linkHtml && !canEdit;
  }
  async function loadStory(n) {
    currentMd = null;
    renderStory(n);
    try {
      const r = await fetch(`content/${encodeURIComponent(n.id)}.md`, { cache: "no-store" });
      if (current !== n) return;
      if (r.ok) { currentMd = await r.text(); renderStory(n); }
    } catch (e) { /* 본문 파일이 없으면 비워 둔다 */ }
  }

  // ── 편집 모드: 이름 · 타입 · 연결 · 본문 ───
  const edText = $("ed-text"), edStatus = $("ed-status");
  const preview = () => { $("ed-preview").innerHTML = mdToHtml(edText.value); };
  let draftLinks = [];

  // 직접 고칠 수 있는 연결 = data/graph.json의 edges + (위성이면) 부모
  const explicitLinks = n => [
    ...S.edges.filter(e => e.includes(n.id) && e[2] !== "layout").map(e => (e[0] === n.id ? e[1] : e[0])),
    ...(n.orbit ? [n.orbit] : [])
  ].filter((id, i, a) => byId.has(id) && a.indexOf(id) === i);

  // 자동 연결: 허브(가능성 제외 모두)와 이 노드의 위성
  function autoLinks(n, typeKey) {
    if (T[typeKey].hub) return nodes.filter(m => m !== n && !T[m.type].hollow).map(m => [m, "자동 · 허브"]);
    const out = T[typeKey].hollow ? [] : hubs.filter(h => h !== n).map(h => [h, "자동 · 허브"]);
    return out.concat(nodes.filter(m => m.orbit === n.id).map(m => [m, "자동 · 위성"]));
  }

  function renderLinkEditor() {
    const n = current, typeKey = $("e-type").value;
    const auto = autoLinks(n, typeKey);
    const chip = (m, extra) => `<span class="tag" style="--c:${colorOf(m)}">${legendDot(m.type)}${esc(m.label)}${extra}</span>`;
    $("e-links").innerHTML =
      draftLinks.map(id => byId.get(id)).sort(byType).map(m =>
        chip(m, `<button type="button" class="x" data-remove="${esc(m.id)}" title="연결 끊기">×</button>`)).join("") +
      auto.map(([m, why]) => chip(m, `<span class="lock">${why}</span>`)).join("");

    // 추가할 수 있는 현존 노드 (허브는 자동이라 제외)
    const taken = new Set([n.id, ...draftLinks, ...auto.map(([m]) => m.id)]);
    const cand = nodes.filter(m => !taken.has(m.id) && !T[m.type].hub);
    $("e-add").innerHTML = `<option value="">＋ 연결할 노드 선택…</option>` +
      typeOrder.filter(k => cand.some(m => m.type === k)).map(k =>
        `<optgroup label="${esc(T[k].name)}">${cand.filter(m => m.type === k).sort(byType)
          .map(m => `<option value="${esc(m.id)}">${esc(m.label)}${m.orbit ? ` (${esc(byId.get(m.orbit)?.label || "")}의 위성)` : ""}</option>`).join("")}</optgroup>`).join("");
    const hint = T[typeKey].hollow
      ? (draftLinks.length === 1 ? "연결이 하나뿐이라 그 노드의 위성으로 저장됩니다." : "가능성 노드는 허브와 직접 연결되지 않습니다.")
      : "";
    $("e-hint").textContent = hint;
  }

  async function enterEdit(focusLinks) {
    if (!canEdit || !current) return;
    editing = true;
    const n = current;
    // 허브이거나 따로 정한 호버 이름·상세 제목이 있는 노드는 세 이름을 각각 고친다
    aliasMode = isHub(n) || !!(n.hoverLabel || n.detailLabel);
    detail.classList.toggle("alias", aliasMode);
    $("e-label").value = aliasMode ? (n.detailLabel || n.hoverLabel || n.label) : n.label;
    $("e-label").placeholder = aliasMode ? "상세 페이지 제목" : "노드 이름";
    $("e-map").value = n.label;
    $("e-hover").value = n.hoverLabel || "";
    $("e-summary").value = n.summary || "";
    $("d-summary-wrap").hidden = !!T[n.type].hollow;
    $("e-type").innerHTML = typeOrder.map(k => `<option value="${k}"${k === n.type ? " selected" : ""}>${esc(T[k].name)}</option>`).join("");
    draftLinks = explicitLinks(n);
    edText.value = currentMd ?? "";
    preview();
    edStatus.textContent = "";
    renderLinkEditor();
    detail.classList.add("editing");
    $("d-edit").hidden = $("c-edit").hidden = true;
    $("d-body-wrap").hidden = false;
    (focusLinks ? $("e-add") : $("e-label")).focus();
    if (focusLinks) $("e-links-wrap").scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function exitEdit() {
    editing = false;
    detail.classList.remove("editing");
    if (current) {
      $("d-edit").hidden = $("c-edit").hidden = !canEdit;
      $("d-summary-wrap").hidden = T[current.type].hollow || !current.summary;
      renderStory(current);
    }
  }

  let aliasMode = false;
  async function save() {
    const n = current;
    if (!n) return;
    const title = $("e-label").value.trim();
    const label = aliasMode ? $("e-map").value.trim() : title;
    if (!label) { edStatus.textContent = "이름을 입력하세요."; return (aliasMode ? $("e-map") : $("e-label")).focus(); }
    const names = aliasMode ? { label, hoverLabel: $("e-hover").value, detailLabel: title === label ? "" : title } : { label };
    edStatus.textContent = "저장 중…";
    try {
      const post = (url, body, type) => fetch(url, { method: "POST", headers: { "Content-Type": type }, body })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); });
      await post(`api/node/${encodeURIComponent(n.id)}`, JSON.stringify({ ...names, summary: $("e-summary").value, type: $("e-type").value, links: draftLinks }), "application/json");
      if (edText.value !== (currentMd ?? "")) await post(`api/content/${encodeURIComponent(n.id)}`, edText.value, "text/markdown; charset=utf-8");
      location.reload();   // 바뀐 연결로 관계도를 다시 그린다 (지금 보던 상세 페이지로 돌아옴)
    } catch (e) {
      edStatus.textContent = `저장 실패: ${e.message}`;
    }
  }

  function insertAtCursor(text) {
    const a = edText.selectionStart, b = edText.selectionEnd;
    edText.value = edText.value.slice(0, a) + text + edText.value.slice(b);
    edText.selectionStart = edText.selectionEnd = a + text.length;
    preview();
  }
  async function upload(files) {
    for (const f of [...files].filter(f => f.type.startsWith("image/"))) {
      edStatus.textContent = `그림 올리는 중… ${f.name}`;
      try {
        const r = await fetch("api/upload", { method: "POST", headers: { "X-Filename": encodeURIComponent(f.name || "image.png") }, body: f });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        insertAtCursor(`\n![${(f.name || "").replace(/\.[^.]+$/, "")}](${j.path})\n`);
        edStatus.textContent = `그림 추가됨 · ${j.path} (저장을 눌러야 반영)`;
      } catch (e) {
        edStatus.textContent = `그림 올리기 실패: ${e.message}`;
      }
    }
  }

  $("d-edit").addEventListener("click", () => enterEdit(false));
  $("c-edit").addEventListener("click", () => enterEdit(true));
  $("ed-cancel").addEventListener("click", exitEdit);
  $("ed-save").addEventListener("click", save);
  $("e-type").addEventListener("change", () => {
    setBadge($("e-type").value);
    $("d-summary-wrap").hidden = !!T[$("e-type").value].hollow;
    renderLinkEditor();
  });
  $("e-add").addEventListener("change", ev => {
    if (ev.target.value) draftLinks.push(ev.target.value);
    renderLinkEditor();
  });
  $("e-links").addEventListener("click", ev => {
    const id = ev.target.dataset.remove;
    if (id) { draftLinks = draftLinks.filter(x => x !== id); renderLinkEditor(); }
  });
  $("ed-file").addEventListener("change", ev => { upload(ev.target.files); ev.target.value = ""; });
  edText.addEventListener("input", preview);

  // 서식 단축키: 선택한 글자를 감싸고, 이미 감싸져 있으면 푼다 (insertText라 ⌘Z로 되돌릴 수 있다)
  function wrap(before, after = before, placeholder = "") {
    const v = edText.value;
    let a = edText.selectionStart, b = edText.selectionEnd;
    const sel = v.slice(a, b);
    edText.focus();
    if (v.slice(a - before.length, a) === before && v.slice(b, b + after.length) === after) {
      edText.setSelectionRange(a - before.length, b + after.length);
      document.execCommand("insertText", false, sel);
      edText.setSelectionRange(a - before.length, b - before.length);
    } else {
      const text = sel || placeholder;
      document.execCommand("insertText", false, before + text + after);
      edText.setSelectionRange(a + before.length, a + before.length + text.length);
    }
    preview();
  }
  function prefixLines(mark) {   // 선택한 줄 앞에 목록·인용·제목 기호를 붙이거나 뗀다
    const v = edText.value;
    const a = v.lastIndexOf("\n", edText.selectionStart - 1) + 1;
    let b = v.indexOf("\n", edText.selectionEnd); if (b < 0) b = v.length;
    const lines = v.slice(a, b).split("\n");
    const all = lines.every(l => l.startsWith(mark));
    const out = lines.map(l => (all ? l.slice(mark.length) : mark + l)).join("\n");
    edText.focus();
    edText.setSelectionRange(a, b);
    document.execCommand("insertText", false, out);
    edText.setSelectionRange(a, a + out.length);
    preview();
  }
  const shortcuts = {
    b: () => wrap("**", "**", "굵게"),
    i: () => wrap("*", "*", "기울임"),
    k: () => wrap("[", "](https://)", "링크"),
    e: () => wrap("`", "`", "코드"),
    "shift+x": () => wrap("~~", "~~", "취소선"),
    "shift+8": () => prefixLines("- "),
    "shift+7": () => prefixLines("1. "),
    "shift+.": () => prefixLines("> "),
    "shift+h": () => prefixLines("## ")
  };
  edText.addEventListener("keydown", ev => {
    if (!(ev.metaKey || ev.ctrlKey) || ev.altKey) return;
    const key = (ev.shiftKey ? "shift+" : "") + (ev.code.startsWith("Key") ? ev.code.slice(3).toLowerCase()
      : ev.code.startsWith("Digit") ? ev.code.slice(5) : ev.code === "Period" ? "." : ev.key.toLowerCase());
    if (shortcuts[key]) { ev.preventDefault(); shortcuts[key](); }
  });
  document.querySelectorAll("[data-fmt]").forEach(btn =>
    btn.addEventListener("click", () => shortcuts[btn.dataset.fmt]()));
  detail.addEventListener("keydown", ev => { if (editing && (ev.metaKey || ev.ctrlKey) && ev.key === "s") { ev.preventDefault(); save(); } });
  edText.addEventListener("paste", ev => { if (ev.clipboardData.files.length) { ev.preventDefault(); upload(ev.clipboardData.files); } });
  edText.addEventListener("dragover", ev => { ev.preventDefault(); edText.classList.add("drop"); });
  edText.addEventListener("dragleave", () => edText.classList.remove("drop"));
  edText.addEventListener("drop", ev => { ev.preventDefault(); edText.classList.remove("drop"); upload(ev.dataTransfer.files); });
  addEventListener("beforeunload", ev => { if (editing && !saving()) { ev.preventDefault(); } });
  const saving = () => edStatus.textContent === "저장 중…";

  function hideDetail() {
    exitEdit();
    detail.classList.remove("show");
    hideTimer = setTimeout(() => { detail.hidden = true; }, 200);
    document.title = S.title;
  }
  function route() {
    const m = location.hash.match(/^#\/n\/(.+)$/);
    const n = m && byId.get(decodeURIComponent(m[1]));
    n ? showDetail(n) : hideDetail();
  }
  // 카드 바깥(도트 배경)을 누르면 ← Graph와 같이 관계도로 돌아간다 (편집 중에는 실수 방지로 무시)
  detail.addEventListener("click", ev => {
    if (editing || getSelection().toString()) return;
    if (ev.target === detail || ev.target.classList.contains("detail-inner")) location.hash = "#/";
  });
  addEventListener("hashchange", route);
  addEventListener("keydown", ev => {
    if (ev.key !== "Escape" || detail.hidden) return;
    if (editing) return exitEdit();   // 편집 중 Esc는 편집만 취소
    location.hash = "#/";
  });
  route();
})();
