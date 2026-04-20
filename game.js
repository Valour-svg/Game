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
// ENEMY PHASE (CLEAR TELEGRAPH)
// =======================
function startEnemyPhase() {
  setPhase("enemy");

  document.getElementById("execution").style.display = "none";
  document.getElementById("enemy").style.display = "block";

  let x = 0;
  let speed = 2;
  let perfectStart = 180;
  let perfectEnd = 220;

  awaitingInput = true;

  log("⚠️ Enemy Attack Incoming!");

  function loop() {
    if (!awaitingInput) return;

    enemyCtx.clearRect(0, 0, 400, 200);

    // bar
    enemyCtx.fillStyle = "gray";
    enemyCtx.fillRect(50, 90, 300, 20);

    // perfect block zone
    enemyCtx.fillStyle = "green";
    enemyCtx.fillRect(perfectStart, 80, perfectEnd - perfectStart, 40);

    // cursor
    enemyCtx.fillStyle = "red";
    enemyCtx.fillRect(50 + x, 70, 5, 60);

    x += speed;
    if (x > 300) x = 300;

    requestAnimationFrame(loop);
  }

  loop();

  window.onkeydown = function (e) {
    if (e.code === "Space" && awaitingInput) {
      awaitingInput = false;

      let pos = 50 + x;

      let dmg = (pos >= perfectStart && pos <= perfectEnd) ? 2 : 12;

      playerHP -= dmg;

      log(dmg === 2 ? "🛡️ PERFECT BLOCK!" : "💥 HIT!");

      updateHP();

      if (playerHP <= 0) return endGame("YOU DIED");

      setTimeout(resetTurn, 700);
    }
  };
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