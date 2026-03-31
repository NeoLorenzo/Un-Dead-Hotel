const DEFAULT_DANGER_MEMORY_EXPIRY_SECONDS = 20.0;
const DEFAULT_DANGER_REMEMBERED_SIGNAL_MULTIPLIER = 0.6;
const DEFAULT_DANGER_LIVE_DISTANCE_MIN_TILES = 1.5;
const DEFAULT_DANGER_LIVE_DISTANCE_MAX_TILES = 8.0;
const SIGNAL_EPSILON = 0.000001;

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(value)));
}

function normalizeNowMs(nowMs) {
  if (Number.isFinite(nowMs)) {
    return Number(nowMs);
  }
  return performance.now();
}

function normalizeWorldPoint(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return {
    x,
    y,
  };
}

function resolveDangerMemoryConfig(config = null) {
  const expirySeconds = Math.max(
    0.01,
    Number(config?.dangerMemoryExpirySeconds) || DEFAULT_DANGER_MEMORY_EXPIRY_SECONDS
  );
  const rememberedSignalMultiplier = clamp01(
    Number(config?.dangerRememberedSignalMultiplier) ||
      DEFAULT_DANGER_REMEMBERED_SIGNAL_MULTIPLIER
  );
  const liveDistanceMinTiles = Math.max(
    0,
    Number(config?.dangerLiveDistanceMinTiles) ||
      DEFAULT_DANGER_LIVE_DISTANCE_MIN_TILES
  );
  const liveDistanceMaxTiles = Math.max(
    liveDistanceMinTiles + 0.01,
    Number(config?.dangerLiveDistanceMaxTiles) ||
      DEFAULT_DANGER_LIVE_DISTANCE_MAX_TILES
  );
  return {
    dangerMemoryExpirySeconds: expirySeconds,
    dangerRememberedSignalMultiplier: rememberedSignalMultiplier,
    dangerLiveDistanceMinTiles: liveDistanceMinTiles,
    dangerLiveDistanceMaxTiles: liveDistanceMaxTiles,
  };
}

function mapLiveDangerSignal(distanceTiles, resolvedConfig) {
  const distance = Number(distanceTiles);
  if (!Number.isFinite(distance)) {
    return 0;
  }
  const minTiles = resolvedConfig.dangerLiveDistanceMinTiles;
  const maxTiles = resolvedConfig.dangerLiveDistanceMaxTiles;
  const range = Math.max(SIGNAL_EPSILON, maxTiles - minTiles);
  return clamp01((maxTiles - distance) / range);
}

function hasRememberedThreat(state) {
  return (
    normalizeWorldPoint(state?.lastKnownThreatWorld) !== null &&
    Number.isFinite(state?.losBrokenAtMs)
  );
}

function clearRememberedThreat(state) {
  state.lastKnownThreatWorld = null;
  state.signalAtLosBreak = 0;
  state.losBrokenAtMs = null;
  state.lastLiveDistanceTiles = null;
}

function normalizeThreatFromPerception(perceptionState) {
  if (perceptionState?.detected !== true) {
    return null;
  }
  const world = normalizeWorldPoint(perceptionState?.targetWorld);
  if (!world) {
    return null;
  }
  return {
    id:
      typeof perceptionState?.targetId === "string" ||
      Number.isFinite(perceptionState?.targetId)
        ? perceptionState.targetId
        : null,
    world,
    distanceTiles: Number.isFinite(perceptionState?.distanceToTarget)
      ? Number(perceptionState.distanceToTarget)
      : null,
  };
}

export function createGuestDangerMemoryState() {
  return {
    hasLiveThreat: false,
    liveThreatId: null,
    liveThreatWorld: null,
    lastKnownThreatWorld: null,
    signalAtLosBreak: 0,
    lastSeenAtMs: null,
    losBrokenAtMs: null,
    lastLiveDistanceTiles: null,
  };
}

export function resetGuestDangerMemoryState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("resetGuestDangerMemoryState requires a state object.");
  }
  state.hasLiveThreat = false;
  state.liveThreatId = null;
  state.liveThreatWorld = null;
  state.lastKnownThreatWorld = null;
  state.signalAtLosBreak = 0;
  state.lastSeenAtMs = null;
  state.losBrokenAtMs = null;
  state.lastLiveDistanceTiles = null;
  return state;
}

export function updateGuestDangerMemoryFromPerception({
  state,
  perceptionState = null,
  nowMs = null,
  config = null,
} = {}) {
  if (!state || typeof state !== "object") {
    throw new Error("updateGuestDangerMemoryFromPerception requires a state object.");
  }
  const now = normalizeNowMs(nowMs);
  const resolvedConfig = resolveDangerMemoryConfig(config);
  const threat = normalizeThreatFromPerception(perceptionState);

  if (threat) {
    state.hasLiveThreat = true;
    state.liveThreatId = threat.id;
    state.liveThreatWorld = {
      x: threat.world.x,
      y: threat.world.y,
    };
    state.lastKnownThreatWorld = {
      x: threat.world.x,
      y: threat.world.y,
    };
    state.lastLiveDistanceTiles = Number.isFinite(threat.distanceTiles)
      ? Math.max(0, threat.distanceTiles)
      : state.lastLiveDistanceTiles;
    state.signalAtLosBreak = mapLiveDangerSignal(
      state.lastLiveDistanceTiles,
      resolvedConfig
    );
    state.lastSeenAtMs = now;
    state.losBrokenAtMs = null;
    return state;
  }

  if (state.hasLiveThreat) {
    state.hasLiveThreat = false;
    state.liveThreatId = null;
    state.liveThreatWorld = null;
    state.signalAtLosBreak = mapLiveDangerSignal(
      state.lastLiveDistanceTiles,
      resolvedConfig
    );
    state.losBrokenAtMs = now;
  }

  if (hasRememberedThreat(state)) {
    const ageSeconds = Math.max(
      0,
      (now - Number(state.losBrokenAtMs)) / 1000
    );
    if (ageSeconds >= resolvedConfig.dangerMemoryExpirySeconds) {
      clearRememberedThreat(state);
    }
  }
  return state;
}

export function computeGuestDangerSignal({
  state,
  guestWorld = null,
  nowMs = null,
  config = null,
} = {}) {
  if (!state || typeof state !== "object") {
    throw new Error("computeGuestDangerSignal requires a state object.");
  }
  const now = normalizeNowMs(nowMs);
  const resolvedConfig = resolveDangerMemoryConfig(config);
  const guestPoint = normalizeWorldPoint(guestWorld);
  const liveThreatPoint = normalizeWorldPoint(state.liveThreatWorld);
  const rememberedThreatPoint = normalizeWorldPoint(state.lastKnownThreatWorld);
  const signalAtLosBreak = clamp01(state.signalAtLosBreak);

  if (state.hasLiveThreat && liveThreatPoint) {
    const liveDistanceTiles = guestPoint
      ? Math.hypot(
          liveThreatPoint.x - guestPoint.x,
          liveThreatPoint.y - guestPoint.y
        )
      : Number.isFinite(state.lastLiveDistanceTiles)
        ? Math.max(0, Number(state.lastLiveDistanceTiles))
        : Infinity;
    const signalLive = mapLiveDangerSignal(liveDistanceTiles, resolvedConfig);
    return {
      source: "live",
      signalLive,
      signalRemembered: signalAtLosBreak * resolvedConfig.dangerRememberedSignalMultiplier,
      signalFinal: signalLive,
      memoryAgeSeconds: 0,
      expiresInSeconds: resolvedConfig.dangerMemoryExpirySeconds,
      expired: false,
      liveDistanceTiles: Number.isFinite(liveDistanceTiles) ? liveDistanceTiles : null,
    };
  }

  if (rememberedThreatPoint && Number.isFinite(state.losBrokenAtMs)) {
    const ageSeconds = Math.max(
      0,
      (now - Number(state.losBrokenAtMs)) / 1000
    );
    const expiresInSeconds = Math.max(
      0,
      resolvedConfig.dangerMemoryExpirySeconds - ageSeconds
    );
    const memoryDecay = clamp01(
      1 - ageSeconds / resolvedConfig.dangerMemoryExpirySeconds
    );
    const signalRemembered =
      signalAtLosBreak *
      memoryDecay *
      resolvedConfig.dangerRememberedSignalMultiplier;
    const expired = ageSeconds >= resolvedConfig.dangerMemoryExpirySeconds;
    return {
      source: expired ? "none" : "remembered",
      signalLive: 0,
      signalRemembered: expired ? 0 : signalRemembered,
      signalFinal: expired ? 0 : signalRemembered,
      memoryAgeSeconds: ageSeconds,
      expiresInSeconds,
      expired,
      liveDistanceTiles: null,
    };
  }

  return {
    source: "none",
    signalLive: 0,
    signalRemembered: 0,
    signalFinal: 0,
    memoryAgeSeconds: 0,
    expiresInSeconds: 0,
    expired: false,
    liveDistanceTiles: null,
  };
}

export function getGuestDangerMemoryDebugSnapshot(
  state,
  nowMs = null,
  config = null,
  guestWorld = null
) {
  if (!state || typeof state !== "object") {
    return null;
  }
  const signal = computeGuestDangerSignal({
    state,
    guestWorld,
    nowMs,
    config,
  });
  const liveThreatWorld = normalizeWorldPoint(state.liveThreatWorld);
  const lastKnownThreatWorld = normalizeWorldPoint(state.lastKnownThreatWorld);

  return {
    source: signal.source,
    hasLiveThreat: state.hasLiveThreat === true && liveThreatWorld != null,
    liveThreatId: state.liveThreatId ?? null,
    liveThreatWorld: liveThreatWorld
      ? { x: liveThreatWorld.x, y: liveThreatWorld.y }
      : null,
    lastKnownThreatWorld: lastKnownThreatWorld
      ? { x: lastKnownThreatWorld.x, y: lastKnownThreatWorld.y }
      : null,
    signalLive: signal.signalLive,
    signalRemembered: signal.signalRemembered,
    signalFinal: signal.signalFinal,
    memoryAgeSeconds: signal.memoryAgeSeconds,
    expiresInSeconds: signal.expiresInSeconds,
    expired: signal.expired === true,
  };
}
