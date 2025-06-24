const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Disable image smoothing for crisp pixel art, especially important when scaling
ctx.imageSmoothingEnabled = false;

// Check if mobile device based on user agent
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Debug mode - set to true to see hitboxes
const SHOW_HITBOXES = false;

// Load images
const bgImg = new Image();
bgImg.src = 'image/background.png';

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

// Load sound effects
const getGoodSound = new Audio('sound/get_good.wav');
getGoodSound.preload = 'auto'; // Preload the sound for faster playback
const getBadSound = new Audio('sound/get_bad.mp3');
getBadSound.preload = 'auto'; // Preload the sound for faster playback

// Helper function to load an image and return a promise
function loadImage(img) {
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(`Failed to load image: ${img.src}`);
  });
}

// Array of promises for all image loading
const imagePromises = [
  loadImage(bgImg),
  loadImage(playerImages.normal),
  loadImage(playerImages.happy),
  loadImage(playerImages.dead),
  ...goodItemImages.map(loadImage),
  ...badItemImages.map(loadImage)
];

// Game state variables
const player = {
  // Initial position and size, will be adjusted by resizeCanvas
  x: 160, y: 500, width: 96, height: 96, speed: 300,
  state: 'normal', // 'normal', 'happy', 'dead'
  stateTimer: 0, // Timer for 'happy' state duration
  jumpOffset: 0, // Vertical offset for jump animation
  jumping: false, // Is player currently jumping
  jumpSpeed: 0, // Vertical speed during jump
  hitboxRadius: 30, // Collision detection radius
  hitboxOffsetX: 0, // Offset for hitbox relative to player image
  hitboxOffsetY: 20
};

let items = []; // Array to hold falling items
let score = 0; // Current score
let highScore = localStorage.getItem('highScore') ? parseInt(localStorage.getItem('highScore')) : 0; // High score, loaded from local storage
let gameOver = false; // Game over state
let paused = false; // Game paused state
let moveLeft = false, moveRight = false; // Player movement flags
let lastTime = 0; // Timestamp for the last frame
let itemTimer = 0; // Timer to control item spawning
let itemSpeedIncreaseInterval = 10; // Increase item speed every X seconds
let itemSpeedIncreaseAmount = 20; // Amount to increase item speed by
let timeElapsed = 0; // Total time elapsed in the current game

// Function to adjust canvas resolution to match its CSS display size
function resizeCanvas() {
  // Get the computed style of the canvas element
  const style = window.getComputedStyle(canvas);
  // Parse the width and height from the computed style
  const displayWidth = parseFloat(style.width);
  const displayHeight = parseFloat(style.height);

  // If the canvas's internal dimensions don't match its display dimensions, update them
  // This also effectively sets the coordinate system for drawing
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
    // Recalculate player position to be centered horizontally and at the bottom
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 100; // Keep player near the bottom
  }
}

// Spawn a new item (good or bad)
function spawnItem() {
  const isBomb = Math.random() < 0.3; // 30% chance to be a bomb (bad item)
  const item = {
    x: Math.random() * (canvas.width - 40), // Random X position within canvas bounds
    y: 0, // Start at the top of the canvas
    size: 60, // Size of the item
    isBomb, // Is it a bomb?
    // Item speed increases with elapsed time
    speed: 100 + Math.random() * 100 + (Math.floor(timeElapsed / itemSpeedIncreaseInterval) * itemSpeedIncreaseAmount),
    rotation: 0, // Initial rotation for item spinning
    hitboxRadius: 15, // Collision detection radius for item
    hitboxOffsetX: 0, // Offset for hitbox relative to item image
    hitboxOffsetY: 0
  };

  // Assign the correct image based on whether it's a bomb
  if (isBomb) {
    item.image = badItemImages[Math.floor(Math.random() * badItemImages.length)];
  } else {
    item.image = goodItemImages[Math.floor(Math.random() * goodItemImages.length)];
  }

  items.push(item); // Add the new item to the array
}

// Check for collision between player and an item using circle collision
function checkCollision(player, item) {
  // Calculate center coordinates of player's hitbox
  const playerCenterX = player.x + player.width / 2 + player.hitboxOffsetX;
  const playerCenterY = player.y + player.height / 2 + player.hitboxOffsetY + player.jumpOffset;
  // Calculate center coordinates of item's hitbox
  const itemCenterX = item.x + item.size / 2 + item.hitboxOffsetX;
  const itemCenterY = item.y + item.size / 2 + item.hitboxOffsetY;

  // Calculate distance between centers
  const dx = playerCenterX - itemCenterX;
  const dy = playerCenterY - itemCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Collision occurs if distance is less than the sum of their radii
  return distance < (player.hitboxRadius + item.hitboxRadius);
}

// Update game logic
function update(delta) {
  if (gameOver || paused) return; // Do not update if game is over or paused

  timeElapsed += delta; // Accumulate elapsed time

  itemTimer += delta;
  if (itemTimer > 1) { // Spawn a new item every second
    spawnItem();
    itemTimer = 0;
  }

  // Iterate through items to update their positions and check for collisions
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.y += item.speed * delta; // Move item downwards
    item.rotation += 2 * delta; // Rotate item

    if (checkCollision(player, item)) {
      if (item.isBomb) {
        player.state = 'dead'; // Change player state to dead
        gameOver = true; // Set game over flag
        if (score > highScore) {
          highScore = score; // Update high score if current score is higher
          localStorage.setItem('highScore', highScore); // Save high score to local storage
        }
        getBadSound.currentTime = 0; // Rewind sound to start
        getBadSound.play().catch(err => console.warn("Sound play failed:", err)); // Play bad sound
        showGameOverMenu(); // Show game over menu
        return; // Exit update loop as game is over
      } else {
        player.state = 'happy'; // Change player state to happy
        player.stateTimer = 0.3; // Set timer for happy state
        player.jumping = true; // Start jump animation
        player.jumpSpeed = -300; // Initial upward jump speed
        score += 100; // Increase score
        items.splice(i, 1); // Remove collected item
        getGoodSound.currentTime = 0; // Rewind sound to start
        getGoodSound.play().catch(err => console.warn("Sound play failed:", err)); // Play good sound
      }
    }
  }

  // Update player jump animation
  if (player.jumping) {
    player.jumpSpeed += 2000 * delta; // Apply gravity to jump speed
    player.jumpOffset += player.jumpSpeed * delta; // Update jump offset
    if (player.jumpOffset >= 0) { // If player lands
      player.jumpOffset = 0; // Reset jump offset
      player.jumping = false; // End jumping state
    }
  }

  // Reset player state from 'happy' to 'normal' after a short duration
  if (player.state === 'happy') {
    player.stateTimer -= delta;
    if (player.stateTimer <= 0) {
      player.state = 'normal';
    }
  }

  // Remove items that have gone off-screen
  items = items.filter(item => item.y <= canvas.height + item.size); // Keep items that are still visible or just off-screen
}

// Draw game elements
function draw() {
  // Clear the entire canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Draw background image scaled to canvas size
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

  // Select player image based on current state
  const img = playerImages[player.state] || playerImages.normal;
  // Draw player image with jump offset
  ctx.drawImage(img, player.x, player.y + player.jumpOffset, player.width, player.height);

  // Draw all falling items
  for (const item of items) {
    ctx.save(); // Save current canvas state
    // Translate origin to the center of the item for rotation
    ctx.translate(item.x + item.size / 2, item.y + item.size / 2);
    ctx.rotate(item.rotation); // Apply rotation
    // Draw item image centered around the new origin
    ctx.drawImage(item.image, -item.size / 2, -item.size / 2, item.size, item.size);
    ctx.restore(); // Restore canvas state
    
    // Draw item hitbox if SHOW_HITBOXES is true
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

  // Draw player hitbox if SHOW_HITBOXES is true
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

  // Draw score and high score text
  ctx.fillStyle = 'black';
  ctx.font = 'bold 18px Inter, sans-serif'; // Use Inter font
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 10, 25);
  ctx.fillText(`High Score: ${highScore}`, 10, 50);

  // No drawing of pause/game over overlays on canvas anymore, they are handled by HTML menus
}

// Handle player movement based on flags
function handleMovement(delta) {
  if (paused || gameOver) return; // Do not allow movement if paused or game over
  if (moveLeft) player.x -= player.speed * delta; // Move left
  if (moveRight) player.x += player.speed * delta; // Move right
  // Keep player within canvas bounds
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
}

// Reset game state to start a new game
function resetGame() {
  score = 0;
  items = [];
  gameOver = false;
  paused = false;
  player.x = canvas.width / 2 - player.width / 2; // Recenter player
  player.state = 'normal';
  player.jumpOffset = 0;
  player.jumping = false;
  player.jumpSpeed = 0;
  itemTimer = 0;
  timeElapsed = 0;
  hidePauseMenu(); // Hide pause menu
  hideGameOverMenu(); // Hide game over menu
}

// Show the pause menu HTML element
function showPauseMenu() {
  document.getElementById('pauseMenu').classList.remove('hidden');
}

// Hide the pause menu HTML element
function hidePauseMenu() {
  document.getElementById('pauseMenu').classList.add('hidden');
}

// Show the game over menu HTML element and update scores
function showGameOverMenu() {
  document.getElementById('scoreDisplay').textContent = `Score: ${score}`;
  document.getElementById('highScoreDisplay').textContent = `High Score: ${highScore}`;
  document.getElementById('gameOverMenu').classList.remove('hidden');
}

// Hide the game over menu HTML element
function hideGameOverMenu() {
  document.getElementById('gameOverMenu').classList.add('hidden');
}

// Main game loop
function loop(timestamp) {
  // Calculate time elapsed since last frame
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Update game elements
  handleMovement(delta);
  update(delta);
  draw();

  // Request next frame
  requestAnimationFrame(loop);
}

// Event listeners for keyboard controls (for desktop)
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') moveLeft = true;
  if (e.key === 'ArrowRight') moveRight = true;
  if (e.key === 'Enter') {
    if (gameOver) {
      resetGame();
    } else {
      // Toggle pause using the Enter key for desktop
      paused = !paused;
      if (paused) showPauseMenu();
      else hidePauseMenu();
    }
  }
  if (e.key.toLowerCase() === 'r') resetGame();
});

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') moveLeft = false;
  if (e.key === 'ArrowRight') moveRight = false;
});

// Touch controls for mobile
// Use 'touchstart' and 'touchend' for responsive button presses
// Event listeners are attached directly to the HTML elements
document.getElementById('leftButton').addEventListener('touchstart', (e) => {
  e.preventDefault(); // Prevent default browser touch behavior (e.g., scrolling)
  moveLeft = true;
}, { passive: false }); // Add { passive: false } to allow preventDefault to work properly
document.getElementById('leftButton').addEventListener('touchend', (e) => {
  e.preventDefault();
  moveLeft = false;
}, { passive: false });

document.getElementById('rightButton').addEventListener('touchstart', (e) => {
  e.preventDefault();
  moveRight = true;
}, { passive: false });
document.getElementById('rightButton').addEventListener('touchend', (e) => {
  e.preventDefault();
  moveRight = false;
}, { passive: false });

// Top-right pause button for mobile
document.getElementById('topRightPauseButton').addEventListener('click', (e) => {
  e.preventDefault();
  if (gameOver) return; // Prevent pausing if game is over
  paused = !paused;
  if (paused) showPauseMenu();
  else hidePauseMenu();
});


// Buttons within the pause menu
document.getElementById('continueButton').addEventListener('click', (e) => {
  e.preventDefault();
  paused = false;
  hidePauseMenu();
});
document.getElementById('restartButtonMenu').addEventListener('click', (e) => {
  e.preventDefault();
  resetGame();
});

// Button within the game over menu
document.getElementById('restartButtonGameOver').addEventListener('click', (e) => {
  e.preventDefault();
  resetGame();
});

// Adjust canvas size initially and on window resize
window.addEventListener('resize', resizeCanvas);

// Start game after all images have loaded
Promise.all(imagePromises)
  .then(() => {
    console.log("All images loaded. Starting game...");
    resizeCanvas(); // Initial canvas size adjustment after images load
    requestAnimationFrame(loop); // Start the game loop
  })
  .catch(err => {
    console.error("Image load error:", err);
    // Use a custom message box or alert alternative instead of browser alert
    const errorMessage = document.createElement('div');
    errorMessage.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background-color: #ffcccc; border: 1px solid red; padding: 20px;
      font-family: sans-serif; text-align: center; z-index: 9999;
      box-shadow: 0 0 10px rgba(0,0,0,0.5); border-radius: 10px;
    `;
    errorMessage.innerHTML = `
      <p style="color: red; font-weight: bold;">Error loading game assets!</p>
      <p>Failed to load images. Please ensure they are in the 'image/' folder.</p>
      <p>Error details: ${err}</p>
      <button onclick="this.parentNode.remove()" style="margin-top: 15px; padding: 10px 20px; background-color: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
    `;
    document.body.appendChild(errorMessage);
  });
