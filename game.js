const GRID_SIZE = 6;
const CELL_SIZE = 80;
const POINT_RADIUS = 8;
const POINT_OFFSET = CELL_SIZE / 2;

let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');

canvas.width = CELL_SIZE * GRID_SIZE;
canvas.height = CELL_SIZE * GRID_SIZE;

let bluePos = { x: 0, y: GRID_SIZE - 1 };
let redPos = { x: GRID_SIZE - 1, y: 0 };
let edges = [];
let gameOver = false;
let gameMode = 'offense'; // 'offense', 'defense', or 'twoPlayer'
let redTurn = true; // Red always moves first

function updateGameTitle() {
    const title = document.getElementById('gameTitle');
    if (gameMode === 'offense') {
        title.innerHTML = 'You are the <span style="color: blue">blue</span> point, try to <i>catch</i> the <span style="color: red">red</span> point';
    } else if (gameMode === 'defense') {
        title.innerHTML = 'You are the <span style="color: blue">blue</span> point, try to <i>evade</i> the <span style="color: red">red</span> point';
    } else {
        title.innerHTML = 'Two Player Mode';
    }
}

function getRandomPosition() {
    return {
        x: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1,
        y: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1
    };
}

// Modified to handle starting positions based on game mode
function initializePositions() {
    if (gameMode === 'offense') {
        // Blue starts on left, red on right
        bluePos = {
            x: 0,
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        redPos = {
            x: GRID_SIZE - 1,
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } else if (gameMode === 'defense') {
        // Blue starts on right, red on left
        bluePos = {
            x: GRID_SIZE - 1,
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        redPos = {
            x: 0,
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } else {
        // Two player mode - also start on opposite sides
        // Blue on left, red on right (like offense mode)
        bluePos = {
            x: 0,
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        redPos = {
            x: GRID_SIZE - 1,
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    }
}

function initializeEdges() {
    edges = [];
    // Horizontal edges
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE - 1; x++) {
            edges.push({
                x1: x, y1: y,
                x2: x + 1, y2: y,
                active: true
            });
        }
    }
    // Vertical edges
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE - 1; y++) {
            edges.push({
                x1: x, y1: y,
                x2: x, y2: y + 1,
                active: true
            });
        }
    }
    // Remove two random edges at start
    removeInitialEdges();
}

function removeInitialEdges() {
    let internalEdges = edges.filter(edge => {
        // Check if edge is internal (not on the border)
        return !(edge.x1 === 0 || edge.x1 === GRID_SIZE - 1 || 
                edge.x2 === 0 || edge.x2 === GRID_SIZE - 1 ||
                edge.y1 === 0 || edge.y1 === GRID_SIZE - 1 || 
                edge.y2 === 0 || edge.y2 === GRID_SIZE - 1);
    });
    
    // Remove three random internal edges
    for (let i = 0; i < 3; i++) {
        if (internalEdges.length > 0) {
            const randomIndex = Math.floor(Math.random() * internalEdges.length);
            const selectedEdge = internalEdges[randomIndex];
            
            // Find and deactivate the edge in the main edges array
            const mainEdgeIndex = edges.findIndex(edge => 
                edge.x1 === selectedEdge.x1 && 
                edge.y1 === selectedEdge.y1 && 
                edge.x2 === selectedEdge.x2 && 
                edge.y2 === selectedEdge.y2
            );
            
            if (mainEdgeIndex !== -1) {
                edges[mainEdgeIndex].active = false;
            }
            
            // Remove the selected edge from internalEdges
            internalEdges.splice(randomIndex, 1);
        }
    }
}
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
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
        ctx.arc(
            pos.x * CELL_SIZE + POINT_OFFSET,
            pos.y * CELL_SIZE + POINT_OFFSET,
            POINT_RADIUS,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    };

    if ((gameOver && document.getElementById('message').textContent.includes('Caught')) || 
        (gameMode === 'twoPlayer' && bluePos.x === redPos.x && bluePos.y === redPos.y)) {
        // Show purple point when:
        // 1. Game ends by catching/crossing in single player modes
        // 2. Points overlap in two player mode
        drawPoint(gameMode === 'defense' ? redPos : bluePos, '#8A2BE2');
    } else {
        // All other cases, show both points normally
        drawPoint(redPos, 'red');
        drawPoint(bluePos, 'blue');
    }
}

function getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function isEdgeBetweenPoints(edge, pos1, pos2) {
    return (
        (edge.x1 === pos1.x && edge.y1 === pos1.y && edge.x2 === pos2.x && edge.y2 === pos2.y) ||
        (edge.x2 === pos1.x && edge.y2 === pos1.y && edge.x1 === pos2.x && edge.y1 === pos2.y)
    );
}

function removeRandomEdge() {
    const activeEdges = edges.filter(edge => {
        if (!edge.active) return false;
        // Don't remove edge between points if they're adjacent
        if (getDistance(bluePos, redPos) === 1 && 
            isEdgeBetweenPoints(edge, bluePos, redPos)) {
            return false;
        }
        return true;
    });

    if (activeEdges.length > 0) {
        const edge = activeEdges[Math.floor(Math.random() * activeEdges.length)];
        edge.active = false;
        return true;
    }
    return false;
}

function canMove(from, to) {
    return edges.some(edge => 
        edge.active && 
        ((edge.x1 === from.x && edge.y1 === from.y && edge.x2 === to.x && edge.y2 === to.y) ||
         (edge.x2 === from.x && edge.y2 === from.y && edge.x1 === to.x && edge.y1 === to.y))
    );
}

function getValidMoves(pos) {
    const moves = [];
    const directions = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
    ];

    directions.forEach(dir => {
        const newPos = { x: pos.x + dir.dx, y: pos.y + dir.dy };
        if (newPos.x >= 0 && newPos.x < GRID_SIZE && 
            newPos.y >= 0 && newPos.y < GRID_SIZE && 
            canMove(pos, newPos)) {
            moves.push(newPos);
        }
    });
    return moves;
}

function findShortestPath(start, end) {
    const visited = new Set();
    const queue = [[start]];
    
    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        const key = `${current.x},${current.y}`;
        
        if (current.x === end.x && current.y === end.y) return path;
        if (visited.has(key)) continue;
        
        visited.add(key);
        const moves = getValidMoves(current);
        moves.forEach(move => {
            if (!visited.has(`${move.x},${move.y}`)) {
                queue.push([...path, move]);
            }
        });
    }
    
    return null;
}
// Add these constants at the top with your other constants
const ATTACK_FORCE = 2;
const EVADE_FORCE = 3;

function checkCrossPath(oldBlue, newBlue, oldRed, newRed) {
    // Direct capture
    if (newBlue.x === newRed.x && newBlue.y === newRed.y) return true;

    // Cross over capture (swap positions)
    if (oldBlue.x === newRed.x && oldBlue.y === newRed.y &&
        oldRed.x === newBlue.x && oldRed.y === newBlue.y) return true;

    return false;
}

function moveRedAttack() {
    const path = findShortestPath(redPos, bluePos);
    if (path && path.length >= 2) {
        redPos = path[1]; // Take the first step on the real shortest path
        return true;
    }
    return false; // Red is trapped
}
function moveRedEvade() {
    const validMoves = getValidMoves(redPos);
    if (validMoves.length === 0) return false;

    let bestMove = redPos;
    let bestScore = -Infinity;

    validMoves.forEach(move => {
        // Avoid immediate adjacency to Blue
        if (Math.abs(move.x - bluePos.x) + Math.abs(move.y - bluePos.y) <= 1) return;

        // Predict where Blue could move next turn
        const futureBlueMoves = getValidMoves(bluePos);
        let minFutureDist = Infinity;

        futureBlueMoves.forEach(blueMove => {
            const futureDist = findShortestPath(blueMove, move)?.length || 0;
            if (futureDist < minFutureDist) minFutureDist = futureDist;
        });

        // Score combines future distance and escape routes
        let score = minFutureDist * 10;

        // Escape route bonus
        const escapeRoutes = getValidMoves(move).length;
        score += escapeRoutes * 3;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    });

    redPos = bestMove;
    return true;
}

// --- FINALIZED moveRedAttack() ---


// Helper function for evade
function findPathToBorder(pos) {
    const visited = new Set();
    const queue = [[pos]];
    
    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        
        if (current.x === 0 || current.x === GRID_SIZE - 1 || 
            current.y === 0 || current.y === GRID_SIZE - 1) {
            return path;
        }
        
        const key = `${current.x},${current.y}`;
        if (visited.has(key)) continue;
        
        visited.add(key);
        const moves = getValidMoves(current);
        moves.forEach(move => {
            if (!visited.has(`${move.x},${move.y}`)) {
                queue.push([...path, move]);
            }
        });
    }
    
    return null;
}

function isMobileDevice() {
    return (window.innerWidth <= 768) || ('ontouchstart' in window);
} 

function initializeMobileControls() {
    const redControls = {
        'up-btn': 'w',
        'down-btn': 's',
        'left-btn': 'a',
        'right-btn': 'd'
    };

    const blueControls = {
        'up-btn': 'ArrowUp',
        'down-btn': 'ArrowDown',
        'left-btn': 'ArrowLeft',
        'right-btn': 'ArrowRight'
    };

    for (const [className, _] of Object.entries(redControls)) {
        document.querySelector(`.${className}`).addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent zoom
            const key = gameMode === 'twoPlayer' && redTurn ? 
                redControls[className] : blueControls[className];
            handleMove(key);
            updateMobileButtonColors();
        });
    }
}

function updateMobileButtonColors() {
    if (!isMobileDevice()) return;
    
    const buttons = document.querySelectorAll('.mobile-btn');
    if (gameMode === 'twoPlayer') {
        const color = redTurn ? '#FF4444' : '#4169E1';
        buttons.forEach(btn => {
            btn.style.backgroundColor = color;
        });
    } else {
        buttons.forEach(btn => {
            btn.style.backgroundColor = '#4169E1';
        });
    }
}

// Add this to prevent any touch zooming
document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });


function checkGameOver() {
    if (bluePos.x === redPos.x && bluePos.y === redPos.y) {
        gameOver = true;
        if (gameMode === 'offense') {
            document.getElementById('message').textContent = 'Blue Wins - Points are joined';
        } else if (gameMode === 'defense') {
            document.getElementById('message').textContent = 'Red Wins - Points are joined';
        } else {
            document.getElementById('message').textContent = 'Blue Wins - Points are joined';
        }
        return true;
    }
    
    const path = findShortestPath(bluePos, redPos);
    if (!path) {
        gameOver = true;
        if (gameMode === 'offense') {
            document.getElementById('message').textContent = 'Red Wins - Points are separated';
        } else if (gameMode === 'defense') {
            document.getElementById('message').textContent = 'Blue Wins - Points are separated';
        } else {
            document.getElementById('message').textContent = 'Red Wins - Points are separated';
        }
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
            case 'ArrowLeft': if (bluePos.x > 0) proposedBlue.x--; break;
            case 'ArrowRight': if (bluePos.x < GRID_SIZE - 1) proposedBlue.x++; break;
            case 'ArrowUp': if (bluePos.y > 0) proposedBlue.y--; break;
            case 'ArrowDown': if (bluePos.y < GRID_SIZE - 1) proposedBlue.y++; break;
            default: return;
        }

        if (!canMove(oldBlue, proposedBlue)) return;

        // Pre-move, don't commit yet
        const oldRed = { ...redPos };

        if (gameMode === 'offense') {
            moveRedEvade();
        } else {
            moveRedAttack();
        }

        const proposedRed = { ...redPos };
        bluePos = proposedBlue;
        redPos = proposedRed;

        // ✅ Check for normal or cross-path capture
        if (checkCrossPath(oldBlue, bluePos, oldRed, redPos)) {
            gameOver = true;
            if (gameMode === 'defense') {
                document.getElementById('message').textContent = 'Red Wins - Caught Blue!';
            } else {
                document.getElementById('message').textContent = 'Blue Wins - Caught Red!';
            }
            drawGame();
            return;
        }

        removeRandomEdge();
        removeRandomEdge();

        if (checkGameOver()) {
            drawGame();
            return;
        }

        drawGame();
    } else {
        // ✅ Leave 2P mode unchanged
        if (redTurn) {
            const oldPos = { ...redPos };
            switch (key.toLowerCase()) {
                case 'w': if (redPos.y > 0) redPos.y--; break;
                case 's': if (redPos.y < GRID_SIZE - 1) redPos.y++; break;
                case 'a': if (redPos.x > 0) redPos.x--; break;
                case 'd': if (redPos.x < GRID_SIZE - 1) redPos.x++; break;
                default: return;
            }
            if (!canMove(oldPos, redPos)) redPos = oldPos; else redTurn = false;
        } else {
            const oldPos = { ...bluePos };
            switch (key) {
                case 'ArrowLeft': if (bluePos.x > 0) bluePos.x--; break;
                case 'ArrowRight': if (bluePos.x < GRID_SIZE - 1) bluePos.x++; break;
                case 'ArrowUp': if (bluePos.y > 0) bluePos.y--; break;
                case 'ArrowDown': if (bluePos.y < GRID_SIZE - 1) bluePos.y++; break;
                default: return;
            }
            if (!canMove(oldPos, bluePos)) bluePos = oldPos;
            else {
                redTurn = true;
                removeRandomEdge();
                removeRandomEdge();
            }
        }

        if (checkGameOver()) {
            drawGame();
            return;
        }

        drawGame();
    }
}

function toggleMode() {
    if (gameMode === 'offense') {
        gameMode = 'defense';
        document.getElementById('modeBtn').textContent = 'Defense';
    } else if (gameMode === 'defense') {
        gameMode = 'twoPlayer';
        document.getElementById('modeBtn').textContent = 'Two Player';
    } else {
        gameMode = 'offense';
        document.getElementById('modeBtn').textContent = 'Offense';
    }
    resetGame();
}

function showInstructions() {
    const modal = document.getElementById('instructionsModal');
    modal.style.display = "block";
}

function closeInstructions() {
    const modal = document.getElementById('instructionsModal');
    modal.style.display = "none";
}

window.onclick = function(event) {
    const modal = document.getElementById('instructionsModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// Updated event listener to include Enter key reset
document.addEventListener('keydown', (e) => {
    e.preventDefault();
    
    if (e.key === 'Enter') {
        resetGame();
        return;
    }
    
    if (gameMode === 'twoPlayer') {
        if (redTurn && ['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
            handleMove(e.key);
        } else if (!redTurn && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            handleMove(e.key);
        }
    } else {
        // Single player mode - only arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            handleMove(e.key);
        }
    }
});

function resetGame() {
    gameOver = false;
    redTurn = true;  // Red always starts
    document.getElementById('message').textContent = '';
    
    // Initialize edges first (includes removing two random edges)
    initializeEdges();
    
    // Initialize positions based on game mode
    initializePositions();
    
    updateGameTitle();
    drawGame();
    updateMobileButtonColors();

}

// Initialize game
resetGame();

// Initialize mobile controls if needed
if (isMobileDevice()) {
    initializeMobileControls();
    updateMobileButtonColors();
}
