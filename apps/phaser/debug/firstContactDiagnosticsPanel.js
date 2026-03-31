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

      const guestDangerMemory = humanManagerDebug.guestDangerMemory || null;
      const guestDangerCycle = guestDangerMemory?.lastCycle || null;
      if (guestDangerMemory?.enabled && guestDangerCycle?.enabled) {
        lines.push(
          `Guest danger sources: live ${toInt(
            guestDangerCycle.liveDangerSourceGuestCount
          )} | remembered ${toInt(
            guestDangerCycle.rememberedDangerSourceGuestCount
          )} | none ${toInt(guestDangerCycle.noDangerSourceGuestCount)} | expired ${toInt(
            guestDangerCycle.expiredDangerMemoryCount
          )}`
        );
      }

      const guestBehaviorCycle = humanManagerDebug.guestBehavior?.lastCycle || null;
      if (guestBehaviorCycle?.enabled) {
        lines.push(
          `Guest behavior: flee ${toInt(guestBehaviorCycle.fleeGuestCount)} | shelter ${toInt(
            guestBehaviorCycle.shelterGuestCount
          )} | wander ${toInt(guestBehaviorCycle.wanderGuestCount)} | replans ${toInt(
            guestBehaviorCycle.replansSucceeded
          )}/${toInt(
            guestBehaviorCycle.replansAttempted
          )}`
        );
        lines.push(
          `Guest intent: shelter ${toInt(
            guestBehaviorCycle.shelterIntentGuestCount
          )} | danger ${toInt(guestBehaviorCycle.dangerIntentGuestCount)} | wander ${toInt(
            guestBehaviorCycle.wanderIntentGuestCount
          )}`
        );
        const replanReasonCounts = guestBehaviorCycle.replanReasonCounts || null;
        if (replanReasonCounts && typeof replanReasonCounts === "object") {
          const reasonEntries = Object.entries(replanReasonCounts).sort((a, b) =>
            String(a[0]).localeCompare(String(b[0]))
          );
          if (reasonEntries.length > 0) {
            const reasonLabel = reasonEntries
              .map(([reason, count]) => `${reason}:${toInt(count)}`)
              .join(" | ");
            lines.push(`Guest replan reasons: ${reasonLabel}`);
          }
        }
        const dispatchModeCounts = guestBehaviorCycle.dispatchModeCounts || null;
        if (dispatchModeCounts && typeof dispatchModeCounts === "object") {
          lines.push(
            `Guest dispatch: wander ${toInt(
              dispatchModeCounts.wander
            )} | shelter ${toInt(dispatchModeCounts.shelter)} | danger_flee ${toInt(
              dispatchModeCounts.danger_flee
            )} | danger_room_egress ${toInt(
              dispatchModeCounts.danger_room_egress
            )} | unknown ${toInt(dispatchModeCounts.unknown)}`
          );
        }
        const pathStatusCounts = guestBehaviorCycle.pathStatusCounts || null;
        if (pathStatusCounts && typeof pathStatusCounts === "object") {
          lines.push(
            `Guest path status: idle ${toInt(
              pathStatusCounts.idle
            )} | following ${toInt(pathStatusCounts.following_path)} | valid ${toInt(
              pathStatusCounts.valid
            )} | retrying ${toInt(pathStatusCounts.retrying)} | unknown ${toInt(
              pathStatusCounts.unknown
            )}`
          );
        }
        const pathFeedbackStatusCounts =
          guestBehaviorCycle.pathFeedbackStatusCounts || null;
        if (
          pathFeedbackStatusCounts &&
          typeof pathFeedbackStatusCounts === "object"
        ) {
          lines.push(
            `Guest path feedback: none ${toInt(
              pathFeedbackStatusCounts.none
            )} | success ${toInt(pathFeedbackStatusCounts.success)} | failure ${toInt(
              pathFeedbackStatusCounts.failure
            )} | unknown ${toInt(pathFeedbackStatusCounts.unknown)}`
          );
        }
        const shelterResolutionStats =
          guestBehaviorCycle.shelterResolutionStats || null;
        if (
          shelterResolutionStats &&
          typeof shelterResolutionStats === "object"
        ) {
          lines.push(
            `Guest shelter plan: attempts ${toInt(
              shelterResolutionStats.attempted
            )} | resolved ${toInt(
              shelterResolutionStats.resolvedTarget
            )} | assigned ${toInt(shelterResolutionStats.pathAssigned)} | failed ${toInt(
              shelterResolutionStats.failed
            )}`
          );
          lines.push(
            `Guest shelter failures: no_safe_zone ${toInt(
              shelterResolutionStats.noSafeZone
            )} | path_failed ${toInt(
              shelterResolutionStats.pathFailed
            )} | rejected ${toInt(shelterResolutionStats.rejectedByController)}`
          );
          const shelterFailureReasons = shelterResolutionStats.failureReasonCounts;
          if (shelterFailureReasons && typeof shelterFailureReasons === "object") {
            const failureReasonEntries = Object.entries(shelterFailureReasons).sort(
              (a, b) => String(a[0]).localeCompare(String(b[0]))
            );
            if (failureReasonEntries.length > 0) {
              const failureReasonLabel = failureReasonEntries
                .map(([reason, count]) => `${reason}:${toInt(count)}`)
                .join(" | ");
              lines.push(`Guest shelter reason map: ${failureReasonLabel}`);
            }
          }
        }
      }
      if (Array.isArray(humanManagerDebug.guestBehavior?.byGuest)) {
        let fleeingNow = 0;
        let shelteringNow = 0;
        let wanderingNow = 0;
        let shelterIntentNow = 0;
        let dangerIntentNow = 0;
        let dangerRetryingNow = 0;
        let replanningCooldownNow = 0;
        let validPathNow = 0;
        let retryingNow = 0;
        for (const guestState of humanManagerDebug.guestBehavior.byGuest) {
          if (guestState?.mode === "flee") {
            fleeingNow += 1;
          } else if (guestState?.mode === "shelter") {
            shelteringNow += 1;
          } else {
            wanderingNow += 1;
          }
          if (guestState?.objectiveState === "shelter") {
            shelterIntentNow += 1;
          } else if (guestState?.objectiveState === "danger") {
            dangerIntentNow += 1;
          }
          if (Number(guestState?.replanCooldownSeconds) > 0) {
            replanningCooldownNow += 1;
          }
          if (guestState?.objectivePathStatus === "valid") {
            validPathNow += 1;
          } else if (guestState?.objectivePathStatus === "retrying") {
            retryingNow += 1;
            if (guestState?.objectiveState === "danger") {
              dangerRetryingNow += 1;
            }
          }
        }
        lines.push(
          `Guest live states: flee ${toInt(fleeingNow)} | shelter ${toInt(
            shelteringNow
          )} | wander ${toInt(wanderingNow)} | replan cooldown ${toInt(
            replanningCooldownNow
          )}`
        );
        lines.push(
          `Guest live intent: shelter ${toInt(
            shelterIntentNow
          )} | danger ${toInt(dangerIntentNow)} | path valid ${toInt(
            validPathNow
          )} | path retrying ${toInt(retryingNow)}`
        );
        lines.push(
          `Guest danger objective: active ${toInt(
            dangerIntentNow
          )} | retrying ${toInt(dangerRetryingNow)}`
        );
      }

      const guestMentalModel = humanManagerDebug.guestMentalModel || null;
      const guestMentalCycle = guestMentalModel?.lastCycle || null;
      if (guestMentalModel?.enabled) {
        if (guestMentalCycle?.enabled) {
          lines.push(
            `Guest mental: dominant changes ${toInt(
              guestMentalCycle.dominantChangedCount
            )} | evaluated ${toInt(guestMentalCycle.evaluatedGuestCount)}/${toInt(
              guestMentalCycle.guestCount
            )} @ ${formatNumber(guestMentalCycle.evaluationCadenceHz, 2)}Hz`
          );
          lines.push(
            `Guest context: room ${toInt(
              guestMentalCycle.inRoomGuestCount
            )} | corridor ${toInt(
              guestMentalCycle.inCorridorGuestCount
            )} | doorway-as-room ${toInt(
              guestMentalCycle.doorwayAsRoomGuestCount
            )} | other ${toInt(guestMentalCycle.unknownAreaGuestCount)}`
          );
          lines.push(
            `Guest arbitration: hold_locked ${toInt(
              guestMentalCycle.holdLockedCount
            )} | preempted ${toInt(
              guestMentalCycle.preemptedCount
            )} | fallback ${toInt(guestMentalCycle.fallbackAppliedCount)} | retrying ${toInt(
              guestMentalCycle.fallbackRetryingCount
            )}`
          );
        }
        const dominantCounts = guestMentalCycle?.dominantStateCounts || null;
        if (dominantCounts) {
          lines.push(
            `Guest dominant states: shelter ${toInt(
              dominantCounts.shelter
            )} | wander ${toInt(dominantCounts.wander)} | danger ${toInt(
              dominantCounts.danger
            )} | thirst ${toInt(dominantCounts.thirst)} | hunger ${toInt(
              dominantCounts.hunger
            )}`
          );
        }
        const objectiveCounts = guestMentalCycle?.objectiveStateCounts || null;
        if (objectiveCounts) {
          lines.push(
            `Guest objectives: shelter ${toInt(
              objectiveCounts.shelter
            )} | wander ${toInt(objectiveCounts.wander)} | danger ${toInt(
              objectiveCounts.danger
            )} | none ${toInt(objectiveCounts.none)}`
          );
        }

        const sampleGuest = Array.isArray(guestMentalModel.byGuest)
          ? guestMentalModel.byGuest.find((entry) => entry?.lastEvaluation) || null
          : null;
        const sampleScores = sampleGuest?.lastEvaluation?.scoresByState || null;
        const sampleInput = sampleGuest?.inputDebug || null;
        const sampleEval = sampleGuest?.lastEvaluation || null;
        if (sampleGuest && sampleScores) {
          lines.push(
            `Guest brain sample (${sampleGuest.id}): shelter ${formatNumber(
              sampleScores.shelter,
              2
            )} | wander ${formatNumber(sampleScores.wander, 2)} | danger ${formatNumber(
              sampleScores.danger,
              2
            )}`
          );
        }
        if (sampleGuest && sampleInput) {
          lines.push(
            `Guest input sample (${sampleGuest.id}): hp ${formatNumber(
              sampleInput.hpNormalized,
              2
            )} | in_room ${sampleInput.inRoom ? 1 : 0} | in_corridor ${
              sampleInput.inCorridor ? 1 : 0
            } | doorway_room ${sampleInput.doorwayTreatedAsRoom ? 1 : 0}`
          );
        }
        if (sampleGuest && sampleEval) {
          lines.push(
            `Guest arbitration sample (${sampleGuest.id}): objective ${
              sampleEval.objectiveState || "none"
            } | reason ${sampleEval.arbitrationReasonCode || "n/a"} | hold ${formatNumber(
              sampleEval.objectiveHoldSeconds,
              2
            )}/${formatNumber(sampleEval.minimumHoldSeconds, 2)}`
          );
          lines.push(
            `Guest preemption sample (${sampleGuest.id}): gate ${
              sampleEval.preemptionGate?.allowed === true ? "open" : "closed"
            } | danger ${formatNumber(
              sampleEval.preemptionGate?.dangerScore,
              2
            )} | current ${formatNumber(
              sampleEval.preemptionGate?.currentScore,
              2
            )} | margin ${formatNumber(sampleEval.preemptionGate?.marginValue, 2)}`
          );
          lines.push(
            `Guest fallback sample (${sampleGuest.id}): active ${
              sampleEval.fallback?.active === true
            } | retry ${formatNumber(
              sampleEval.fallback?.retryRemainingSeconds,
              2
            )}s | count ${toInt(sampleEval.fallback?.retryCount)} | failure ${
              sampleEval.fallback?.lastFailureReason || "n/a"
            }`
          );
        }

        const dangerSample = Array.isArray(guestDangerMemory?.byGuest)
          ? guestDangerMemory.byGuest.find((entry) => entry?.source === "live") ||
            guestDangerMemory.byGuest.find((entry) => entry?.source === "remembered") ||
            guestDangerMemory.byGuest[0] ||
            null
          : null;
        if (dangerSample) {
          lines.push(
            `Guest danger sample (${dangerSample.id}): source ${dangerSample.source || "none"} | signal ${formatNumber(
              dangerSample.signalFinal,
              2
            )} | live ${formatNumber(dangerSample.signalLive, 2)} | remembered ${formatNumber(
              dangerSample.signalRemembered,
              2
            )}`
          );
          lines.push(
            `Guest danger memory sample (${dangerSample.id}): age ${formatNumber(
              dangerSample.memoryAgeSeconds,
              2
            )}s | expires ${formatNumber(
              dangerSample.expiresInSeconds,
              2
            )}s | expired ${dangerSample.expired === true}`
          );
        }
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
