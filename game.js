const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Check if mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Adjust canvas size for mobile (this logic will be handled in HTML/CSS for initial setup, but kept here for dynamic adjustments if needed)
// Note: The canvas size adjustment based on window dimensions is better handled in CSS media queries and initial canvas setup in HTML.
// For simplicity, I'm keeping the original canvas dimensions from HTML and letting CSS handle scaling.
// If you want dynamic JS scaling, ensure the canvas element is not fixed by CSS.

// Debug mode - set to true to see hitboxes
const SHOW_HITBOXES = false;

// Load images
const bgImg = new Image();
bgImg.src = 'image/background.png'; // Using background.png as per checking.html

const playerImages = {
  normal: new Image(),
  happy: new Image(),
  dead: new Image()
};
playerImages.normal.src = 'image/rui_normal.png';
playerImages.happy.src = 'image/rui_closing_eyes.png';
playerImages.dead.src   = 'image/rui_dead.png';

// Load good item images
const goodItemImages = [
  new Image(), new Image(), new Image(), new Image()
];
goodItemImages[0].src = 'image/rui_ramune.png';
goodItemImages[1].src = 'image/nene_ramune.png';
goodItemImages[2].src = 'image/tsukasa_ramune.png';
goodItemImages[3].src = 'image/emu_ramune.png';

// Load bad item images
const badItemImages = [
  new Image(), new Image()
];
badItemImages[0].src = 'image/carrot.png';
badItemImages[1].src = 'image/brokoli.png';

// Load sound
const getGoodSound = new Audio('sound/get_good.wav');
getGoodSound.preload = 'auto';
const getBadSound = new Audio('sound/get_bad.mp3');
getBadSound.preload = 'auto';

// Helper to ensure all images load
function loadImage(img) {
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(`Failed to load image: ${img.src}`);
  });
}

const imagePromises = [
  loadImage(bgImg),
  loadImage(playerImages.normal),
  loadImage(playerImages.happy),
  loadImage(playerImages.dead),
  ...goodItemImages.map(loadImage),
  ...badItemImages.map(loadImage)
];

// Game state
const player = {
  x: canvas.width / 2 - 48, y: canvas.height - 100, width: 96, height: 96, speed: 300,
  state: 'normal',
  stateTimer: 0,
  jumpOffset: 0,
  jumping: false,
  jumpSpeed: 0,
  hitboxRadius: 30,
  hitboxOffsetX: 0,
  hitboxOffsetY: 20
};

let items = [];
let score = 0;
let highScore = 0;
let gameOver = false;
let paused = false;
let moveLeft = false, moveRight = false;
let lastTime = 0;
let itemTimer = 0;
let itemSpeedIncreaseInterval = 10; // Increase speed every 10 seconds
let itemSpeedIncreaseAmount = 20; // Increase speed by 20
let timeElapsed = 0; // Track time elapsed

function spawnItem() {
  const isBomb = Math.random() < 0.3;
  const item = {
    x: Math.random() * (canvas.width - 40),
    y: 0,
    size: 60,
    isBomb,
    speed: 100 + Math.random() * 100 + (timeElapsed / itemSpeedIncreaseInterval) * itemSpeedIncreaseAmount,
    rotation: 0,
    hitboxRadius: 15,
    hitboxOffsetX: 0,
    hitboxOffsetY: 0
  };

  if (isBomb) {
    item.image = badItemImages[Math.floor(Math.random() * badItemImages.length)];
  } else {
    item.image = goodItemImages[Math.floor(Math.random() * goodItemImages.length)];
  }

  items.push(item);
}

function checkCollision(player, item) {
  const playerCenterX = player.x + player.width / 2 + player.hitboxOffsetX;
  const playerCenterY = player.y + player.height / 2 + player.hitboxOffsetY + player.jumpOffset;
  const itemCenterX = item.x + item.size / 2 + item.hitboxOffsetX;
  const itemCenterY = item.y + item.size / 2 + item.hitboxOffsetY;

  const dx = playerCenterX - itemCenterX;
  const dy = playerCenterY - itemCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance < (player.hitboxRadius + item.hitboxRadius);
}

function update(delta) {
  if (gameOver || paused) return;

  timeElapsed += delta;

  itemTimer += delta;
  if (itemTimer > 1) {
    spawnItem();
    itemTimer = 0;
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.y += item.speed * delta;
    item.rotation += 2 * delta;

    if (checkCollision(player, item)) {
      if (item.isBomb) {
        player.state = 'dead';
        gameOver = true;
        if (score > highScore) highScore = score;
        getBadSound.currentTime = 0;
        getBadSound.play().catch(err => console.warn("Sound play failed:", err));
        if (isMobile) showGameOverMenu();
        return;
      } else {
        player.state = 'happy';
        player.stateTimer = 0.3;
        player.jumping = true;
        player.jumpSpeed = -300;
        score += 100;
        items.splice(i, 1);
        getGoodSound.currentTime = 0;
        getGoodSound.play().catch(err => console.warn("Sound play failed:", err));
      }
    }
  }

  if (player.jumping) {
    player.jumpSpeed += 2000 * delta;
    player.jumpOffset += player.jumpSpeed * delta;
    if (player.jumpOffset >= 0) {
      player.jumpOffset = 0;
      player.jumping = false;
    }
  }

  if (player.state === 'happy') {
    player.stateTimer -= delta;
    if (player.stateTimer <= 0) {
      player.state = 'normal';
    }
  }

  items = items.filter(item => item.y <= canvas.height);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

  const img = playerImages[player.state] || playerImages.normal;
  ctx.drawImage(img, player.x, player.y + player.jumpOffset, player.width, player.height);

  for (const item of items) {
    ctx.save();
    ctx.translate(item.x + item.size / 2, item.y + item.size / 2);
    ctx.rotate(item.rotation);
    ctx.drawImage(item.image, -item.size / 2, -item.size / 2, item.size, item.size);
    ctx.restore();

    if (SHOW_HITBOXES) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        item.x + item.size / 2 + item.hitboxOffsetX,
        item.y + item.size / 2 + item.hitboxOffsetY,
        item.hitboxRadius,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = item.isBomb ? 'rgba(255,0,0,0.5)' : 'rgba(0,255,0,0.5)';
      ctx.stroke();
      ctx.restore();
    }
  }

  if (SHOW_HITBOXES) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(
      player.x + player.width / 2 + player.hitboxOffsetX,
      player.y + player.height / 2 + player.hitboxOffsetY + player.jumpOffset,
      player.hitboxRadius,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = 'rgba(0,0,255,0.5)';
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = 'black';
  ctx.font = '16px Arial';
  ctx.fillText(`Score: ${score}`, 10, 20);
  ctx.fillText(`High Score: ${highScore}`, 10, 40);

  if (paused && !isMobile) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '18px Arial';
    ctx.fillText('Continue (Enter)', canvas.width / 2, canvas.height / 2);
    ctx.fillText('Restart (R)', canvas.width / 2, canvas.height / 2 + 30);
  }

  if (gameOver && !isMobile) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '18px Arial';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 40);
    ctx.font = '12px Arial';
    ctx.fillText('Made by shin', canvas.width / 2, canvas.height / 2 + 60);
    ctx.font = '18px Arial';
    ctx.fillText('Press Enter to Restart', canvas.width / 2, canvas.height / 2 + 80);
  }

  ctx.textAlign = 'start';
}

function handleMovement(delta) {
  if (paused || gameOver) return;
  if (moveLeft) player.x -= player.speed * delta;
  if (moveRight) player.x += player.speed * delta;
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
}

function resetGame() {
  score = 0;
  items = [];
  gameOver = false;
  paused = false;
  player.x = canvas.width / 2 - 48;
  player.state = 'normal';
  player.jumpOffset = 0;
  player.jumping = false;
  player.jumpSpeed = 0;
  itemTimer = 0;
  timeElapsed = 0;
  hidePauseMenu();
  hideGameOverMenu();
}

function showPauseMenu() {
  if (isMobile) {
    document.getElementById('pauseMenu').classList.remove('hidden');
  }
}

function hidePauseMenu() {
  document.getElementById('pauseMenu').classList.add('hidden');
}

function showGameOverMenu() {
  if (isMobile) {
    document.getElementById('scoreDisplay').textContent = `Score: ${score}`;
    document.getElementById('highScoreDisplay').textContent = `High Score: ${highScore}`;
    document.getElementById('gameOverMenu').classList.remove('hidden');
  }
}

function hideGameOverMenu() {
  document.getElementById('gameOverMenu').classList.add('hidden');
}

function loop(timestamp) {
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  handleMovement(delta);
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

// Controls
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') moveLeft = true;
  if (e.key === 'ArrowRight') moveRight = true;
  if (e.key === 'Enter') {
    if (gameOver) resetGame();
    else {
      paused = !paused;
      if (paused && isMobile) showPauseMenu();
      else hidePauseMenu();
    }
  }
  if (e.key.toLowerCase() === 'r') resetGame();
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') moveLeft = false;
  if (e.key === 'ArrowRight') moveRight = false;
});

// Touch controls
if (isMobile) {
  document.getElementById('leftButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    moveLeft = true;
  });
  document.getElementById('leftButton').addEventListener('touchend', (e) => {
    e.preventDefault();
    moveLeft = false;
  });
  document.getElementById('rightButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    moveRight = true;
  });
  document.getElementById('rightButton').addEventListener('touchend', (e) => {
    e.preventDefault();
    moveRight = false;
  });
  document.getElementById('pauseButton').addEventListener('click', (e) => {
    e.preventDefault();
    paused = !paused;
    if (paused) showPauseMenu();
    else hidePauseMenu();
  });
  document.getElementById('continueButton').addEventListener('click', (e) => {
    e.preventDefault();
    paused = false;
    hidePauseMenu();
  });

  // Restart button in pause menu
  document.getElementById('restartButtonMenu').addEventListener('click', (e) => {
    e.preventDefault();
    resetGame();
  });

  // Play Again button in game over menu
  document.getElementById('restartButtonGameOver').addEventListener('click', (e) => {
    e.preventDefault();
    resetGame();
  });
}

// Start game after images load
Promise.all(imagePromises)
  .then(() => {
    console.log("All images loaded. Starting game...");
    // Initial canvas size adjustment for mobile, if needed, after images load
    if (isMobile) {
      const maxWidth = window.innerWidth * 0.95;
      const maxHeight = window.innerHeight * 0.85;
      const ratio = Math.min(maxWidth / 400, maxHeight / 600);
      canvas.width = 400 * ratio;
      canvas.height = 600 * ratio;
      // Re-center player after canvas resize
      player.x = canvas.width / 2 - player.width / 2;
      player.y = canvas.height - 100;
    }
    requestAnimationFrame(loop);
  })
  .catch(err => {
    console.error("Image load error:", err);
    alert("Failed to load images. Check the image paths and ensure they are in the 'image/' folder.");
  });
