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
  document.getElementById("phaseIndicator").innerText =
    "Phase: " + newPhase.toUpperCase();
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

  document.getElementById("executionText").innerText =
    "Executing: " + action;

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

  log("🎯 PRESS SPACE!");

  function loop() {
    if (!awaitingInput) return;

    ctx.clearRect(0, 0, 400, 200);

    // success zone
    ctx.fillStyle = "green";
    ctx.fillRect(successStart, 80, successEnd - successStart, 40);

    // cursor
    ctx.fillStyle = "red";
    ctx.fillRect(cursor, 70, 5, 60);

    cursor += speed;
    if (cursor > 400) cursor = 0;

    requestAnimationFrame(loop);
  }

  loop();

  window.onkeydown = function (e) {
    if (e.code === "Space" && awaitingInput) {
      awaitingInput = false;
      window.onkeydown = null;

      callback(cursor >= successStart && cursor <= successEnd);
    }
  };
}

function resolveAttack(success) {
  let dmg = success ? 20 : 8;

  enemyHP -= dmg;

  log(success ? "💥 Perfect! " + dmg : "⚠️ Weak " + dmg);

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
function getRandomAttack() {
  let attacks = Object.values(enemyAttacks);
  return attacks[Math.floor(Math.random() * attacks.length)];
}

function startEnemyPhase() {
  setPhase("enemy");

  document.getElementById("execution").style.display = "none";
  document.getElementById("enemy").style.display = "block";

  let attack = getRandomAttack();
  runEnemyAttack(attack);
}

function runEnemyAttack(attack) {
  let zoneStart = ENEMY_BAR_LEFT + ENEMY_BAR_WIDTH * attack.zoneStartRatio;
  let zoneEnd = zoneStart + ENEMY_BAR_WIDTH * attack.zoneWidthRatio;

  let enemyLabel = document.getElementById("enemyTelegraphText");
  if (enemyLabel) enemyLabel.innerText = "Enemy uses " + attack.name;

  log("⚠️ Enemy uses " + attack.name);
  log("🛡️ Press SPACE to block at impact!");

  awaitingInput = true;

  let resolved = false;
  let cursorX = ENEMY_BAR_LEFT;
  let startTime = performance.now();

  function resolveEnemyAttack(perfectBlock) {
    if (resolved) return;
    resolved = true;
    awaitingInput = false;
    window.onkeydown = null;

    let damage = perfectBlock ? attack.perfectDamage() : attack.failDamage;
    playerHP -= damage;

    if (perfectBlock) {
      log("🟢 PERFECT BLOCK vs " + attack.name + "! You take " + damage);
    } else {
      log("💥 " + attack.name + " hits! You take " + damage);
    }

    updateHP();

    if (playerHP <= 0) return endGame("YOU DIED");

    setTimeout(resetTurn, 700);
  }

  function loop(now) {
    if (resolved) return;

    let progress = getAttackProgress(attack, now - startTime);
    cursorX = ENEMY_BAR_LEFT + ENEMY_BAR_WIDTH * progress;

    drawEnemyTelegraph(attack, cursorX, zoneStart, zoneEnd);

    if (progress >= 1) {
      resolveEnemyAttack(false);
      return;
    }

    requestAnimationFrame(loop);
  }

  window.onkeydown = function (e) {
    if (e.code !== "Space" || !awaitingInput || resolved) return;

    let perfect = cursorX >= zoneStart && cursorX <= zoneEnd;
    resolveEnemyAttack(perfect);
  };

  requestAnimationFrame(loop);
}

function getAttackProgress(attack, elapsedMs) {
  if (attack.key === "quick") {
    // very fast, almost no warning
    return Math.min(1, elapsedMs / 800);
  }

  if (attack.key === "heavy") {
    // slow wind-up, delayed impact
    let windUpMs = 1300;
    let holdMs = 500;
    let finishMs = 500;

    if (elapsedMs <= windUpMs) {
      return 0.82 * (elapsedMs / windUpMs);
    }

    if (elapsedMs <= windUpMs + holdMs) {
      return 0.82;
    }

    let finishElapsed = elapsedMs - windUpMs - holdMs;
    return Math.min(1, 0.82 + 0.18 * (finishElapsed / finishMs));
  }

  // fake-out: normal start, pause, then burst fast
  let firstMs = 850;
  let pauseMs = 320;
  let burstMs = 280;

  if (elapsedMs <= firstMs) {
    return 0.48 * (elapsedMs / firstMs);
  }

  if (elapsedMs <= firstMs + pauseMs) {
    return 0.48;
  }

  let burstElapsed = elapsedMs - firstMs - pauseMs;
  return Math.min(1, 0.48 + 0.52 * (burstElapsed / burstMs));
}

function drawEnemyTelegraph(attack, cursorX, zoneStart, zoneEnd) {
  enemyCtx.clearRect(0, 0, 400, 200);

  // attack bar
  enemyCtx.fillStyle = "#555";
  enemyCtx.fillRect(ENEMY_BAR_LEFT, 90, ENEMY_BAR_WIDTH, 20);

  // perfect block zone
  enemyCtx.fillStyle = "#20d070";
  enemyCtx.fillRect(zoneStart, 80, zoneEnd - zoneStart, 40);

  // cursor
  enemyCtx.fillStyle = "#ff4545";
  enemyCtx.fillRect(cursorX, 70, 5, 60);

  // helper text
  enemyCtx.fillStyle = "white";
  enemyCtx.font = "14px Arial";
  enemyCtx.fillText(attack.name, 12, 20);
  enemyCtx.fillText("SPACE = block", 12, 40);
}

// =======================
// RESET TURN
// =======================
function resetTurn() {
  lastTurnFirstAction = currentTurnFirstAction;
  currentTurnFirstAction = null;

  selected = [];

  document.getElementById("enemy").style.display = "none";
  document.getElementById("planning").style.display = "block";
  document.getElementById("selectedActions").innerText = "";

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
  document.getElementById("log").innerHTML += "<p>" + text + "</p>";
}
