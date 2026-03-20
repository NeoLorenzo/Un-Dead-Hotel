function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return Number(value).toFixed(digits);
}

function toInt(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Number(value));
}

export function createFirstContactDiagnosticsPanel({
  parentElement = null,
  humanController = null,
  zombieManager = null,
  getGameOverActive = null,
} = {}) {
  if (!parentElement) {
    throw new Error("createFirstContactDiagnosticsPanel requires parentElement.");
  }

  const panel = document.createElement("pre");
  panel.id = "first-contact-diagnostics";
  panel.hidden = true;
  parentElement.appendChild(panel);

  let enabled = false;

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    panel.hidden = !enabled;
    if (!enabled) {
      panel.textContent = "";
    }
  }

  function isEnabled() {
    return enabled;
  }

  function renderFrame() {
    if (!enabled) {
      return;
    }

    const lines = ["First Contact Diagnostics"];
    const humanDebug =
      typeof humanController?.getDebugState === "function"
        ? humanController.getDebugState()
        : null;
    const humanHealth = humanDebug?.health || null;
    if (humanHealth) {
      lines.push(
        `Human HP: ${toInt(humanHealth.currentHp)}/${toInt(humanHealth.maxHp)} | Dead: ${
          humanHealth.isDead === true
        }`
      );
    } else {
      lines.push("Human HP: unavailable");
    }

    const gameOverActive =
      typeof getGameOverActive === "function" ? getGameOverActive() === true : false;
    lines.push(`Game Over Active: ${gameOverActive}`);

    const zombieDebug =
      typeof zombieManager?.getDebugState === "function"
        ? zombieManager.getDebugState()
        : null;
    if (!zombieDebug) {
      lines.push("Zombies: unavailable");
      panel.textContent = lines.join("\n");
      return;
    }

    const healthSummary = zombieDebug.healthSummary || {};
    lines.push(
      `Zombies: ${toInt(healthSummary.aliveZombieCount)}/${toInt(
        healthSummary.zombieCount
      )} alive | HP avg ${formatNumber(healthSummary.averageCurrentHp, 1)} | min ${formatNumber(
        healthSummary.minCurrentHp,
        0
      )} | max ${formatNumber(healthSummary.maxCurrentHp, 0)}`
    );

    const modeCounts = zombieDebug.pursuitDiagnostics?.modeCounts || {};
    lines.push(
      `Pursuit modes: wander ${toInt(modeCounts.wander)} | pursuit ${toInt(
        modeCounts.pursuit
      )} | investigate ${toInt(modeCounts.investigate)} | attack ${toInt(modeCounts.attack)}`
    );
    lines.push(
      `Target locks: ${toInt(
        zombieDebug.pursuitDiagnostics?.zombiesWithTargetLock
      )} | line-of-sight: ${toInt(zombieDebug.pursuitDiagnostics?.zombiesWithLineOfSight)}`
    );

    const attackDiagnostics = zombieDebug.attackDiagnostics || {};
    const attackCycle = attackDiagnostics.lastCycle || null;
    lines.push(
      `Attack readiness: ready ${toInt(
        attackDiagnostics.readyToAttackCount
      )} | cooldown ${toInt(attackDiagnostics.attackOnCooldownCount)}`
    );
    if (attackCycle?.enabled) {
      lines.push(
        `Attack cycle: applied ${toInt(attackCycle.attackedCount)} | cooldown-blocked ${toInt(
          attackCycle.cooldownBlockedCount
        )} | out-of-range ${toInt(attackCycle.outOfRangeCount)} | no-target ${toInt(
          attackCycle.noTargetCount
        )}`
      );
    }

    const population = zombieDebug.firstContactPopulation || null;
    if (population?.enabled) {
      lines.push(
        `Population: active ${toInt(population.activeZombieCount)}/${toInt(
          population.targetZombieCount
        )} | ring ${toInt(population.minSpawnRadiusTiles)}-${toInt(
          population.maxSpawnRadiusTiles
        )}`
      );
      if (population.lastCycle) {
        lines.push(
          `Last cycle: recycled ${toInt(population.lastCycle.recycledCount)} | spawned ${toInt(
            population.lastCycle.spawnedCount
          )} | skipped ${toInt(population.lastCycle.skippedSpawnCount)}`
        );
      }
    }

    panel.textContent = lines.join("\n");
  }

  function clear() {
    panel.textContent = "";
  }

  function destroy() {
    panel.remove();
  }

  return {
    setEnabled,
    isEnabled,
    renderFrame,
    clear,
    destroy,
  };
}
