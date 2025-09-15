// ----- Config -----
const GRID_SIZE = 6;
const CELL_SIZE = 80;
const POINT_RADIUS = 8;
const POINT_OFFSET = CELL_SIZE / 2;

// Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CELL_SIZE * GRID_SIZE;
canvas.height = CELL_SIZE * GRID_SIZE;

// Game state
let bluePos = { x: 0, y: GRID_SIZE - 1 };
let redPos  = { x: GRID_SIZE - 1, y: 0 };
let edges   = [];
let gameOver = false;
let gameMode = 'offense'; // 'offense', 'defense', 'twoPlayer'
let redTurn = true;       // Red starts

function updateGameTitle() {
  const title = document.getElementById('gameTitle');
  if (gameMode === 'offense') {
    title.innerHTML = 'You are the <span style="color: blue">blue</span> point, try to <i>catch</i> the <span style="color: red">red</span> point';
  } else if (gameMode === 'defense') {
    title.innerHTML = 'You are the <span style="color: blue">blue</span> point, try to <i>evade</i> the <span style="color: red">red</span> point';
  } else {
    title.textContent = 'Two Player Mode';
  }
}

function initializePositions() {
  const leftCorners = [{ x: 0, y: 0 }, { x: 0, y: GRID_SIZE - 1 }];
  const blueCorner = leftCorners[Math.floor(Math.random() * leftCorners.length)];

  if (gameMode === 'offense') {
    bluePos = blueCorner;
    const defenderRow = Math.random() < 0.5 ? blueCorner.y : (blueCorner.y === 0 ? 1 : blueCorner.y - 1);
    redPos = { x: GRID_SIZE - 1, y: defenderRow };
  } else if (gameMode === 'defense') {
    const rightCorners = [{ x: GRID_SIZE - 1, y: 0 }, { x: GRID_SIZE - 1, y: GRID_SIZE - 1 }];
    const redCorner = rightCorners[Math.floor(Math.random() * rightCorners.length)];
    redPos = redCorner;
    const defenderRow = Math.random() < 0.5 ? redCorner.y : (redCorner.y === 0 ? 1 : redCorner.y - 1);
    bluePos = { x: 0, y: defenderRow };
  } else {
    bluePos = blueCorner;
    const defenderRow = Math.random() < 0.5 ? blueCorner.y : (blueCorner.y === 0 ? 1 : blueCorner.y - 1);
    redPos = { x: GRID_SIZE - 1, y: defenderRow };
  }
}

function initializeEdges() {
  edges = [];
  // Horizontal
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE - 1; x++) {
      edges.push({ x1: x, y1: y, x2: x + 1, y2: y, active: true });
    }
  }
  // Vertical
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE - 1; y++) {
      edges.push({ x1: x, y1: y, x2: x, y2: y + 1, active: true });
    }
  }
  removeInitialEdges();
}

function removeInitialEdges() {
  let internal = edges.filter(e =>
    !(e.x1 === 0 || e.x1 === GRID_SIZE - 1 || e.x2 === 0 || e.x2 === GRID_SIZE - 1 ||
      e.y1 === 0 || e.y1 === GRID_SIZE - 1 || e.y2 === 0 || e.y2 === GRID_SIZE - 1)
  );
  for (let i = 0; i < 4 && internal.length; i++) {
    const idx = Math.floor(Math.random() * internal.length);
    const sel = internal[idx];
    const mainIdx = edges.findIndex(e => e.x1 === sel.x1 && e.y1 === sel.y1 && e.x2 === sel.x2 && e.y2 === sel.y2);
    if (mainIdx !== -1) edges[mainIdx].active = false;
    internal.splice(idx, 1);
  }
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Edges
  edges.forEach(edge => {
    if (edge.active) {
      ctx.beginPath();
      ctx.moveTo(edge.x1 * CELL_SIZE + POINT_OFFSET, edge.y1 * CELL_SIZE + POINT_OFFSET);
      ctx.lineTo(edge.x2 * CELL_SIZE + POINT_OFFSET, edge.y2 * CELL_SIZE + POINT_OFFSET);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  const drawPoint = (pos, color) => {
    ctx.beginPath();
    ctx.arc(pos.x * CELL_SIZE + POINT_OFFSET, pos.y * CELL_SIZE + POINT_OFFSET, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const msg = document.getElementById('message').textContent || '';
  if ((gameOver && msg.includes('Caught')) ||
      (gameMode === 'twoPlayer' && bluePos.x === redPos.x && bluePos.y === redPos.y)) {
    drawPoint(gameMode === 'defense' ? redPos : bluePos, '#8A2BE2');
  } else {
    drawPoint(redPos, 'red');
    drawPoint(bluePos, 'blue');
  }
}

function getValidMoves(pos) {
  const dirs = [{dx:-1,dy:0},{dx:1,dy:0},{dx:0,dy:-1},{dx:0,dy:1}];
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
  const queue = [[start]];
  while (queue.length) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    if (cur.x === end.x && cur.y === end.y) return path;
    const key = `${cur.x},${cur.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const mv of getValidMoves(cur)) {
      if (!visited.has(`${mv.x},${mv.y}`)) queue.push([...path, mv]);
    }
  }
  return null;
}

function removeRandomEdge() {
  const active = edges.filter(e => e.active);
  if (!active.length) return false;
  active[Math.floor(Math.random() * active.length)].active = false;
  return true;
}

function checkCrossPath(oldBlue, newBlue, oldRed, newRed) {
  if (newBlue.x === newRed.x && newBlue.y === newRed.y) return true;
  if (oldBlue.x === newRed.x && oldBlue.y === newRed.y &&
      oldRed.x === newBlue.x && oldRed.y === newBlue.y) return true;
  return false;
}

function moveRedAttack() {
  const path = findShortestPath(redPos, bluePos);
  if (path && path.length >= 2) { redPos = path[1]; return true; }
  return false;
}

function evaluatePosition(pos, depth = 0, maxDepth = 2) {
  if (depth >= maxDepth) {
    const p = findShortestPath(bluePos, pos);
    return p ? p.length - 1 : 0;
  }
  const cur = findShortestPath(bluePos, pos);
  if (!cur) return 0;
  const curMin = cur.length - 1;
  const valids = getValidMoves(pos);
  if (!valids.length) return 0;
  let bestFuture = 0;
  for (const mv of valids) bestFuture = Math.max(bestFuture, evaluatePosition(mv, depth + 1, maxDepth));
  return Math.min(curMin, bestFuture);
}

function moveRedEvade() {
  const valids = getValidMoves(redPos);
  if (!valids.length) return false;

  const curPath = findShortestPath(bluePos, redPos);
  if (!curPath) return false;
  const curMin = curPath.length - 1;

  const scored = valids.map(move => {
    const p = findShortestPath(bluePos, move);
    if (!p) return { move, score: -1, immediateMoves: -1, futureMoves: -1, strategicValue: -1 };
    const immediate = p.length - 1;
    const future = evaluatePosition(move);
    const strategic = getValidMoves(move).length;
    const score = (immediate * 4) + (future * 3) + strategic;
    return { move, score, immediateMoves: immediate, futureMoves: future, strategicValue: strategic };
  }).filter(x => x.score >= 0).sort((a, b) => b.score - a.score);

  let bestMove = null;
  for (const s of scored) {
    if (!getValidMoves(s.move).length) continue;
    if (s.immediateMoves >= curMin || s.futureMoves >= curMin) { bestMove = s.move; break; }
  }

  if (bestMove) { redPos = bestMove; return true; }
  if (scored.length) {
    const best = scored.reduce((a, b) => b.immediateMoves > a.immediateMoves ? b : a);
    redPos = best.move; return true;
  }
  return false;
}

function isMobileDevice() {
  return (window.innerWidth <= 768) || ('ontouchstart' in window);
}

function initializeMobileControls() {
  const redControls  = { 'up-btn':'w', 'down-btn':'s', 'left-btn':'a', 'right-btn':'d' };
  const blueControls = { 'up-btn':'ArrowUp', 'down-btn':'ArrowDown', 'left-btn':'ArrowLeft', 'right-btn':'ArrowRight' };

  Object.keys(redControls).forEach(className => {
    const el = document.querySelector(`.${className}`);
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const key = (gameMode === 'twoPlayer' && redTurn) ? redControls[className] : blueControls[className];
      handleMove(key);
      updateMobileButtonColors();
    };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('click', handler);
  });
}

function updateMobileButtonColors() {
  if (!isMobileDevice()) return;
  const buttons = document.querySelectorAll('.mobile-btn');
  if (gameMode === 'twoPlayer') {
    const color = redTurn ? '#FF4444' : '#4169E1';
    buttons.forEach(b => { b.style.backgroundColor = color; });
  } else {
    buttons.forEach(b => { b.style.backgroundColor = '#4169E1'; });
  }
}

// Prevent pinch-zoom gesture from causing layout shifts
document.addEventListener('touchmove', function(e) {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

function checkGameOver() {
  const messageEl = document.getElementById('message');
  if (bluePos.x === redPos.x && bluePos.y === redPos.y) {
    gameOver = true;
    if (gameMode === 'offense') { messageEl.textContent = 'Blue Wins - Points are joined'; messageEl.className = 'blue-wins'; }
    else if (gameMode === 'defense') { messageEl.textContent = 'Red Wins - Points are joined'; messageEl.className = 'red-wins'; }
    else { messageEl.textContent = 'Blue Wins - Points are joined'; messageEl.className = 'blue-wins'; }
    return true;
  }
  const path = findShortestPath(bluePos, redPos);
  if (!path) {
    gameOver = true;
    if (gameMode === 'offense') { messageEl.textContent = 'Red Wins - Points are separated'; messageEl.className = 'red-wins'; }
    else if (gameMode === 'defense') { messageEl.textContent = 'Blue Wins - Points are separated'; messageEl.className = 'blue-wins'; }
    else { messageEl.textContent = 'Red Wins - Points are separated'; messageEl.className = 'red-wins'; }
    return true;
  }
  return false;
}

function handleMove(key) {
  if (gameOver) return;

  if (gameMode !== 'twoPlayer') {
    const oldBlue = { ...bluePos };
    let proposedBlue = { ...bluePos };

    switch (key) {
      case 'ArrowLeft':  if (bluePos.x > 0) proposedBlue.x--; break;
      case 'ArrowRight': if (bluePos.x < GRID_SIZE - 1) proposedBlue.x++; break;
      case 'ArrowUp':    if (bluePos.y > 0) proposedBlue.y--; break;
      case 'ArrowDown':  if (bluePos.y < GRID_SIZE - 1) proposedBlue.y++; break;
      default: return;
    }

    if (!getValidMoves(bluePos).some(p => p.x === proposedBlue.x && p.y === proposedBlue.y)) return;

    const oldRed = { ...redPos };
    if (gameMode === 'offense') moveRedEvade(); else moveRedAttack();

    const proposedRed = { ...redPos };
    bluePos = proposedBlue;
    redPos  = proposedRed;

    if (checkCrossPath(oldBlue, bluePos, oldRed, redPos)) {
      gameOver = true;
      const messageEl = document.getElementById('message');
      if (gameMode === 'defense') { messageEl.textContent = 'Red Wins - Caught Blue!'; messageEl.className = 'red-wins'; }
      else { messageEl.textContent = 'Blue Wins - Caught Red!';  messageEl.className = 'blue-wins'; }
      drawGame();
      return;
    }

    removeRandomEdge();
    removeRandomEdge();

    if (checkGameOver()) { drawGame(); return; }
    drawGame();
  } else {
    if (redTurn) {
      const oldPos = { ...redPos };
      switch (key.toLowerCase()) {
        case 'w': if (redPos.y > 0) redPos.y--; break;
        case 's': if (redPos.y < GRID_SIZE - 1) redPos.y++; break;
        case 'a': if (redPos.x > 0) redPos.x--; break;
        case 'd': if (redPos.x < GRID_SIZE - 1) redPos.x++; break;
        default: return;
      }
      if (!getValidMoves(oldPos).some(p => p.x === redPos.x && p.y === redPos.y)) redPos = oldPos;
      else redTurn = false;
    } else {
      const oldPos = { ...bluePos };
      switch (key) {
        case 'ArrowLeft':  if (bluePos.x > 0) bluePos.x--; break;
        case 'ArrowRight': if (bluePos.x < GRID_SIZE - 1) bluePos.x++; break;
        case 'ArrowUp':    if (bluePos.y > 0) bluePos.y--; break;
        case 'ArrowDown':  if (bluePos.y < GRID_SIZE - 1) bluePos.y++; break;
        default: return;
      }
      if (!getValidMoves(oldPos).some(p => p.x === bluePos.x && p.y === bluePos.y)) bluePos = oldPos;
      else { redTurn = true; removeRandomEdge(); removeRandomEdge(); }
    }

    if (checkGameOver()) { drawGame(); return; }
    drawGame();
  }
}

function toggleMode() {
  if (gameMode === 'offense') { gameMode = 'defense'; document.getElementById('modeBtn').textContent = 'Defense'; }
  else if (gameMode === 'defense') { gameMode = 'twoPlayer'; document.getElementById('modeBtn').textContent = 'Two Player'; }
  else { gameMode = 'offense'; document.getElementById('modeBtn').textContent = 'Offense'; }
  resetGame();
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

// Only prevent default for keys we use (to avoid blocking other browser actions)
document.addEventListener('keydown', (e) => {
  const keysUsed = ['Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
  if (keysUsed.includes(e.key)) e.preventDefault();

  if (e.key === 'Enter') { resetGame(); return; }

  if (gameMode === 'twoPlayer') {
    if (redTurn && ['w','a','s','d','W','A','S','D'].includes(e.key)) handleMove(e.key);
    else if (!redTurn && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) handleMove(e.key);
  } else {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) handleMove(e.key);
  }
});

function resetGame() {
  gameOver = false;
  redTurn = true;
  const messageEl = document.getElementById('message');
  messageEl.textContent = '';
  messageEl.className = '';

  initializeEdges();
  initializePositions();
  updateGameTitle();
  drawGame();
  updateMobileButtonColors();
}

// Boot
resetGame();
if (isMobileDevice()) { initializeMobileControls(); updateMobileButtonColors(); }
