/* ===================== GLOBALS ===================== */
let stockfish = null;
let lastFEN = '';
let arrows = [];
let playerSide = 'w';
let sideDetected = false;
let moveMap = {};

/* ===================== STOCKFISH ===================== */
async function initStockfish() {
    if (stockfish) return;
    const res = await fetch('https://www.chess.com/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js');
    const code = await res.text();
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    stockfish = new Worker(url);
    stockfish.postMessage('uci');

    stockfish.onmessage = e => {
        const msg = e.data;
        if (msg === 'uciok') stockfish.postMessage('setoption name MultiPV value 8');
        if (msg.includes(' pv ')) parseMultiPV(msg);
    };
}

/* ===================== MULTIPV ===================== */
function parseMultiPV(line) {
    const m = line.match(/multipv (\d+).* pv ([a-h][1-8][a-h][1-8])/);
    if (!m) return;
    const idx = Number(m[1]);
    if (!SHOW_PV[idx]) return; // 🔥 skip moves turned off
    moveMap[idx] = m[2];

    const needed = Object.keys(SHOW_PV).filter(k => SHOW_PV[k]).map(Number);
    if (needed.every(i => moveMap[i])) {
        drawMoves(moveMap);
        moveMap = {};
    }
}

/* ===================== BOARD ===================== */
function getBoard() { return document.querySelector('*[data-component="GameLayoutBoard"] cg-board'); }
function getPieces() { const b = getBoard(); return b ? [...b.querySelectorAll('cg-piece:not([style*="hidden"])')] : []; }
function pieceToFen(el) { const c = el.className?.[0]; const t = el.className?.[1]; return c === 'w' ? t.toUpperCase() : t.toLowerCase(); }
function pieceXY(el) { const m = new DOMMatrix(getComputedStyle(el).transform); const board = getBoard().getBoundingClientRect(); const size = board.width / 8; return [Math.floor(m.e / size), Math.floor(m.f / size)]; }
function getFen() { const board = Array.from({ length: 8 }, () => Array(8).fill('1')); getPieces().forEach(p => { const [x,y] = pieceXY(p); board[y][x] = pieceToFen(p); }); return board.map(r=>r.join('')).join('/'); }

/* ===================== SIDE ===================== */
function detectSide() {
    if (sideDetected) return;
    const pieces = getPieces();
    if (!pieces.length) return;
    playerSide = pieces[0].className[0] === 'b' ? 'b' : 'w';
    sideDetected = true;
}

/* ===================== ARROWS ===================== */
function clearArrows() { arrows.forEach(a=>a.remove()); arrows=[]; }
function drawMoves(moves) {
    clearArrows();
    const board = getBoard(); if (!board) return;
    const rect = board.getBoundingClientRect(); const size = rect.width / 8;

    function sqXY(sq) {
        let f = sq.charCodeAt(0)-97;
        let r = 8 - +sq[1];
        if (playerSide==='b') { f=7-f; r=7-r; }
        return { x: rect.left+(f+0.5)*size, y: rect.top+(r+0.5)*size };
    }

    Object.entries(moves).forEach(([i, mv]) => {
        if (!SHOW_PV[i]) return;
        const a = sqXY(mv.slice(0,2));
        const b = sqXY(mv.slice(2,4));
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: ${len}px;
            height: 4px;
            background: ${COLORS[i]};
            transform-origin: 0 50%;
            transform: translate(${a.x}px, ${a.y}px) rotate(${Math.atan2(b.y - a.y,b.x - a.x)}rad);
            z-index: 99999;
            box-shadow: 0 0 6px ${COLORS[i]};
        `;
        document.body.appendChild(el);
        arrows.push(el);
    });
}

/* ===================== LOOP ===================== */
async function start() {
    await initStockfish();
    setInterval(() => {
        try {
            detectSide();
            const fen = getFen();
            if (fen !== lastFEN) {
                lastFEN = fen; moveMap={};
                stockfish.postMessage(`position fen ${fen} ${playerSide} - - 0 1`);
                stockfish.postMessage('go depth 10');
            }
        } catch {}
    }, 300);
}

start();
