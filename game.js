// ----- Config -----
const GRID_SIZE = 6;
let CELL_SIZE   = 70;
let POINT_RADIUS = 8;
let POINT_OFFSET = 35;

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// Game state
let bluePos  = { x: 0, y: GRID_SIZE - 1 };
let redPos   = { x: GRID_SIZE - 1, y: 0 };
let edges    = [];
let gameOver = false;
let gameMode = 'offense'; // 'offense' | 'defense' | 'twoPlayer'
let redTurn      = false;  // blue always goes first
let aiThinking   = false;
let aiGeneration = 0;
let nextAutoMode = 'offense'; // alternates: offense → defense → offense → ...
let modeLocked   = false;     // when true, auto-alternating is frozen

// =====================================================================
// CANVAS RESIZE (responsive + HiDPI)
// =====================================================================
function resizeCanvas() {
  const dpr       = window.devicePixelRatio || 1;
  const W         = window.innerWidth;
  const H         = window.innerHeight;
  const isTouch   = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isLandscape = W > H;

  let available;
  const isDesktop = W >= 1025 && !isTouch;
  const isTablet  = isTouch && W >= 1025;

  if (isDesktop)        available = Math.min(W * 0.62, H * 0.66, 520);
  else if (isLandscape) available = Math.min(W * (isTablet ? 0.50 : 0.46), H * 0.88);
  else                  available = Math.min(W * 0.92, H * 0.50);

  const cell    = Math.max(36, Math.floor(available / GRID_SIZE));
  const logical = cell * GRID_SIZE;

  CELL_SIZE    = cell;
  POINT_OFFSET = cell / 2;
  POINT_RADIUS = Math.max(5, Math.round(cell * 0.115));

  canvas.width        = logical * dpr;
  canvas.height       = logical * dpr;
  canvas.style.width  = logical + 'px';
  canvas.style.height = logical + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// =====================================================================
// GAME TITLE + MODE UI (badge, button, canvas border)
// =====================================================================
function updateGameTitle() {
  const title = document.getElementById('gameTitle');
  const badge = document.getElementById('modeBadge');
  const btn   = document.getElementById('modeBtn');
  const label = document.getElementById('modeBtnLabel');

  if (gameMode === 'offense') {
    title.innerHTML = 'You are the <span style="color:#3182ce">blue</span> point, try to <i>catch</i> the <span style="color:#e53e3e">red</span> point';
    if (badge) { badge.textContent = 'OFFENSE'; badge.className = 'mode-badge offense'; }
    if (btn)   btn.dataset.mode = 'offense';
    if (label) label.textContent = 'Offense';
  } else if (gameMode === 'defense') {
    title.innerHTML = 'You are the <span style="color:#3182ce">blue</span> point, try to <i>evade</i> the <span style="color:#e53e3e">red</span> point';
    if (badge) { badge.textContent = 'DEFENSE'; badge.className = 'mode-badge defense'; }
    if (btn)   btn.dataset.mode = 'defense';
    if (label) label.textContent = 'Defense';
  } else {
    title.textContent = 'Two Player Mode';
    if (badge) { badge.textContent = 'TWO PLAYER'; badge.className = 'mode-badge twoplayer'; }
    if (btn)   btn.dataset.mode = 'twoplayer';
    if (label) label.textContent = 'Two Player';
  }
  canvas.dataset.mode = gameMode;
}

// =====================================================================
// POSITIONS
// =====================================================================
function initializePositions() {
  const leftCorners = [{ x: 0, y: 0 }, { x: 0, y: GRID_SIZE - 1 }];
  const blueCorner  = leftCorners[Math.floor(Math.random() * 2)];

  if (gameMode === 'offense') {
    bluePos = { ...blueCorner };
    const defRow = Math.random() < 0.5 ? blueCorner.y : (blueCorner.y === 0 ? 1 : blueCorner.y - 1);
    redPos = { x: GRID_SIZE - 1, y: defRow };
  } else if (gameMode === 'defense') {
    const rightCorners = [{ x: GRID_SIZE - 1, y: 0 }, { x: GRID_SIZE - 1, y: GRID_SIZE - 1 }];
    const redCorner    = rightCorners[Math.floor(Math.random() * 2)];
    redPos = { ...redCorner };
    const defRow = Math.random() < 0.5 ? redCorner.y : (redCorner.y === 0 ? 1 : redCorner.y - 1);
    bluePos = { x: 0, y: defRow };
  } else {
    bluePos = { ...blueCorner };
    const defRow = Math.random() < 0.5 ? blueCorner.y : (blueCorner.y === 0 ? 1 : blueCorner.y - 1);
    redPos = { x: GRID_SIZE - 1, y: defRow };
  }
}

// =====================================================================
// EDGES
// =====================================================================
function initializeEdges() {
  edges = [];
  for (let y = 0; y < GRID_SIZE; y++)
    for (let x = 0; x < GRID_SIZE - 1; x++)
      edges.push({ x1: x, y1: y, x2: x + 1, y2: y, active: true });
  for (let x = 0; x < GRID_SIZE; x++)
    for (let y = 0; y < GRID_SIZE - 1; y++)
      edges.push({ x1: x, y1: y, x2: x, y2: y + 1, active: true });
  removeInitialEdges();
}

function removeInitialEdges() {
  let internal = edges.filter(e =>
    !(e.x1 === 0 || e.x1 === GRID_SIZE - 1 || e.x2 === 0 || e.x2 === GRID_SIZE - 1 ||
      e.y1 === 0 || e.y1 === GRID_SIZE - 1 || e.y2 === 0 || e.y2 === GRID_SIZE - 1)
  );
  for (let i = 0; i < 4 && internal.length; i++) {
    const idx = Math.floor(Math.random() * internal.length);
    const sel = internal.splice(idx, 1)[0];
    const mi  = edges.findIndex(e => e.x1 === sel.x1 && e.y1 === sel.y1 && e.x2 === sel.x2 && e.y2 === sel.y2);
    if (mi !== -1) edges[mi].active = false;
  }
}

// =====================================================================
// DRAWING
// =====================================================================
function drawGame() {
  const W = GRID_SIZE * CELL_SIZE;
  ctx.clearRect(0, 0, W, W);

  // Faint removed edges
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth   = 1;
  for (const e of edges) {
    if (!e.active) {
      ctx.beginPath();
      ctx.moveTo(e.x1 * CELL_SIZE + POINT_OFFSET, e.y1 * CELL_SIZE + POINT_OFFSET);
      ctx.lineTo(e.x2 * CELL_SIZE + POINT_OFFSET, e.y2 * CELL_SIZE + POINT_OFFSET);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Active edges
  ctx.strokeStyle = '#555';
  ctx.lineWidth   = 2;
  for (const e of edges) {
    if (e.active) {
      ctx.beginPath();
      ctx.moveTo(e.x1 * CELL_SIZE + POINT_OFFSET, e.y1 * CELL_SIZE + POINT_OFFSET);
      ctx.lineTo(e.x2 * CELL_SIZE + POINT_OFFSET, e.y2 * CELL_SIZE + POINT_OFFSET);
      ctx.stroke();
    }
  }

  // Grid node dots
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      ctx.beginPath();
      ctx.arc(x * CELL_SIZE + POINT_OFFSET, y * CELL_SIZE + POINT_OFFSET, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#bbb';
      ctx.fill();
    }
  }

  // Player points
  const drawPoint = (pos, color) => {
    ctx.beginPath();
    ctx.arc(pos.x * CELL_SIZE + POINT_OFFSET, pos.y * CELL_SIZE + POINT_OFFSET, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 2;
    ctx.stroke();
  };

  const msg = document.getElementById('message').textContent || '';
  if (gameOver && (msg.includes('Caught') || msg.includes('joined'))) {
    // Single purple point — show it at the catching player's position
    drawPoint(gameMode === 'defense' ? redPos : bluePos, '#8A2BE2');
  } else {
    drawPoint(redPos,  '#e53e3e');
    drawPoint(bluePos, '#3182ce');
  }
}

// =====================================================================
// GRAPH UTILITIES (used outside AI — simple edge scan)
// =====================================================================
function getValidMoves(pos) {
  const dirs  = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }];
  const moves = [];
  for (const d of dirs) {
    const np = { x: pos.x + d.dx, y: pos.y + d.dy };
    if (np.x < 0 || np.x >= GRID_SIZE || np.y < 0 || np.y >= GRID_SIZE) continue;
    if (edges.some(e => e.active &&
      ((e.x1 === pos.x && e.y1 === pos.y && e.x2 === np.x && e.y2 === np.y) ||
       (e.x2 === pos.x && e.y2 === pos.y && e.x1 === np.x && e.y1 === np.y))
    )) moves.push(np);
  }
  return moves;
}

function findShortestPath(start, end) {
  const visited = new Set();
  const queue   = [[start]];
  while (queue.length) {
    const path = queue.shift();
    const cur  = path[path.length - 1];
    if (cur.x === end.x && cur.y === end.y) return path;
    const key = `${cur.x},${cur.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const mv of getValidMoves(cur))
      if (!visited.has(`${mv.x},${mv.y}`)) queue.push([...path, mv]);
  }
  return null;
}

// =====================================================================
// FAST GRAPH UTILITIES (used inside AI minimax)
// node index = y * GRID_SIZE + x  (0-35 for 6×6)
// edge key   = from_idx * 36 + to_idx
// =====================================================================
let adjSet = new Set();

function buildAdjSet() {
  adjSet = new Set();
  for (const e of edges) {
    if (!e.active) continue;
    const a = e.y1 * GRID_SIZE + e.x1;
    const b = e.y2 * GRID_SIZE + e.x2;
    adjSet.add(a * 36 + b);
    adjSet.add(b * 36 + a);
  }
}

function getValidMovesFast(pos) {
  const from  = (pos.y * GRID_SIZE + pos.x) * 36;
  const moves = [];
  if (pos.x > 0           && adjSet.has(from + pos.y * GRID_SIZE + (pos.x - 1))) moves.push({ x: pos.x - 1, y: pos.y });
  if (pos.x < GRID_SIZE-1 && adjSet.has(from + pos.y * GRID_SIZE + (pos.x + 1))) moves.push({ x: pos.x + 1, y: pos.y });
  if (pos.y > 0           && adjSet.has(from + (pos.y - 1) * GRID_SIZE + pos.x)) moves.push({ x: pos.x, y: pos.y - 1 });
  if (pos.y < GRID_SIZE-1 && adjSet.has(from + (pos.y + 1) * GRID_SIZE + pos.x)) moves.push({ x: pos.x, y: pos.y + 1 });
  return moves;
}

// BFS distance on the cached adjSet (returns Infinity if disconnected)
function bfsDistFast(start, end) {
  if (start.x === end.x && start.y === end.y) return 0;
  const vis = new Uint8Array(GRID_SIZE * GRID_SIZE);
  vis[start.y * GRID_SIZE + start.x] = 1;
  const q = [{ pos: start, d: 0 }];
  let qi = 0;
  while (qi < q.length) {
    const { pos, d } = q[qi++];
    for (const mv of getValidMovesFast(pos)) {
      if (mv.x === end.x && mv.y === end.y) return d + 1;
      const k = mv.y * GRID_SIZE + mv.x;
      if (!vis[k]) { vis[k] = 1; q.push({ pos: mv, d: d + 1 }); }
    }
  }
  return Infinity;
}

// Dual-BFS Voronoi — counts nodes "owned" by each player (first to reach wins ties)
function computeTerritory(redP, blueP) {
  const owner = new Int8Array(GRID_SIZE * GRID_SIZE).fill(-1);
  owner[redP.y  * GRID_SIZE + redP.x]  = 0;
  owner[blueP.y * GRID_SIZE + blueP.x] = 1;
  const q = [{ pos: redP, own: 0 }, { pos: blueP, own: 1 }];
  let qi = 0, redCount = 1, blueCount = 1;
  while (qi < q.length) {
    const { pos, own } = q[qi++];
    for (const mv of getValidMovesFast(pos)) {
      const k = mv.y * GRID_SIZE + mv.x;
      if (owner[k] === -1) {
        owner[k] = own;
        q.push({ pos: mv, own });
        if (own === 0) redCount++; else blueCount++;
      }
    }
  }
  return { redCount, blueCount };
}

// Count nodes reachable from pos (uses the live edges array — no adjSet needed)
function countReachable(pos) {
  const visited = new Set();
  const q = [pos];
  visited.add(pos.y * GRID_SIZE + pos.x);
  let qi = 0;
  while (qi < q.length) {
    const cur = q[qi++];
    for (const mv of getValidMoves(cur)) {
      const k = mv.y * GRID_SIZE + mv.x;
      if (!visited.has(k)) { visited.add(k); q.push(mv); }
    }
  }
  return visited.size;
}

// Fast version using adjSet (for use inside AI minimax only)
function countReachableFast(pos) {
  const vis = new Uint8Array(GRID_SIZE * GRID_SIZE);
  vis[pos.y * GRID_SIZE + pos.x] = 1;
  const q = [pos];
  let qi = 0, count = 1;
  while (qi < q.length) {
    const cur = q[qi++];
    for (const mv of getValidMovesFast(cur)) {
      const k = mv.y * GRID_SIZE + mv.x;
      if (!vis[k]) { vis[k] = 1; q.push(mv); count++; }
    }
  }
  return count;
}

function isCorner(pos) {
  return (pos.x === 0 || pos.x === GRID_SIZE - 1) && (pos.y === 0 || pos.y === GRID_SIZE - 1);
}
function isEdge(pos) {
  return pos.x === 0 || pos.x === GRID_SIZE - 1 || pos.y === 0 || pos.y === GRID_SIZE - 1;
}
function manhattanDist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// =====================================================================
// HEURISTICS (used only for tiebreaking when BFS distances are equal)
// =====================================================================
function evaluateEvade(redP, blueP) {
  const dist = bfsDistFast(blueP, redP);
  if (dist === Infinity) return 100000 + countReachableFast(redP);
  // BFS distance is primary. Component size is a pure tiebreaker (max 36 pts << 1000 per step).
  return dist * 1000 + countReachableFast(redP);
}

function evaluateAttack(redP, blueP) {
  const dist = bfsDistFast(redP, blueP);
  if (dist === Infinity) return -100000;
  // Closer = better. Smaller blue component = better tiebreaker.
  return -dist * 1000 - countReachableFast(blueP);
}

// =====================================================================
// MINIMAX (shallow — only called to break ties between equal-BFS moves)
// =====================================================================
function minimaxEvade(redP, blueP, depth, isRedTurn, alpha, beta) {
  if (redP.x === blueP.x && redP.y === blueP.y) return -100000;
  const dist = bfsDistFast(blueP, redP);
  if (dist === Infinity) return 100000 + countReachableFast(redP);
  if (depth === 0) return evaluateEvade(redP, blueP);

  if (isRedTurn) {
    let moves = getValidMovesFast(redP);
    if (!moves.length) return evaluateEvade(redP, blueP);
    moves.sort((a, b) => manhattanDist(b, blueP) - manhattanDist(a, blueP)); // far-first
    let best = -Infinity;
    for (const mv of moves) {
      const v = minimaxEvade(mv, blueP, depth - 1, false, alpha, beta);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let moves = getValidMovesFast(blueP);
    if (!moves.length) return evaluateEvade(redP, blueP);
    moves.sort((a, b) => manhattanDist(a, redP) - manhattanDist(b, redP)); // close-first
    let worst = Infinity;
    for (const mv of moves) {
      const v = minimaxEvade(redP, mv, depth - 1, true, alpha, beta);
      if (v < worst) worst = v;
      if (worst < beta) beta = worst;
      if (beta <= alpha) break;
    }
    return worst;
  }
}

function minimaxAttack(redP, blueP, depth, isRedTurn, alpha, beta) {
  if (redP.x === blueP.x && redP.y === blueP.y) return 100000;
  const dist = bfsDistFast(redP, blueP);
  if (dist === Infinity) return -100000;
  if (depth === 0) return evaluateAttack(redP, blueP);

  if (isRedTurn) {
    let moves = getValidMovesFast(redP);
    if (!moves.length) return evaluateAttack(redP, blueP);
    moves.sort((a, b) => manhattanDist(a, blueP) - manhattanDist(b, blueP)); // close-first
    let best = -Infinity;
    for (const mv of moves) {
      const v = minimaxAttack(mv, blueP, depth - 1, false, alpha, beta);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let moves = getValidMovesFast(blueP);
    if (!moves.length) return evaluateAttack(redP, blueP);
    moves.sort((a, b) => manhattanDist(b, redP) - manhattanDist(a, redP)); // far-first
    let worst = Infinity;
    for (const mv of moves) {
      const v = minimaxAttack(redP, mv, depth - 1, true, alpha, beta);
      if (v < worst) worst = v;
      if (worst < beta) beta = worst;
      if (beta <= alpha) break;
    }
    return worst;
  }
}

// =====================================================================
// AI — EVADE  (offense mode: red maximizes BFS distance from blue)
//
// GREEDY FIRST: compute immediate BFS distance for every valid move and
// always pick the maximum. This is mathematically guaranteed to move in
// the correct direction — no heuristic can override it.
//
// TIEBREAKER: when multiple moves share the same best BFS distance,
// use a shallow minimax (depth 4) to pick the strategically safer one
// (prefers larger component = more future escape routes).
// =====================================================================
function moveRedEvade(nextBluePos) {
  const valids = getValidMoves(redPos);
  if (!valids.length) return false;
  buildAdjSet();

  // Score every candidate by immediate BFS distance from blue.
  // Moving onto blue's cell = caught = worst possible (-1).
  let maxDist = -1;
  const scored = [];
  for (const mv of valids) {
    const d = (mv.x === nextBluePos.x && mv.y === nextBluePos.y)
              ? -1
              : bfsDistFast(nextBluePos, mv);
    scored.push({ mv, d });
    if (d > maxDist) maxDist = d;
  }

  const tied = scored.filter(s => s.d === maxDist);

  // Unique greedy best — take it immediately. No ambiguity, no second-guessing.
  if (tied.length === 1) { redPos = tied[0].mv; return true; }

  // Multiple moves tie on immediate BFS distance.
  // Use a shallow minimax to pick the safest one (larger component, harder to trap).
  let bestMove = tied[0].mv, bestScore = -Infinity;
  for (const { mv } of tied) {
    const score = minimaxEvade(mv, nextBluePos, 4, false, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; bestMove = mv; }
  }
  redPos = bestMove;
  return true;
}

// =====================================================================
// AI — ATTACK  (defense mode: red minimizes BFS distance to blue)
//
// Same greedy-first guarantee: always moves to the cell with the lowest
// BFS distance to blue. Ties broken by shallow minimax (prefer smaller
// blue component = blue more cornered).
// =====================================================================
function moveRedAttack(nextBluePos) {
  const valids = getValidMoves(redPos);
  if (!valids.length) return false;

  // Instant win: step directly onto blue's current cell.
  for (const mv of valids) {
    if (mv.x === nextBluePos.x && mv.y === nextBluePos.y) { redPos = mv; return true; }
  }

  buildAdjSet();

  // Score every candidate by immediate BFS distance to blue (want minimum).
  let minDist = Infinity;
  const scored = [];
  for (const mv of valids) {
    const d = bfsDistFast(mv, nextBluePos);
    scored.push({ mv, d });
    if (d < minDist) minDist = d;
  }

  const tied = scored.filter(s => s.d === minDist);

  // Unique greedy best — take it immediately.
  if (tied.length === 1) { redPos = tied[0].mv; return true; }

  // Tiebreak with shallow minimax.
  let bestMove = tied[0].mv, bestScore = -Infinity;
  for (const { mv } of tied) {
    const score = minimaxAttack(mv, nextBluePos, 4, false, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; bestMove = mv; }
  }
  redPos = bestMove;
  return true;
}

// =====================================================================
// EDGE / GAME-OVER HELPERS
// =====================================================================
function removeRandomEdge() {
  const active = edges.filter(e => e.active);
  if (!active.length) return false;
  active[Math.floor(Math.random() * active.length)].active = false;
  return true;
}

function checkCrossPath(oldBlue, newBlue, oldRed, newRed) {
  if (newBlue.x === newRed.x && newBlue.y === newRed.y) return true;
  if (oldBlue.x === newRed.x && oldBlue.y === newRed.y &&
      oldRed.x  === newBlue.x && oldRed.y  === newBlue.y) return true;
  return false;
}

function checkGameOver() {
  const el = document.getElementById('message');
  if (bluePos.x === redPos.x && bluePos.y === redPos.y) {
    gameOver = true;
    if (gameMode === 'offense') {
      el.textContent = 'Blue Wins \u2014 Points are joined'; el.className = 'blue-wins';
    } else if (gameMode === 'defense') {
      el.textContent = 'Red Wins \u2014 Points are joined';  el.className = 'red-wins';
    } else {
      // Two-player: whoever moved last wins.
      // redTurn=false  → red just moved onto blue → red wins
      // redTurn=true   → blue just moved onto red → blue wins
      if (!redTurn) { el.textContent = 'Red Wins \u2014 Points are joined';  el.className = 'red-wins'; }
      else          { el.textContent = 'Blue Wins \u2014 Points are joined'; el.className = 'blue-wins'; }
    }
    return true;
  }
  const path = findShortestPath(bluePos, redPos);
  if (!path) {
    gameOver = true;
    if (gameMode === 'offense') {
      el.textContent = 'Red Wins \u2014 Points are separated';  el.className = 'red-wins';
    } else if (gameMode === 'defense') {
      el.textContent = 'Blue Wins \u2014 Points are separated'; el.className = 'blue-wins';
    } else {
      // Two-player separation: the player in the larger component wins
      const redReach  = countReachable(redPos);
      const blueReach = countReachable(bluePos);
      if (redReach >= blueReach) { el.textContent = 'Red Wins \u2014 Points are separated';  el.className = 'red-wins'; }
      else                       { el.textContent = 'Blue Wins \u2014 Points are separated'; el.className = 'blue-wins'; }
    }
    return true;
  }
  return false;
}

// =====================================================================
// MOVE HANDLER
// =====================================================================
function handleMove(key) {
  if (gameOver || aiThinking) return;

  if (gameMode !== 'twoPlayer') {
    // ── Single-player: Blue moves → 1 edge removed → Red moves → 1 edge removed ──
    let proposedBlue = { ...bluePos };
    switch (key) {
      case 'ArrowLeft':  if (bluePos.x > 0)            proposedBlue.x--; break;
      case 'ArrowRight': if (bluePos.x < GRID_SIZE - 1) proposedBlue.x++; break;
      case 'ArrowUp':    if (bluePos.y > 0)            proposedBlue.y--; break;
      case 'ArrowDown':  if (bluePos.y < GRID_SIZE - 1) proposedBlue.y++; break;
      default: return;
    }
    if (!getValidMoves(bluePos).some(p => p.x === proposedBlue.x && p.y === proposedBlue.y)) return;

    bluePos = proposedBlue;
    removeRandomEdge();
    if (checkGameOver()) { drawGame(); return; }
    drawGame(); // show blue's move immediately

    // Red responds after a short delay so the player can see each turn
    aiThinking = true;
    const gen  = ++aiGeneration;
    setTimeout(() => {
      if (gen !== aiGeneration) { aiThinking = false; return; } // reset happened
      if (!gameOver) {
        if (gameMode === 'offense') moveRedEvade(bluePos);
        else                        moveRedAttack(bluePos);
        removeRandomEdge();
        checkGameOver();
        drawGame();
      }
      aiThinking = false;
    }, 150);

  } else {
    // ── Two-player: blue (arrows) first, then red (WASD), 1 edge per move ──
    if (!redTurn) {
      // Blue's turn
      const oldPos = { ...bluePos };
      switch (key) {
        case 'ArrowLeft':  if (bluePos.x > 0)            bluePos.x--; break;
        case 'ArrowRight': if (bluePos.x < GRID_SIZE - 1) bluePos.x++; break;
        case 'ArrowUp':    if (bluePos.y > 0)            bluePos.y--; break;
        case 'ArrowDown':  if (bluePos.y < GRID_SIZE - 1) bluePos.y++; break;
        default: return;
      }
      if (!getValidMoves(oldPos).some(p => p.x === bluePos.x && p.y === bluePos.y)) { bluePos = oldPos; return; }
      removeRandomEdge();
      redTurn = true;
    } else {
      // Red's turn
      const oldPos = { ...redPos };
      switch (key.toLowerCase()) {
        case 'w': if (redPos.y > 0)            redPos.y--; break;
        case 's': if (redPos.y < GRID_SIZE - 1) redPos.y++; break;
        case 'a': if (redPos.x > 0)            redPos.x--; break;
        case 'd': if (redPos.x < GRID_SIZE - 1) redPos.x++; break;
        default: return;
      }
      if (!getValidMoves(oldPos).some(p => p.x === redPos.x && p.y === redPos.y)) { redPos = oldPos; return; }
      removeRandomEdge();
      redTurn = false;
    }
    if (checkGameOver()) { drawGame(); return; }
    drawGame();
    updateMobileButtonColors();
  }
}

// =====================================================================
// BUTTONS / MODAL
// =====================================================================
function toggleModeLock() {
  modeLocked = !modeLocked;
  const icon = document.getElementById('lockIcon');
  if (!icon) return;
  icon.classList.toggle('locked', modeLocked);
  // Sync nextAutoMode to the current mode so unlocking resumes from here
  if (!modeLocked && gameMode !== 'twoPlayer')
    nextAutoMode = (gameMode === 'offense') ? 'defense' : 'offense';
}

function toggleMode() {
  if (gameMode === 'offense')      gameMode = 'defense';
  else if (gameMode === 'defense') gameMode = 'twoPlayer';
  else                             gameMode = 'offense';
  // Sync the alternator so the next auto-reset continues from the right spot
  if (gameMode === 'offense')      nextAutoMode = 'defense';
  else if (gameMode === 'defense') nextAutoMode = 'offense';
  resetGame(false); // keep the mode we just set
}

function showInstructions() {
  document.getElementById('instructionsModal').style.display = 'block';
  document.body.classList.add('modal-open');
}
function closeInstructions() {
  document.getElementById('instructionsModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

window.onclick = function (e) {
  const modal = document.getElementById('instructionsModal');
  if (e.target === modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
};

// =====================================================================
// KEYBOARD INPUT
// =====================================================================
document.addEventListener('keydown', (e) => {
  const used = ['Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
  if (used.includes(e.key)) e.preventDefault();
  if (e.key === 'Enter') { resetGame(); return; }
  if (gameMode === 'twoPlayer') {
    if ( redTurn && ['w','a','s','d','W','A','S','D'].includes(e.key))              handleMove(e.key);
    if (!redTurn && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) handleMove(e.key);
  } else {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) handleMove(e.key);
  }
});

// =====================================================================
// MOBILE D-PAD
// =====================================================================
function initializeMobileControls() {
  const redMap  = { 'up-btn': 'w', 'down-btn': 's', 'left-btn': 'a', 'right-btn': 'd' };
  const blueMap = { 'up-btn': 'ArrowUp', 'down-btn': 'ArrowDown', 'left-btn': 'ArrowLeft', 'right-btn': 'ArrowRight' };

  Object.keys(redMap).forEach(cls => {
    const el = document.querySelector('.' + cls);
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const key = (gameMode === 'twoPlayer' && redTurn) ? redMap[cls] : blueMap[cls];
      handleMove(key);
      updateMobileButtonColors();
    };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('click',      handler);
  });
}

function updateMobileButtonColors() {
  const isRed  = gameMode === 'twoPlayer' && redTurn;
  const isBlue = gameMode === 'twoPlayer' && !redTurn;
  const arrowColor  = isRed ? '#e53e3e' : isBlue ? '#3182ce' : 'white';
  const borderColor = isRed ? 'rgba(229,62,62,0.5)' : isBlue ? 'rgba(100,160,255,0.35)' : 'rgba(255,255,255,0.2)';
  document.querySelectorAll('.mobile-btn').forEach(btn => {
    btn.style.color       = arrowColor;
    btn.style.borderColor = borderColor;
  });
}

document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// =====================================================================
// RESET
// =====================================================================
function resetGame(randomizeMode = true) {
  if (randomizeMode && gameMode !== 'twoPlayer' && !modeLocked) {
    gameMode = nextAutoMode;
    nextAutoMode = (nextAutoMode === 'offense') ? 'defense' : 'offense';
  }
  gameOver     = false;
  redTurn      = false;  // blue always goes first
  aiThinking   = false;
  aiGeneration++;        // invalidate any pending AI timeout
  const el = document.getElementById('message');
  el.textContent = '';
  el.className   = '';

  resizeCanvas();
  initializeEdges();
  initializePositions();
  updateGameTitle();
  drawGame();
  updateMobileButtonColors();
}

// =====================================================================
// INIT
// =====================================================================
let mobileControlsInitialized = false;
function ensureMobileControls() {
  if (!mobileControlsInitialized) { initializeMobileControls(); mobileControlsInitialized = true; }
  updateMobileButtonColors();
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { resizeCanvas(); drawGame(); ensureMobileControls(); }, 60);
});
// orientationchange fires before the viewport settles on iOS — use a longer delay
window.addEventListener('orientationchange', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { resizeCanvas(); drawGame(); ensureMobileControls(); }, 300);
});

resetGame();
ensureMobileControls();
