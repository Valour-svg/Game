// =======================
// STATE
// =======================
let selected = [];
let phase = "planning";

let playerHP = 100;
let enemyHP = 100;

let lastTurnFirstAction = null;
let currentTurnFirstAction = null;

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

let enemyCanvas = document.getElementById("enemyCanvas");
let enemyCtx = enemyCanvas.getContext("2d");

let awaitingInput = false;
let lastLogText = "";

const ENEMY_BAR_LEFT = 50;
const ENEMY_BAR_WIDTH = 300;

let currentEnemyAttackKey = null;
let enemyAttackState = null;

const enemyAttacks = {
  quick: {
    name: "QUICK STRIKE",
    zoneStartRatio: 0.80,
    zoneWidthRatio: 0.06,
    perfectDamage: 2,
    failDamage: 10,
  },
  heavy: {
    name: "HEAVY STRIKE",
    zoneStartRatio: 0.70,
    zoneWidthRatio: 0.20,
    perfectDamage: 3,
    failDamage: 18,
  },
  fakeout: {
    name: "FAKE-OUT STRIKE",
    zoneStartRatio: 0.77,
    zoneWidthRatio: 0.12,
    perfectDamage: 2,
    failDamage: 14,
  },
};

const ENEMY_BAR_LEFT = 50;
const ENEMY_BAR_WIDTH = 300;

const enemyAttacks = {
  quick: {
    key: "quick",
    name: "QUICK STRIKE",
    zoneStartRatio: 0.78,
    zoneWidthRatio: 0.06,
    failDamage: 10,
    perfectDamage: () => Math.floor(Math.random() * 2) + 1,
  },
  heavy: {
    key: "heavy",
    name: "HEAVY STRIKE",
    zoneStartRatio: 0.72,
    zoneWidthRatio: 0.18,
    failDamage: 18,
    perfectDamage: () => 3,
  },
  fake: {
    key: "fake",
    name: "FAKE-OUT STRIKE",
    zoneStartRatio: 0.76,
    zoneWidthRatio: 0.12,
    failDamage: 14,
    perfectDamage: () => 2,
  },
};

// =======================
// INIT
// =======================
updateHP();
setPhase("planning");

// =======================
// PHASE SYSTEM
// =======================
function setPhase(newPhase) {
  phase = newPhase;

  let label = newPhase.toUpperCase();
  document.getElementById("phaseIndicator").innerText = "Phase: " + label;
  document.body.setAttribute("data-phase", label);
}

// =======================
// PLANNING
// =======================
function selectAction(action) {
  if (phase !== "planning") return;

  if (selected.length === 0) {
    selected.push(action);
    currentTurnFirstAction = action;
  } else if (selected.length === 1) {
    if (selected[0] === action) {
      log("❌ Cannot repeat same action!");
      return;
    }

    selected.push(action);
    startExecution();
  }

  document.getElementById("selectedActions").innerText =
    "Selected: " + selected.join(", ");
}

// =======================
// EXECUTION
// =======================
function startExecution() {
  setPhase("execution");

  document.getElementById("planning").style.display = "none";
  document.getElementById("execution").style.display = "block";
  document.getElementById("enemy").style.display = "none";

  if (lastTurnFirstAction) {
    log("🔁 Echo: " + lastTurnFirstAction);
    applyEcho(lastTurnFirstAction);
  }

  runNextAction();
}

function runNextAction() {
  if (selected.length === 0) {
    startEnemyPhase();
    return;
  }

  let action = selected.shift();
  document.getElementById("executionText").innerText = "Executing: " + action;

  if (action === "attack") {
    runTimingGame(resolveAttack);
  } else {
    log(action + " executed");
    setTimeout(runNextAction, 600);
  }
}

// =======================
// TIMING GAME (PLAYER)
// =======================
function runTimingGame(callback) {
  let cursor = 0;
  let speed = 3;
  let successStart = 150;
  let successEnd = 250;

  awaitingInput = true;
  document.getElementById("playerPrompt").innerText = "Press SPACE to attack";

  log("🎯 Press SPACE to attack");

  function loop() {
    if (!awaitingInput) return;

    ctx.clearRect(0, 0, 400, 200);

    ctx.fillStyle = "#21c76c";
    ctx.fillRect(successStart, 80, successEnd - successStart, 40);

    ctx.fillStyle = "#ff4b4b";
    ctx.fillRect(cursor, 70, 5, 60);

    cursor += speed;
    if (cursor > 400) cursor = 0;

    requestAnimationFrame(loop);
  }

  loop();

  window.onkeydown = function (e) {
    if (e.code !== "Space" || !awaitingInput) return;

    awaitingInput = false;
    window.onkeydown = null;
    callback(cursor >= successStart && cursor <= successEnd);
  };
}

function resolveAttack(success) {
  let dmg = success ? 20 : 8;
  enemyHP -= dmg;

  if (success) {
    log("💥 PERFECT hit for " + dmg);
    flashScreen("rgba(255,255,255,0.28)");
    showFloatingText("PERFECT", "#ffffff");
  } else {
    log("⚠️ WEAK hit for " + dmg);
    showFloatingText("WEAK", "#ffcf5a");
  }

  updateHP();

  if (enemyHP <= 0) return endGame("YOU WIN");

  setTimeout(runNextAction, 600);
}

// =======================
// 🔁 ECHO
// =======================
function applyEcho(action) {
  if (action === "attack") {
    enemyHP -= 5;
    log("Echo deals 5 dmg");
  }

  updateHP();
}

// =======================
// ENEMY PHASE
// =======================
function getRandomEnemyAttack() {
  let attackKeys = Object.keys(enemyAttacks);
  return attackKeys[Math.floor(Math.random() * attackKeys.length)];
}

function startEnemyPhase() {
  setPhase("enemy");

  document.getElementById("execution").style.display = "none";
  document.getElementById("enemy").style.display = "block";

  let attackKey = getRandomEnemyAttack();
  runEnemyAttack(attackKey);
}

function runEnemyAttack(attackKey) {
  let attack = enemyAttacks[attackKey];
  if (!attack) return;

  currentEnemyAttackKey = attackKey;

  let zoneStart = ENEMY_BAR_LEFT + ENEMY_BAR_WIDTH * attack.zoneStartRatio;
  let zoneEnd = zoneStart + ENEMY_BAR_WIDTH * attack.zoneWidthRatio;

  enemyAttackState = {
    resolved: false,
    cursorX: ENEMY_BAR_LEFT,
    startTime: performance.now(),
    zoneStart,
    zoneEnd,
  };

  let enemyLabel = document.getElementById("enemyTelegraphText");
  enemyLabel.innerText = "Enemy uses " + attack.name;

  let enemyPrompt = document.getElementById("enemyPrompt");
  enemyPrompt.innerText = "Press SPACE to block";

  log("⚠️ Enemy uses " + attack.name);

  awaitingInput = true;

  window.onkeydown = function (e) {
    if (e.code !== "Space" || !awaitingInput || enemyAttackState.resolved) return;

    let wasPerfect =
      enemyAttackState.cursorX >= enemyAttackState.zoneStart &&
      enemyAttackState.cursorX <= enemyAttackState.zoneEnd;

    resolveEnemyAttack(attackKey, wasPerfect);
  };

  requestAnimationFrame(loopEnemyAttack);
}

function loopEnemyAttack(now) {
  if (!enemyAttackState || enemyAttackState.resolved) return;

  let progress = getEnemyAttackProgress(currentEnemyAttackKey, now - enemyAttackState.startTime);
  enemyAttackState.cursorX = ENEMY_BAR_LEFT + ENEMY_BAR_WIDTH * progress;

  drawEnemyTelegraph(
    currentEnemyAttackKey,
    enemyAttackState.cursorX,
    enemyAttackState.zoneStart,
    enemyAttackState.zoneEnd
  );

  if (progress >= 1) {
    resolveEnemyAttack(currentEnemyAttackKey, false);
    return;
  }

  requestAnimationFrame(loopEnemyAttack);
}

function resolveEnemyAttack(attackKey, wasPerfect) {
  let attack = enemyAttacks[attackKey];
  if (!attack || !enemyAttackState || enemyAttackState.resolved) return;

  enemyAttackState.resolved = true;
  awaitingInput = false;
  window.onkeydown = null;

  let damage = wasPerfect ? attack.perfectDamage : attack.failDamage;
  playerHP -= damage;

  if (wasPerfect) {
    log("🛡️ BLOCK! " + attack.name + " reduced to " + damage + " dmg");
    flashScreen("rgba(103, 182, 255, 0.30)");
    showFloatingText("BLOCK", "#8dc4ff");
  } else {
    log("💥 HIT! " + attack.name + " deals " + damage);
    flashScreen("rgba(255, 80, 80, 0.28)");
    showFloatingText("HIT", "#ff8f8f");
  }

  updateHP();

  if (playerHP <= 0) return endGame("YOU DIED");

  setTimeout(resetTurn, 700);
}

function getEnemyAttackProgress(attackKey, elapsedMs) {
  if (attackKey === "quick") {
    return Math.min(1, elapsedMs / 820);
  }

  if (attackKey === "heavy") {
    let windUpPauseMs = 450;
    let moveMs = 1500;

    if (elapsedMs <= windUpPauseMs) {
      return 0;
    }

    let moveElapsed = elapsedMs - windUpPauseMs;
    return Math.min(1, moveElapsed / moveMs);
  }

  // fakeout
  let firstMoveMs = 700;
  let pauseMs = 300;
  let burstMs = 360;

  if (elapsedMs <= firstMoveMs) {
    return 0.52 * (elapsedMs / firstMoveMs);
  }

  if (elapsedMs <= firstMoveMs + pauseMs) {
    return 0.52;
  }

  let burstElapsed = elapsedMs - firstMoveMs - pauseMs;
  return Math.min(1, 0.52 + 0.48 * (burstElapsed / burstMs));
}

function drawEnemyTelegraph(attackKey, cursorX, zoneStart, zoneEnd) {
  let attack = enemyAttacks[attackKey];

  enemyCtx.clearRect(0, 0, 400, 200);

  enemyCtx.fillStyle = "#444";
  enemyCtx.fillRect(ENEMY_BAR_LEFT, 90, ENEMY_BAR_WIDTH, 20);

  enemyCtx.fillStyle = "#22c971";
  enemyCtx.fillRect(zoneStart, 80, zoneEnd - zoneStart, 40);

  enemyCtx.fillStyle = "#f95f5f";
  enemyCtx.fillRect(cursorX, 70, 5, 60);

  enemyCtx.fillStyle = "#f1f1f1";
  enemyCtx.font = "14px Arial";
  enemyCtx.fillText(attack.name, 12, 20);
  enemyCtx.fillText("SPACE = block", 12, 40);
}

// =======================
// FEEDBACK HELPERS
// =======================
function flashScreen(color) {
  let flash = document.getElementById("screenFlash");
  flash.style.background = color;
  flash.classList.add("show");

  setTimeout(function () {
    flash.classList.remove("show");
  }, 140);
}

function showFloatingText(text, color) {
  let layer = document.getElementById("floatingTextLayer");

  let popup = document.createElement("div");
  popup.className = "floating-text";
  popup.style.color = color;
  popup.innerText = text;

  layer.appendChild(popup);

  setTimeout(function () {
    popup.remove();
  }, 620);
}

// =======================
// RESET TURN
// =======================
function resetTurn() {
  lastTurnFirstAction = currentTurnFirstAction;
  currentTurnFirstAction = null;

  selected = [];
  currentEnemyAttackKey = null;
  enemyAttackState = null;

  document.getElementById("enemy").style.display = "none";
  document.getElementById("planning").style.display = "block";
  document.getElementById("selectedActions").innerText = "";
  document.getElementById("enemyTelegraphText").innerText = "Enemy Attack Incoming!";

  setPhase("planning");
}

// =======================
// HP
// =======================
function updateHP() {
  document.getElementById("playerHP").innerText = playerHP;
  document.getElementById("enemyHP").innerText = enemyHP;
}

// =======================
// END GAME
// =======================
function endGame(msg) {
  setPhase("ended");
  awaitingInput = false;
  window.onkeydown = null;

  document.getElementById("planning").style.display = "none";
  document.getElementById("execution").style.display = "none";
  document.getElementById("enemy").style.display = "none";

  log("=== " + msg + " ===");
}

// =======================
// LOG
// =======================
function log(text) {
  if (text === lastLogText) return;

  document.getElementById("log").innerHTML += "<p>" + text + "</p>";
  lastLogText = text;
}
