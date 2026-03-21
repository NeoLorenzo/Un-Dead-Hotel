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
  humanManager = null,
  humanController = null,
  humanCommandController = null,
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
  let textVisible = true;

  function refreshVisibility() {
    panel.hidden = !(enabled && textVisible);
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    refreshVisibility();
    if (!enabled) {
      panel.textContent = "";
    }
  }

  function setTextVisible(nextVisible) {
    textVisible = Boolean(nextVisible);
    refreshVisibility();
    if (!textVisible) {
      panel.textContent = "";
    }
  }

  function isTextVisible() {
    return textVisible;
  }

  function isEnabled() {
    return enabled;
  }

  function renderFrame(frameState = {}) {
    if (!enabled || !textVisible) {
      return;
    }

    const debugSnapshot = frameState?.debugSnapshot || null;
    const lines = ["First Contact Diagnostics"];
    const humanManagerDebug = debugSnapshot?.humanManager ||
      (typeof humanManager?.getDebugState === "function"
        ? humanManager.getDebugState()
        : null);
    const humanCommandDebug = debugSnapshot?.humanCommand ||
      (typeof humanCommandController?.getDebugState === "function"
        ? humanCommandController.getDebugState()
        : null);
    const humanDebug = debugSnapshot?.primaryHuman ||
      (typeof humanController?.getDebugState === "function"
        ? humanController.getDebugState()
        : null);
    const primaryHumanFromManager = Array.isArray(humanManagerDebug?.humans)
      ? humanManagerDebug.humans.find((human) => human?.id === "survivor_primary") ||
        humanManagerDebug.humans.find((human) => human?.role === "survivor")
      : null;
    const humanHealth = primaryHumanFromManager?.debug?.health || humanDebug?.health || null;
    if (humanHealth) {
      lines.push(
        `Survivor HP: ${toInt(humanHealth.currentHp)}/${toInt(humanHealth.maxHp)} | Dead: ${
          humanHealth.isDead === true
        }`
      );
    } else {
      lines.push("Survivor HP: unavailable");
    }

    if (humanManagerDebug) {
      const totalHumans = toInt(humanManagerDebug.humanCount);
      const livingHumans = toInt(humanManagerDebug.livingHumanCount);
      const livingSurvivors = toInt(humanManagerDebug.survivorCount);
      const livingGuests = toInt(humanManagerDebug.guestCount);
      lines.push(
        `Humans: living ${livingHumans}/${totalHumans} | survivors ${livingSurvivors} | guests ${livingGuests}`
      );

      const guestPopulation = humanManagerDebug.naturalGuestPopulation || null;
      if (guestPopulation?.enabled) {
        lines.push(
          `Guest population: active ${toInt(livingGuests)}/${toInt(
            guestPopulation.targetGuestCount
          )} | ring ${toInt(guestPopulation.minSpawnRadiusTiles)}-${toInt(
            guestPopulation.maxSpawnRadiusTiles
          )}`
        );
        if (guestPopulation.lastCycle) {
          lines.push(
            `Guest cycle: recycled ${toInt(
              guestPopulation.lastCycle.recycledCount
            )} | spawned ${toInt(guestPopulation.lastCycle.spawnedCount)} | skipped ${toInt(
              guestPopulation.lastCycle.skippedSpawnCount
            )}`
          );
        }
      }

      const guestPerceptionCycle = humanManagerDebug.guestPerception?.lastCycle || null;
      if (guestPerceptionCycle?.enabled) {
        lines.push(
          `Guest perception: detected ${toInt(
            guestPerceptionCycle.detectedGuestCount
          )}/${toInt(guestPerceptionCycle.guestCount)} | targets ${toInt(
            guestPerceptionCycle.targetCount
          )}`
        );
      }

      const guestBehaviorCycle = humanManagerDebug.guestBehavior?.lastCycle || null;
      if (guestBehaviorCycle?.enabled) {
        lines.push(
          `Guest behavior: flee ${toInt(guestBehaviorCycle.fleeGuestCount)} | wander ${toInt(
            guestBehaviorCycle.wanderGuestCount
          )} | replans ${toInt(guestBehaviorCycle.replansSucceeded)}/${toInt(
            guestBehaviorCycle.replansAttempted
          )}`
        );
      }
      if (Array.isArray(humanManagerDebug.guestBehavior?.byGuest)) {
        let fleeingNow = 0;
        let wanderingNow = 0;
        let replanningCooldownNow = 0;
        for (const guestState of humanManagerDebug.guestBehavior.byGuest) {
          if (guestState?.mode === "flee") {
            fleeingNow += 1;
          } else {
            wanderingNow += 1;
          }
          if (Number(guestState?.replanCooldownSeconds) > 0) {
            replanningCooldownNow += 1;
          }
        }
        lines.push(
          `Guest live states: flee ${toInt(fleeingNow)} | wander ${toInt(
            wanderingNow
          )} | replan cooldown ${toInt(replanningCooldownNow)}`
        );
      }

      const guestConversionCycle = humanManagerDebug.guestConversion?.lastCycle || null;
      if (humanManagerDebug.guestConversion?.enabled) {
        lines.push(
          `Guest conversions: total ${toInt(
            humanManagerDebug.guestConversion.totalConvertedCount
          )} | this cycle ${toInt(guestConversionCycle?.convertedCount)}`
        );
      }
    }
    if (humanCommandDebug) {
      const commandSummary = humanCommandDebug.lastCommandSummary || null;
      if (commandSummary) {
        lines.push(
          `Survivor command: selected ${toInt(
            commandSummary.selectedCount
          )} | assigned ${toInt(commandSummary.assignedCount)} | accepted ${toInt(
            commandSummary.acceptedCount
          )} | failed ${toInt(commandSummary.failedCount)}`
        );
      }
      const pathResult = humanCommandDebug.lastPathResult || null;
      const pathDebug = humanCommandDebug.lastPathDebug || null;
      const pathRequest = humanCommandDebug.lastPathRequest || null;
      const searchStats = pathDebug?.searchStats || null;
      if (pathResult || searchStats) {
        lines.push(
          `Path budget: status ${pathResult?.status || "n/a"} | expanded ${toInt(
            searchStats?.expandedCount
          )}/${toInt(searchStats?.maxNodes)} | open ${toInt(searchStats?.openCount)} | closed ${toInt(
            searchStats?.closedCount
          )}`
        );
      }
      if (pathRequest) {
        lines.push(
          `Path start recovery: adjusted ${pathRequest.wasStartAdjusted === true} | start blocked ${
            pathResult?.status === "start_blocked"
          }`
        );
      }
      const gridSummary = humanCommandDebug.lastGridSummary || null;
      if (gridSummary) {
        lines.push(
          `Path expansions: attempts ${toInt(
            gridSummary.expansionAttemptCount
          )} | mode ${gridSummary.expansionModeUsed || "n/a"} | auto ${toInt(
            gridSummary.autoExpansionAttemptsUsed
          )}/${toInt(gridSummary.maxDynamicExpansionAttempts)}`
        );
      }
    }

    const gameOverActive =
      typeof getGameOverActive === "function" ? getGameOverActive() === true : false;
    lines.push(`Game Over Active: ${gameOverActive}`);

    const zombieDebug = debugSnapshot?.zombieManager ||
      (typeof zombieManager?.getDebugState === "function"
        ? zombieManager.getDebugState()
        : null);
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
    setTextVisible,
    isEnabled,
    isTextVisible,
    renderFrame,
    clear,
    destroy,
  };
}
