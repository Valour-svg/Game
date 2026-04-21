(function () {
  "use strict";

  let selected = [];
  let phase = "planning";

  let playerHP = 100;
  let enemyHP = 100;
  let focus = 3;
  const MAX_FOCUS = 5;

  let lastTurnFirstAction = null;
  let currentTurnFirstAction = null;

  let currentEcho = null;
  let stepPrepared = false;
  let guardPrepared = false;
  let guardEchoShield = 0;
  let pierceEchoArmed = false;

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

  const playerActions = {
    strike: { name: "Strike", cost: 0, desc: "Reliable damage, easy timing" },
    pierce: { name: "Pierce", cost: 1, desc: "Stronger damage, tighter timing" },
    guard: { name: "Guard", cost: 0, desc: "Improves defense and imperfect blocks" },
    step: { name: "Step", cost: 0, desc: "Setup that widens a future timing window" },
    echoBurst: { name: "Echo Burst", cost: 2, desc: "Consumes Echo for stronger effect" },
  };

  const enemyAttacks = {
    quick: { name: "QUICK STRIKE", zoneStartRatio: 0.8, zoneWidthRatio: 0.06, perfectDamage: 2, failDamage: 10 },
    heavy: { name: "HEAVY STRIKE", zoneStartRatio: 0.7, zoneWidthRatio: 0.2, perfectDamage: 3, failDamage: 18 },
    fakeout: { name: "FAKE-OUT STRIKE", zoneStartRatio: 0.77, zoneWidthRatio: 0.12, perfectDamage: 2, failDamage: 14 },
  };

  updateHP();
  updateResourcesUI();
  renderActionCards();
  updatePlanningInfo();
  setPhase("planning");

  function setPhase(newPhase) {
    phase = newPhase;
    let label = newPhase.toUpperCase();
    document.getElementById("phaseIndicator").innerText = "Phase: " + label;
    document.body.setAttribute("data-phase", label);
  }

  function spendFocus(amount) {
    focus = Math.max(0, focus - amount);
    updateResourcesUI();
  }

  function gainFocus(amount) {
    focus = Math.min(MAX_FOCUS, focus + amount);
    updateResourcesUI();
  }

  function canUseAction(actionKey) {
    let action = playerActions[actionKey];
    return action && focus >= action.cost;
  }

  function getPlannedCost() {
    return selected.reduce(function (sum, key) {
      return sum + (playerActions[key] ? playerActions[key].cost : 0);
    }, 0);
  }

  function getPlanningEcho() {
    return actionToEcho(lastTurnFirstAction);
  }

  function setEcho(echoData) {
    currentEcho = echoData;
    updateResourcesUI();
  }

  function consumeEcho() {
    let oldEcho = currentEcho;
    currentEcho = null;
    updateResourcesUI();
    return oldEcho;
  }

  function actionToEcho(actionKey) {
    if (!actionKey) return null;
    if (actionKey === "strike") return { type: "strike", label: "Strike", meaning: "deals bonus damage" };
    if (actionKey === "pierce") return { type: "pierce", label: "Pierce", meaning: "boosts next successful timing hit" };
    if (actionKey === "guard") return { type: "guard", label: "Guard", meaning: "reduces incoming damage" };
    if (actionKey === "step") return { type: "step", label: "Step", meaning: "widens next timing window" };
    return null;
  }

  function getEchoDisplayText(echoData) {
    if (!echoData) return "None";
    return echoData.label + " — " + echoData.meaning;
  }

  function applyEchoStartOfTurn() {
    if (!currentEcho) {
      log("[Echo] None this turn.");
      return;
    }

    log("[Echo] " + currentEcho.label + " triggers.");
    showEchoEffect(currentEcho.type);

    if (currentEcho.type === "strike") {
      enemyHP -= 4;
      log("[Echo] Strike deals 4 bonus damage.");
      flashEntity("enemyEntity", "enemy-hit");
    } else if (currentEcho.type === "pierce") {
      pierceEchoArmed = true;
      log("[Echo] Pierce bonus armed for next successful timing hit.");
    } else if (currentEcho.type === "guard") {
      guardEchoShield = 2;
      log("[Echo] Guard reduces next incoming damage by 2.");
    } else if (currentEcho.type === "step") {
      stepPrepared = true;
      log("[Echo] Step widens next player timing window.");
    }

    updateHP();
  }

  function renderActionCards() {
    let panel = document.getElementById("actionPanel");
    panel.innerHTML = "";

    Object.keys(playerActions).forEach(function (key) {
      let action = playerActions[key];
      let card = document.createElement("div");
      card.className = "action-card";

      let title = document.createElement("div");
      title.className = "action-title";
      title.innerText = action.name + " (" + action.cost + " Focus)";

      let desc = document.createElement("div");
      desc.className = "action-desc";
      desc.innerText = action.desc;

      let btn = document.createElement("button");
      btn.innerText = "Select " + action.name;
      btn.setAttribute("data-action", key);
      btn.onclick = function () {
        selectAction(key);
      };

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(btn);
      panel.appendChild(card);
    });
  }

  function updatePlanningInfo() {
    let echoPreview = getPlanningEcho();
    document.getElementById("echoValue").innerText = getEchoDisplayText(echoPreview);
    document.getElementById("slot1").innerText = selected[0] ? getActionName(selected[0]) : "—";
    document.getElementById("slot2").innerText = selected[1] ? getActionName(selected[1]) : "—";

    let remaining = focus - getPlannedCost();
    document.getElementById("planningFocus").innerText = "Planning Focus: " + remaining + " available";

    updateEchoAura();
    updateActionButtons();
  }

  function updateActionButtons() {
    let buttons = document.querySelectorAll("#actionPanel button[data-action]");
    let remaining = focus - getPlannedCost();

    buttons.forEach(function (btn) {
      let key = btn.getAttribute("data-action");
      let action = playerActions[key];

      let duplicateSelection = selected.includes(key);
      let tooManySelected = selected.length >= 2;
      let unaffordable = action.cost > remaining;

      btn.disabled = duplicateSelection || tooManySelected || unaffordable;
    });
  }

  function selectAction(actionKey) {
    if (phase !== "planning") return;
    if (!playerActions[actionKey]) return;

    let projectedCost = getPlannedCost() + playerActions[actionKey].cost;
    if (projectedCost > focus) {
      log("[Focus] Cannot queue " + getActionName(actionKey) + ": not enough Focus this turn.");
      return;
    }

    if (selected.length === 0) {
      selected.push(actionKey);
      currentTurnFirstAction = actionKey;
      updatePlanningInfo();
      return;
    }

    if (selected.length === 1) {
      if (selected[0] === actionKey) {
        log("[Player] Cannot repeat the same action.");
        return;
      }

      selected.push(actionKey);
      updatePlanningInfo();
      startExecution();
    }
  }

  function getActionName(actionKey) {
    return playerActions[actionKey] ? playerActions[actionKey].name : actionKey;
  }

  function startExecution() {
    setPhase("execution");

    document.getElementById("planning").style.display = "none";
    document.getElementById("execution").style.display = "block";
    document.getElementById("enemy").style.display = "none";

    setEcho(getPlanningEcho());
    applyEchoStartOfTurn();

    runNextAction();
  }

  function runNextAction() {
    if (selected.length === 0) {
      startEnemyPhase();
      return;
    }

    let actionKey = selected.shift();
    let action = playerActions[actionKey];

    document.getElementById("executionText").innerText = "Action: " + action.name;
    log("[Player] Uses " + action.name + ".");

    if (!canUseAction(actionKey)) {
      log("[Focus] Not enough Focus for " + action.name + " (cost " + action.cost + ").");
      setTimeout(runNextAction, 500);
      return;
    }

    if (action.cost > 0) {
      spendFocus(action.cost);
      log("[Focus] -" + action.cost + " (" + action.name + ").");
    }

    executePlayerAction(actionKey);
  }

  function executePlayerAction(actionKey) {
    if (actionKey === "strike") {
      animatePlayerAttack();
      runPlayerAttackTiming({
        speed: 2.6,
        successStart: stepPrepared ? 130 : 145,
        successEnd: stepPrepared ? 275 : 255,
        hitDamage: 15,
        weakDamage: 8,
        label: "Strike",
      });
      stepPrepared = false;
      return;
    }

    if (actionKey === "pierce") {
      animatePlayerAttack();
      runPlayerAttackTiming({
        speed: 3.4,
        successStart: stepPrepared ? 160 : 175,
        successEnd: stepPrepared ? 250 : 230,
        hitDamage: 23,
        weakDamage: 6,
        label: "Pierce",
      });
      stepPrepared = false;
      return;
    }

    if (actionKey === "guard") {
      guardPrepared = true;
      showBattleText("GUARD", "#8bc7ff");
      log("[Player] Guard prepared (imperfect block damage reduced).");
      setTimeout(runNextAction, 450);
      return;
    }

    if (actionKey === "step") {
      stepPrepared = true;
      animateStep();
      showBattleText("STEP", "#8cff9f");
      log("[Player] Step prepared (next timing window wider).");
      setTimeout(runNextAction, 450);
      return;
    }

    if (!currentEcho) {
      enemyHP -= 4;
      flashEntity("enemyEntity", "enemy-hit");
      showBattleText("MISS", "#ffcf75");
      log("[Player] Echo Burst is weak without Echo (4 damage).");
      updateHP();
      if (enemyHP <= 0) return endGame("YOU WIN");
      setTimeout(runNextAction, 450);
      return;
    }

    let consumed = consumeEcho();
    let burstDamage = 0;

    if (consumed.type === "strike") {
      burstDamage = 18;
    } else if (consumed.type === "pierce") {
      burstDamage = 26;
    } else if (consumed.type === "guard") {
      burstDamage = 10;
      guardPrepared = true;
    } else if (consumed.type === "step") {
      burstDamage = 14;
      stepPrepared = true;
      gainFocus(1);
      log("[Focus] +1 from Step Echo Burst bonus.");
    }

    enemyHP -= burstDamage;
    animatePlayerAttack();
    flashEntity("enemyEntity", "enemy-hit");
    showBattleText("ECHO BURST", "#e0c2ff");
    log("[Player] Echo Burst consumes " + consumed.label + " for " + burstDamage + " damage.");
    updateHP();

    if (enemyHP <= 0) return endGame("YOU WIN");

    setTimeout(runNextAction, 550);
  }

  function runPlayerAttackTiming(config) {
    let cursor = 0;

    awaitingInput = true;
    document.getElementById("playerPrompt").innerText = "Press SPACE to attack";

    function finishAttack(success) {
      awaitingInput = false;
      window.onkeydown = null;

      let dmg = success ? config.hitDamage : config.weakDamage;

      if (success && pierceEchoArmed) {
        dmg += 7;
        pierceEchoArmed = false;
        log("[Echo] Pierce bonus +7 damage.");
      }

      enemyHP -= dmg;

      if (success) {
        flashEntity("enemyEntity", "enemy-hit");
        showBattleText("PERFECT", "#ffffff");
        log("[Player] Perfect timing: " + config.label + " deals " + dmg + ".");
        gainFocus(1);
        log("[Focus] +1 from perfect timing.");
      } else {
        showBattleText("MISS", "#ffcf75");
        log("[Player] Miss timing: " + config.label + " deals " + dmg + ".");
      }

      updateHP();

      if (enemyHP <= 0) return endGame("YOU WIN");

      setTimeout(runNextAction, 500);
    }

    function loop() {
      if (!awaitingInput) return;

      ctx.clearRect(0, 0, 400, 200);
      ctx.fillStyle = "#21c76c";
      ctx.fillRect(config.successStart, 80, config.successEnd - config.successStart, 40);
      ctx.fillStyle = "#ff4b4b";
      ctx.fillRect(cursor, 70, 5, 60);

      cursor += config.speed;

      if (cursor >= 400) {
        finishAttack(false);
        return;
      }

      requestAnimationFrame(loop);
    }

    window.onkeydown = function (e) {
      if (e.code !== "Space" || !awaitingInput) return;

      let success = cursor >= config.successStart && cursor <= config.successEnd;
      finishAttack(success);
    };

    loop();
  }

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

    let zoneBonus = stepPrepared ? 0.08 : 0;
    let zoneStart = ENEMY_BAR_LEFT + ENEMY_BAR_WIDTH * attack.zoneStartRatio;
    let zoneEnd = zoneStart + ENEMY_BAR_WIDTH * (attack.zoneWidthRatio + zoneBonus);
    zoneEnd = Math.min(ENEMY_BAR_LEFT + ENEMY_BAR_WIDTH, zoneEnd);

    enemyAttackState = {
      resolved: false,
      cursorX: ENEMY_BAR_LEFT,
      startTime: performance.now(),
      zoneStart,
      zoneEnd,
    };

    stepPrepared = false;

    document.getElementById("enemyTelegraphText").innerText = "Enemy uses " + attack.name;
    document.getElementById("enemyPrompt").innerText = "Press SPACE to block";

    log("[Enemy] Uses " + attack.name + ".");
    animateEnemyAttack();

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

    if (!wasPerfect && guardPrepared) {
      damage = Math.max(1, damage - 5);
      log("[Player] Guard reduces imperfect block damage by 5.");
    }

    if (guardEchoShield > 0) {
      damage = Math.max(0, damage - guardEchoShield);
      log("[Echo] Guard reduces damage by " + guardEchoShield + ".");
      guardEchoShield = 0;
    }

    guardPrepared = false;

    playerHP -= damage;

    if (wasPerfect) {
      showBattleText("PERFECT", "#8dc4ff");
      log("[Enemy] Perfect block: only " + damage + " damage taken.");
      gainFocus(1);
      log("[Focus] +1 from perfect block timing.");
    } else {
      showBattleText("HIT", "#ff8f8f");
      flashEntity("playerEntity", "player-hit");
      shakeBattlefield();
      if (attackKey === "heavy") {
        shakeBattlefield();
      }
      log("[Enemy] Hit lands: " + damage + " damage.");
    }

    updateHP();

    if (playerHP <= 0) return endGame("YOU DIED");

    setTimeout(resetTurn, 700);
  }

  function getEnemyAttackProgress(attackKey, elapsedMs) {
    if (attackKey === "quick") return Math.min(1, elapsedMs / 820);

    if (attackKey === "heavy") {
      let windUpPauseMs = 450;
      let moveMs = 1500;

      if (elapsedMs <= windUpPauseMs) return 0;

      let moveElapsed = elapsedMs - windUpPauseMs;
      return Math.min(1, moveElapsed / moveMs);
    }

    let firstMoveMs = 700;
    let pauseMs = 300;
    let burstMs = 360;

    if (elapsedMs <= firstMoveMs) return 0.52 * (elapsedMs / firstMoveMs);
    if (elapsedMs <= firstMoveMs + pauseMs) return 0.52;

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

  // ===== Battlefield presentation helpers =====
  function animatePlayerAttack() {
    let player = document.getElementById("playerEntity");
    player.classList.add("player-lunge");
    setTimeout(function () {
      player.classList.remove("player-lunge");
    }, 140);
  }

  function animateEnemyAttack() {
    let projectile = document.getElementById("enemyProjectile");
    projectile.classList.remove("fly");
    // restart animation
    void projectile.offsetWidth;
    projectile.classList.add("fly");
  }

  function animateStep() {
    let player = document.getElementById("playerEntity");
    player.classList.add("player-step");
    setTimeout(function () {
      player.classList.remove("player-step");
    }, 180);
  }

  function flashEntity(entityId, flashClass) {
    let el = document.getElementById(entityId);
    el.classList.add("hit-flash");
    if (flashClass) el.classList.add(flashClass);

    setTimeout(function () {
      el.classList.remove("hit-flash");
      if (flashClass) el.classList.remove(flashClass);
    }, 120);
  }

  function showEchoEffect(type) {
    updateEchoAura();
    showBattleText("ECHO", "#d8c4ff");

    if (type === "strike") flashEntity("enemyEntity", "enemy-hit");
    if (type === "guard") flashEntity("playerEntity", "player-hit");
  }

  function updateEchoAura() {
    let aura = document.getElementById("echoAura");
    aura.className = "";

    let echo = currentEcho || getPlanningEcho();
    if (!echo) return;

    aura.classList.add("active");
    aura.classList.add("echo-" + echo.type);
  }

  function showBattleText(text, color) {
    let center = document.getElementById("battleCenterText");
    center.innerText = text;
    center.style.color = color || "#fff";
    center.classList.remove("show");
    void center.offsetWidth;
    center.classList.add("show");
  }

  function shakeBattlefield() {
    let field = document.getElementById("battlefield");
    field.classList.remove("shake");
    void field.offsetWidth;
    field.classList.add("shake");
  }

  // ===== feedback helpers =====
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

  function resetTurn() {
    lastTurnFirstAction = currentTurnFirstAction;
    currentTurnFirstAction = null;

    selected = [];
    currentEnemyAttackKey = null;
    enemyAttackState = null;
    pierceEchoArmed = false;

    document.getElementById("enemy").style.display = "none";
    document.getElementById("planning").style.display = "block";
    document.getElementById("enemyTelegraphText").innerText = "Enemy Attack Incoming!";

    setPhase("planning");
    updateResourcesUI();
    updatePlanningInfo();
  }

  function updateHP() {
    document.getElementById("playerHP").innerText = playerHP;
    document.getElementById("enemyHP").innerText = enemyHP;
  }

  function updateResourcesUI() {
    document.getElementById("focusValue").innerText = focus + " / " + MAX_FOCUS;
    document.getElementById("echoValue").innerText = getEchoDisplayText(getPlanningEcho());
    updateEchoAura();
  }

  function endGame(msg) {
    setPhase("ended");
    awaitingInput = false;
    window.onkeydown = null;

    document.getElementById("planning").style.display = "none";
    document.getElementById("execution").style.display = "none";
    document.getElementById("enemy").style.display = "none";

    log("[System] === " + msg + " ===");
  }

  function log(text) {
    if (text === lastLogText) return;

    document.getElementById("log").innerHTML += "<p>" + text + "</p>";
    lastLogText = text;
  }

  window.selectAction = selectAction;
})();
