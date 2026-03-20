export const DEFAULT_AGENT_MAX_HP = 100;

function toFiniteNumber(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Number(value);
}

function sanitizeMaxHp(value) {
  const numeric = toFiniteNumber(value, DEFAULT_AGENT_MAX_HP);
  return Math.max(1, numeric);
}

function clampHp(value, maxHp) {
  const numeric = toFiniteNumber(value, maxHp);
  return Math.min(maxHp, Math.max(0, numeric));
}

export function createHealthModel({
  maxHp = DEFAULT_AGENT_MAX_HP,
  currentHp = maxHp,
  onDeath = null,
  onRevive = null,
} = {}) {
  let internalMaxHp = sanitizeMaxHp(maxHp);
  let internalCurrentHp = clampHp(currentHp, internalMaxHp);
  let dead = internalCurrentHp <= 0;

  function getState() {
    return {
      currentHp: internalCurrentHp,
      maxHp: internalMaxHp,
      isDead: dead,
    };
  }

  function setCurrentHp(nextCurrentHp) {
    const clamped = clampHp(nextCurrentHp, internalMaxHp);
    const previousHp = internalCurrentHp;
    const wasDead = dead;
    internalCurrentHp = clamped;
    dead = internalCurrentHp <= 0;

    if (!wasDead && dead && typeof onDeath === "function") {
      onDeath(getState());
    } else if (wasDead && !dead && typeof onRevive === "function") {
      onRevive(getState());
    }

    return {
      changed: Math.abs(previousHp - internalCurrentHp) > 0.000001,
      becameDead: !wasDead && dead,
      revived: wasDead && !dead,
      currentHp: internalCurrentHp,
      maxHp: internalMaxHp,
      isDead: dead,
    };
  }

  function applyDamage(amount) {
    const numeric = toFiniteNumber(amount, 0);
    if (numeric <= 0) {
      return {
        changed: false,
        becameDead: false,
        currentHp: internalCurrentHp,
        maxHp: internalMaxHp,
        isDead: dead,
      };
    }
    return setCurrentHp(internalCurrentHp - numeric);
  }

  function heal(amount) {
    const numeric = toFiniteNumber(amount, 0);
    if (numeric <= 0) {
      return {
        changed: false,
        revived: false,
        currentHp: internalCurrentHp,
        maxHp: internalMaxHp,
        isDead: dead,
      };
    }
    return setCurrentHp(internalCurrentHp + numeric);
  }

  function setMaxHp(nextMaxHp, { preserveHealthRatio = false } = {}) {
    const previousMaxHp = internalMaxHp;
    const previousRatio = previousMaxHp > 0 ? internalCurrentHp / previousMaxHp : 1;
    internalMaxHp = sanitizeMaxHp(nextMaxHp);
    const nextCurrentHp = preserveHealthRatio
      ? internalMaxHp * previousRatio
      : internalCurrentHp;
    const hpResult = setCurrentHp(nextCurrentHp);

    return {
      changed:
        Math.abs(previousMaxHp - internalMaxHp) > 0.000001 || hpResult.changed,
      currentHp: hpResult.currentHp,
      maxHp: internalMaxHp,
      isDead: hpResult.isDead,
      becameDead: hpResult.becameDead,
      revived: hpResult.revived,
    };
  }

  return {
    getState,
    getCurrentHp: () => internalCurrentHp,
    getMaxHp: () => internalMaxHp,
    isDead: () => dead,
    setCurrentHp,
    setMaxHp,
    applyDamage,
    heal,
  };
}
