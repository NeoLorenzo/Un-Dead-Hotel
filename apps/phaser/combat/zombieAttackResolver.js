import { ZOMBIE_COLLIDER_RADIUS_TILES } from "../zombie/zombieController.js";

export const DEFAULT_ZOMBIE_ATTACK_DAMAGE = 20;
export const DEFAULT_ZOMBIE_ATTACK_COOLDOWN_SECONDS = 1.0;

function clampFinite(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Number(value);
}

function normalizeWorldPoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function isInTouchRange(worldA, radiusA, worldB, radiusB) {
  const dx = worldB.x - worldA.x;
  const dy = worldB.y - worldA.y;
  const distance = Math.hypot(dx, dy);
  return distance <= radiusA + radiusB;
}

export function createZombieAttackResolver({
  damagePerHit = DEFAULT_ZOMBIE_ATTACK_DAMAGE,
  cooldownSeconds = DEFAULT_ZOMBIE_ATTACK_COOLDOWN_SECONDS,
  zombieTouchRadiusTiles = ZOMBIE_COLLIDER_RADIUS_TILES,
} = {}) {
  const attackDamage = Math.max(0, clampFinite(damagePerHit, DEFAULT_ZOMBIE_ATTACK_DAMAGE));
  const attackCooldownSeconds = Math.max(
    0,
    clampFinite(cooldownSeconds, DEFAULT_ZOMBIE_ATTACK_COOLDOWN_SECONDS)
  );
  const zombieRadiusTiles = Math.max(
    0.01,
    clampFinite(zombieTouchRadiusTiles, ZOMBIE_COLLIDER_RADIUS_TILES)
  );

  function tickCooldown(attackState, dtSeconds) {
    if (!attackState) {
      return false;
    }
    const dt = Math.max(0, clampFinite(dtSeconds, 0));
    const previous = attackState.cooldownRemainingSeconds || 0;
    const next = Math.max(0, previous - dt);
    attackState.cooldownRemainingSeconds = next;
    return Math.abs(next - previous) > 0.000001;
  }

  function isOnCooldown(attackState) {
    if (!attackState) {
      return false;
    }
    return (attackState.cooldownRemainingSeconds || 0) > 0;
  }

  function attemptAttack({
    zombieWorld,
    targetWorld,
    targetTouchRadiusTiles,
    attackState,
    applyTargetDamage,
    targetId = null,
  } = {}) {
    if (!attackState) {
      return {
        attacked: false,
        reason: "missing_attack_state",
      };
    }
    if (isOnCooldown(attackState)) {
      return {
        attacked: false,
        reason: "cooldown",
      };
    }
    if (typeof applyTargetDamage !== "function") {
      return {
        attacked: false,
        reason: "invalid_target",
      };
    }

    const zombie = normalizeWorldPoint(zombieWorld);
    const target = normalizeWorldPoint(targetWorld);
    const targetRadius = Math.max(0.01, clampFinite(targetTouchRadiusTiles, 0.29));
    if (!isInTouchRange(zombie, zombieRadiusTiles, target, targetRadius)) {
      return {
        attacked: false,
        reason: "out_of_range",
      };
    }

    const damageResult = applyTargetDamage(attackDamage);
    attackState.cooldownRemainingSeconds = attackCooldownSeconds;
    attackState.lastAttackTargetId = targetId;
    attackState.lastAttackDamage = attackDamage;
    attackState.lastAttackApplied = true;
    return {
      attacked: true,
      damage: attackDamage,
      damageResult,
      cooldownRemainingSeconds: attackState.cooldownRemainingSeconds,
      cooldownDurationSeconds: attackCooldownSeconds,
    };
  }

  return {
    attackDamage,
    attackCooldownSeconds,
    zombieRadiusTiles,
    tickCooldown,
    isOnCooldown,
    attemptAttack,
  };
}
