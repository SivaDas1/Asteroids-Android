const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const restartBtn = document.getElementById("restart");
const controlButtons = document.querySelectorAll(".ctrl");

const tileSize = 16;
const gridSize = canvas.width / tileSize; // 20 x 20
const loopMs = 120;

let snake;
let dir;
let nextDir;
let food;
let score;
let gameOver;
let timer = null;

function resetGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { ...dir };
  score = 0;
  gameOver = false;
  overlay.classList.add("hidden");
  scoreEl.textContent = `Score: ${score}`;
  spawnFood();
  draw();
}

function spawnFood() {
  let valid = false;
  while (!valid) {
    food = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };
    valid = !snake.some((s) => s.x === food.x && s.y === food.y);
  }
}

function isOpposite(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

function setDirection(newDir) {
  if (!isOpposite(newDir, dir)) {
    nextDir = newDir;
  }
}

function update() {
  if (gameOver) return;

  dir = { ...nextDir };
  const head = snake[0];
  const newHead = {
    x: head.x + dir.x,
    y: head.y + dir.y,
  };

  if (
    newHead.x < 0 ||
    newHead.y < 0 ||
    newHead.x >= gridSize ||
    newHead.y >= gridSize
  ) {
    endGame();
    return;
  }

  if (snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
    endGame();
    return;
  }

  snake.unshift(newHead);

  if (newHead.x === food.x && newHead.y === food.y) {
    score += 10;
    scoreEl.textContent = `Score: ${score}`;
    spawnFood();
  } else {
    snake.pop();
  }
}

function drawGridBackground() {
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const checker = (x + y) % 2 === 0;
      ctx.fillStyle = checker ? "#9b9b9b" : "#858585";
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

      // tiny 80s-style pixel dither
      ctx.fillStyle = checker ? "#7a7a7a" : "#a8a8a8";
      ctx.fillRect(x * tileSize + 2, y * tileSize + 2, 2, 2);
      ctx.fillRect(x * tileSize + 10, y * tileSize + 10, 2, 2);
    }
  }
}

function drawFood() {
  const px = food.x * tileSize;
  const py = food.y * tileSize;

  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
  ctx.fillStyle = "#5d5d5d";
  ctx.fillRect(px + 5, py + 5, tileSize - 10, tileSize - 10);
}

function drawSnake() {
  snake.forEach((part, i) => {
    const px = part.x * tileSize;
    const py = part.y * tileSize;

    ctx.fillStyle = i === 0 ? "#2f2f2f" : "#3f3f3f";
    ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
    ctx.fillStyle = "#bdbdbd";
    ctx.fillRect(px + 3, py + 3, tileSize - 8, 2);
  });
}

function draw() {
  drawGridBackground();
  drawFood();
  drawSnake();
}

function tick() {
  update();
  draw();
}

function endGame() {
  gameOver = true;
  overlayText.textContent = `Game Over • ${score}`;
  overlay.classList.remove("hidden");
}

function startLoop() {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, loopMs);
}

document.addEventListener("keydown", (e) => {
  const map = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  if (map[e.key]) {
    e.preventDefault();
    setDirection(map[e.key]);
  }
});

controlButtons.forEach((btn) => {
  const dirs = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  btn.addEventListener("click", () => setDirection(dirs[btn.dataset.dir]));
});

restartBtn.addEventListener("click", resetGame);

resetGame();
startLoop();
