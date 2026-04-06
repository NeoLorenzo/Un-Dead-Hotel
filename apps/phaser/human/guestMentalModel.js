export const GUEST_BRAIN_CONFIG_VERSION = 1;

export const GUEST_BRAIN_STATE_IDS = Object.freeze([
  "wander",
  "shelter",
  "danger",
  "thirst",
  "hunger",
]);

export const GUEST_BRAIN_INPUT_IDS = Object.freeze([
  "hp_normalized",
  "in_corridor",
  "in_room",
  "danger_distance_signal",
  "thirst_signal",
  "hunger_signal",
]);

export const GUEST_BRAIN_DISABLED_STATES_PHASE_2 = Object.freeze([
  "thirst",
  "hunger",
]);

export const GUEST_BRAIN_TIE_BREAK_ORDER = Object.freeze([
  "danger",
  "shelter",
  "wander",
  "thirst",
  "hunger",
]);

const CONFIG_KEYS = Object.freeze([
  "brainConfigVersion",
  "states",
  "inputs",
  "stateWeights",
  "stateBias",
  "stateClamp",
  "disabledStates",
  "tieBreakOrder",
  "minimumHoldSeconds",
  "dangerPreemption",
  "objectiveFailureFallback",
  "evaluationCadenceHz",
  "debugPanelRefreshHz",
]);

const DANGER_PREEMPTION_KEYS = Object.freeze([
  "scoreThreshold",
  "scoreMargin",
]);

const OBJECTIVE_FAILURE_FALLBACK_KEYS = Object.freeze([
  "dangerRetrySeconds",
  "shelterRetrySeconds",
]);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertNoUnexpectedKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} has unexpected key "${key}".`);
    }
  }
}

function validateOrderedList(list, expectedValues, label) {
  if (!Array.isArray(list)) {
    throw new Error(`${label} must be an array.`);
  }
  if (list.length !== expectedValues.length) {
    throw new Error(
      `${label} must contain exactly ${expectedValues.length} entries.`
    );
  }
  for (let i = 0; i < expectedValues.length; i += 1) {
    if (list[i] !== expectedValues[i]) {
      throw new Error(
        `${label} must match locked order: ${expectedValues.join(", ")}.`
      );
    }
  }
}

function validateDisabledStates(states, label) {
  if (!Array.isArray(states)) {
    throw new Error(`${label} must be an array.`);
  }
  if (states.length !== GUEST_BRAIN_DISABLED_STATES_PHASE_2.length) {
    throw new Error(
      `${label} must contain exactly: ${GUEST_BRAIN_DISABLED_STATES_PHASE_2.join(", ")}.`
    );
  }
  const disabled = new Set(states);
  if (disabled.size !== states.length) {
    throw new Error(`${label} must not contain duplicate entries.`);
  }
  for (const stateId of GUEST_BRAIN_DISABLED_STATES_PHASE_2) {
    if (!disabled.has(stateId)) {
      throw new Error(
        `${label} must contain "${stateId}" for Phase 2 disabled-state policy.`
      );
    }
  }
}

function buildDefaultStateWeights() {
  return {
    wander: {
      hp_normalized: 0.08,
      in_corridor: 0.24,
      in_room: -0.16,
      danger_distance_signal: 0.0,
      thirst_signal: 0.0,
      hunger_signal: 0.0,
    },
    shelter: {
      hp_normalized: 0.1,
      in_corridor: 0.32,
      in_room: -0.38,
      danger_distance_signal: 0.0,
      thirst_signal: 0.0,
      hunger_signal: 0.0,
    },
    danger: {
      hp_normalized: 0.12,
      in_corridor: 0.14,
      in_room: -0.12,
      danger_distance_signal: 0.9,
      thirst_signal: 0.0,
      hunger_signal: 0.0,
    },
    thirst: {
      hp_normalized: 0.0,
      in_corridor: 0.0,
      in_room: 0.0,
      danger_distance_signal: 0.0,
      thirst_signal: 0.85,
      hunger_signal: 0.0,
    },
    hunger: {
      hp_normalized: 0.0,
      in_corridor: 0.0,
      in_room: 0.0,
      danger_distance_signal: 0.0,
      thirst_signal: 0.0,
      hunger_signal: 0.85,
    },
  };
}

function buildDefaultStateBias() {
  return {
    wander: 0.22,
    shelter: 0.58,
    danger: 0.08,
    thirst: 0.0,
    hunger: 0.0,
  };
}

function buildDefaultStateClamp() {
  return {
    wander: { min: 0, max: 1 },
    shelter: { min: 0, max: 1 },
    danger: { min: 0, max: 1 },
    thirst: { min: 0, max: 1 },
    hunger: { min: 0, max: 1 },
  };
}

function cloneStateWeights(stateWeights) {
  const clone = {};
  for (const stateId of GUEST_BRAIN_STATE_IDS) {
    clone[stateId] = {};
    for (const inputId of GUEST_BRAIN_INPUT_IDS) {
      clone[stateId][inputId] = Number(stateWeights[stateId][inputId]);
    }
  }
  return clone;
}

function cloneStateBias(stateBias) {
  const clone = {};
  for (const stateId of GUEST_BRAIN_STATE_IDS) {
    clone[stateId] = Number(stateBias[stateId]);
  }
  return clone;
}

function cloneStateClamp(stateClamp) {
  const clone = {};
  for (const stateId of GUEST_BRAIN_STATE_IDS) {
    clone[stateId] = {
      min: Number(stateClamp[stateId].min),
      max: Number(stateClamp[stateId].max),
    };
  }
  return clone;
}

function validateStateWeights(stateWeights, label) {
  if (!isPlainObject(stateWeights)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(stateWeights, GUEST_BRAIN_STATE_IDS, label);
  for (const stateId of GUEST_BRAIN_STATE_IDS) {
    if (!hasOwn(stateWeights, stateId)) {
      throw new Error(`${label} is missing state "${stateId}".`);
    }
    const row = stateWeights[stateId];
    if (!isPlainObject(row)) {
      throw new Error(`${label}.${stateId} must be an object.`);
    }
    assertNoUnexpectedKeys(row, GUEST_BRAIN_INPUT_IDS, `${label}.${stateId}`);
    for (const inputId of GUEST_BRAIN_INPUT_IDS) {
      if (!hasOwn(row, inputId)) {
        throw new Error(`${label}.${stateId} is missing input "${inputId}".`);
      }
      assertFiniteNumber(row[inputId], `${label}.${stateId}.${inputId}`);
    }
  }
}

function validateStateBias(stateBias, label) {
  if (!isPlainObject(stateBias)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(stateBias, GUEST_BRAIN_STATE_IDS, label);
  for (const stateId of GUEST_BRAIN_STATE_IDS) {
    if (!hasOwn(stateBias, stateId)) {
      throw new Error(`${label} is missing "${stateId}".`);
    }
    assertFiniteNumber(stateBias[stateId], `${label}.${stateId}`);
  }
}

function validateStateClamp(stateClamp, label) {
  if (!isPlainObject(stateClamp)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(stateClamp, GUEST_BRAIN_STATE_IDS, label);
  for (const stateId of GUEST_BRAIN_STATE_IDS) {
    if (!hasOwn(stateClamp, stateId)) {
      throw new Error(`${label} is missing "${stateId}".`);
    }
    const clamp = stateClamp[stateId];
    if (!isPlainObject(clamp)) {
      throw new Error(`${label}.${stateId} must be an object.`);
    }
    assertNoUnexpectedKeys(clamp, ["min", "max"], `${label}.${stateId}`);
    assertFiniteNumber(clamp.min, `${label}.${stateId}.min`);
    assertFiniteNumber(clamp.max, `${label}.${stateId}.max`);
    if (clamp.min < 0 || clamp.max > 1) {
      throw new Error(`${label}.${stateId} clamp must remain within [0, 1].`);
    }
    if (clamp.min > clamp.max) {
      throw new Error(`${label}.${stateId}.min cannot exceed .max.`);
    }
  }
}

function applyOverrideMap(baseMap, overrideMap, allowedKeys, nestedAllowedKeys = null) {
  if (!isPlainObject(overrideMap)) {
    throw new Error("Override map must be an object.");
  }
  assertNoUnexpectedKeys(overrideMap, allowedKeys, "guestBrainConfig override map");
  for (const key of Object.keys(overrideMap)) {
    if (!nestedAllowedKeys) {
      baseMap[key] = overrideMap[key];
      continue;
    }
    const nested = overrideMap[key];
    if (!isPlainObject(nested)) {
      throw new Error(`Override for "${key}" must be an object.`);
    }
    assertNoUnexpectedKeys(
      nested,
      nestedAllowedKeys,
      `guestBrainConfig override map "${key}"`
    );
    for (const nestedKey of Object.keys(nested)) {
      baseMap[key][nestedKey] = nested[nestedKey];
    }
  }
}

export function createDefaultGuestMentalModelConfig() {
  return {
    brainConfigVersion: GUEST_BRAIN_CONFIG_VERSION,
    states: [...GUEST_BRAIN_STATE_IDS],
    inputs: [...GUEST_BRAIN_INPUT_IDS],
    stateWeights: buildDefaultStateWeights(),
    stateBias: buildDefaultStateBias(),
    stateClamp: buildDefaultStateClamp(),
    disabledStates: [...GUEST_BRAIN_DISABLED_STATES_PHASE_2],
    tieBreakOrder: [...GUEST_BRAIN_TIE_BREAK_ORDER],
    minimumHoldSeconds: 0.75,
    dangerPreemption: {
      scoreThreshold: 0.7,
      scoreMargin: 0.15,
    },
    objectiveFailureFallback: {
      dangerRetrySeconds: 0.25,
      shelterRetrySeconds: 0.75,
    },
    evaluationCadenceHz: 4,
    debugPanelRefreshHz: 10,
  };
}

export function validateGuestMentalModelConfig(
  config,
  { label = "guestMentalModelConfig" } = {}
) {
  if (!isPlainObject(config)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(config, CONFIG_KEYS, label);

  if (!Number.isInteger(config.brainConfigVersion)) {
    throw new Error(`${label}.brainConfigVersion must be an integer.`);
  }
  if (config.brainConfigVersion <= 0) {
    throw new Error(`${label}.brainConfigVersion must be >= 1.`);
  }

  validateOrderedList(config.states, GUEST_BRAIN_STATE_IDS, `${label}.states`);
  validateOrderedList(config.inputs, GUEST_BRAIN_INPUT_IDS, `${label}.inputs`);
  validateStateWeights(config.stateWeights, `${label}.stateWeights`);
  validateStateBias(config.stateBias, `${label}.stateBias`);
  validateStateClamp(config.stateClamp, `${label}.stateClamp`);
  validateDisabledStates(config.disabledStates, `${label}.disabledStates`);
  validateOrderedList(
    config.tieBreakOrder,
    GUEST_BRAIN_TIE_BREAK_ORDER,
    `${label}.tieBreakOrder`
  );

  assertFiniteNumber(config.minimumHoldSeconds, `${label}.minimumHoldSeconds`);
  if (config.minimumHoldSeconds < 0) {
    throw new Error(`${label}.minimumHoldSeconds must be >= 0.`);
  }

  if (!isPlainObject(config.dangerPreemption)) {
    throw new Error(`${label}.dangerPreemption must be an object.`);
  }
  assertNoUnexpectedKeys(
    config.dangerPreemption,
    DANGER_PREEMPTION_KEYS,
    `${label}.dangerPreemption`
  );
  assertFiniteNumber(
    config.dangerPreemption.scoreThreshold,
    `${label}.dangerPreemption.scoreThreshold`
  );
  assertFiniteNumber(
    config.dangerPreemption.scoreMargin,
    `${label}.dangerPreemption.scoreMargin`
  );
  if (
    config.dangerPreemption.scoreThreshold < 0 ||
    config.dangerPreemption.scoreThreshold > 1
  ) {
    throw new Error(
      `${label}.dangerPreemption.scoreThreshold must remain within [0, 1].`
    );
  }
  if (
    config.dangerPreemption.scoreMargin < 0 ||
    config.dangerPreemption.scoreMargin > 1
  ) {
    throw new Error(
      `${label}.dangerPreemption.scoreMargin must remain within [0, 1].`
    );
  }

  if (!isPlainObject(config.objectiveFailureFallback)) {
    throw new Error(`${label}.objectiveFailureFallback must be an object.`);
  }
  assertNoUnexpectedKeys(
    config.objectiveFailureFallback,
    OBJECTIVE_FAILURE_FALLBACK_KEYS,
    `${label}.objectiveFailureFallback`
  );
  assertFiniteNumber(
    config.objectiveFailureFallback.dangerRetrySeconds,
    `${label}.objectiveFailureFallback.dangerRetrySeconds`
  );
  assertFiniteNumber(
    config.objectiveFailureFallback.shelterRetrySeconds,
    `${label}.objectiveFailureFallback.shelterRetrySeconds`
  );
  if (config.objectiveFailureFallback.dangerRetrySeconds < 0) {
    throw new Error(
      `${label}.objectiveFailureFallback.dangerRetrySeconds must be >= 0.`
    );
  }
  if (config.objectiveFailureFallback.shelterRetrySeconds < 0) {
    throw new Error(
      `${label}.objectiveFailureFallback.shelterRetrySeconds must be >= 0.`
    );
  }

  assertFiniteNumber(config.evaluationCadenceHz, `${label}.evaluationCadenceHz`);
  if (config.evaluationCadenceHz <= 0) {
    throw new Error(`${label}.evaluationCadenceHz must be > 0.`);
  }
  assertFiniteNumber(config.debugPanelRefreshHz, `${label}.debugPanelRefreshHz`);
  if (config.debugPanelRefreshHz <= 0) {
    throw new Error(`${label}.debugPanelRefreshHz must be > 0.`);
  }

  return {
    brainConfigVersion: config.brainConfigVersion,
    states: [...config.states],
    inputs: [...config.inputs],
    stateWeights: cloneStateWeights(config.stateWeights),
    stateBias: cloneStateBias(config.stateBias),
    stateClamp: cloneStateClamp(config.stateClamp),
    disabledStates: [...config.disabledStates],
    tieBreakOrder: [...config.tieBreakOrder],
    minimumHoldSeconds: config.minimumHoldSeconds,
    dangerPreemption: {
      scoreThreshold: config.dangerPreemption.scoreThreshold,
      scoreMargin: config.dangerPreemption.scoreMargin,
    },
    objectiveFailureFallback: {
      dangerRetrySeconds: config.objectiveFailureFallback.dangerRetrySeconds,
      shelterRetrySeconds: config.objectiveFailureFallback.shelterRetrySeconds,
    },
    evaluationCadenceHz: config.evaluationCadenceHz,
    debugPanelRefreshHz: config.debugPanelRefreshHz,
  };
}

export function createGuestMentalModelConfig(overrides = null) {
  const config = createDefaultGuestMentalModelConfig();
  if (overrides == null) {
    return validateGuestMentalModelConfig(config);
  }
  if (!isPlainObject(overrides)) {
    throw new Error("guestMentalModelConfig overrides must be an object.");
  }
  assertNoUnexpectedKeys(overrides, CONFIG_KEYS, "guestMentalModelConfig overrides");

  if (hasOwn(overrides, "brainConfigVersion")) {
    config.brainConfigVersion = overrides.brainConfigVersion;
  }
  if (hasOwn(overrides, "states")) {
    config.states = [...overrides.states];
  }
  if (hasOwn(overrides, "inputs")) {
    config.inputs = [...overrides.inputs];
  }
  if (hasOwn(overrides, "stateWeights")) {
    applyOverrideMap(
      config.stateWeights,
      overrides.stateWeights,
      GUEST_BRAIN_STATE_IDS,
      GUEST_BRAIN_INPUT_IDS
    );
  }
  if (hasOwn(overrides, "stateBias")) {
    applyOverrideMap(config.stateBias, overrides.stateBias, GUEST_BRAIN_STATE_IDS);
  }
  if (hasOwn(overrides, "stateClamp")) {
    applyOverrideMap(config.stateClamp, overrides.stateClamp, GUEST_BRAIN_STATE_IDS, [
      "min",
      "max",
    ]);
  }
  if (hasOwn(overrides, "disabledStates")) {
    config.disabledStates = [...overrides.disabledStates];
  }
  if (hasOwn(overrides, "tieBreakOrder")) {
    config.tieBreakOrder = [...overrides.tieBreakOrder];
  }
  if (hasOwn(overrides, "minimumHoldSeconds")) {
    config.minimumHoldSeconds = overrides.minimumHoldSeconds;
  }
  if (hasOwn(overrides, "dangerPreemption")) {
    if (!isPlainObject(overrides.dangerPreemption)) {
      throw new Error("guestMentalModelConfig overrides.dangerPreemption must be an object.");
    }
    assertNoUnexpectedKeys(
      overrides.dangerPreemption,
      DANGER_PREEMPTION_KEYS,
      "guestMentalModelConfig overrides.dangerPreemption"
    );
    config.dangerPreemption = {
      ...config.dangerPreemption,
      ...overrides.dangerPreemption,
    };
  }
  if (hasOwn(overrides, "objectiveFailureFallback")) {
    if (!isPlainObject(overrides.objectiveFailureFallback)) {
      throw new Error(
        "guestMentalModelConfig overrides.objectiveFailureFallback must be an object."
      );
    }
    assertNoUnexpectedKeys(
      overrides.objectiveFailureFallback,
      OBJECTIVE_FAILURE_FALLBACK_KEYS,
      "guestMentalModelConfig overrides.objectiveFailureFallback"
    );
    config.objectiveFailureFallback = {
      ...config.objectiveFailureFallback,
      ...overrides.objectiveFailureFallback,
    };
  }
  if (hasOwn(overrides, "evaluationCadenceHz")) {
    config.evaluationCadenceHz = overrides.evaluationCadenceHz;
  }
  if (hasOwn(overrides, "debugPanelRefreshHz")) {
    config.debugPanelRefreshHz = overrides.debugPanelRefreshHz;
  }

  return validateGuestMentalModelConfig(config);
}

const SCORE_TIE_EPSILON = 0.0000001;
const OBJECTIVE_DANGER = "danger";
const OBJECTIVE_SHELTER = "shelter";
const OBJECTIVE_WANDER = "wander";
const PATH_FEEDBACK_NONE = "none";
const PATH_FEEDBACK_SUCCESS = "success";
const PATH_FEEDBACK_FAILURE = "failure";
const DANGER_PRIORITY_SIGNAL_THRESHOLD = 0.05;
const SHELTER_SATISFIED_IN_ROOM_THRESHOLD = 0.5;
const SHELTER_SATISFIED_MAX_DANGER_SIGNAL = 0.05;

function clampValue(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function normalizeInputValue(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clampValue(Number(value), 0, 1);
}

function ensureRuntimeConfig(config, label) {
  if (!isPlainObject(config)) {
    throw new Error(`${label} must be an object.`);
  }
  if (!Array.isArray(config.states) || !Array.isArray(config.inputs)) {
    throw new Error(`${label} must include states and inputs arrays.`);
  }
  if (!isPlainObject(config.stateWeights) || !isPlainObject(config.stateBias)) {
    throw new Error(`${label} must include stateWeights and stateBias objects.`);
  }
  if (!isPlainObject(config.stateClamp)) {
    throw new Error(`${label} must include stateClamp.`);
  }
  if (!Array.isArray(config.disabledStates) || !Array.isArray(config.tieBreakOrder)) {
    throw new Error(`${label} must include disabledStates and tieBreakOrder arrays.`);
  }
}

function buildZeroScoreMap(config) {
  const scores = {};
  for (const stateId of config.states) {
    scores[stateId] = 0;
  }
  return scores;
}

function resolveEnabledStateIds(config) {
  const disabled = new Set(config.disabledStates);
  const enabled = [];
  for (const stateId of config.states) {
    if (!disabled.has(stateId)) {
      enabled.push(stateId);
    }
  }
  return enabled;
}

function cloneInputValues(inputValues, inputIds) {
  const cloned = {};
  for (const inputId of inputIds) {
    cloned[inputId] = normalizeInputValue(inputValues?.[inputId]);
  }
  return cloned;
}

function sanitizePathFeedback(pathFeedback) {
  const status =
    pathFeedback?.status === PATH_FEEDBACK_SUCCESS ||
    pathFeedback?.status === PATH_FEEDBACK_FAILURE
      ? pathFeedback.status
      : PATH_FEEDBACK_NONE;
  const reason =
    typeof pathFeedback?.reason === "string" && pathFeedback.reason.length > 0
      ? pathFeedback.reason
      : null;
  return {
    status,
    reason,
  };
}

function scoreForState(scoresByState, stateId) {
  const score = Number(scoresByState?.[stateId]);
  return Number.isFinite(score) ? score : 0;
}

function isShelterObjectiveSatisfied(inputValues) {
  const inRoom = Number(inputValues?.in_room) || 0;
  const dangerSignal = Number(inputValues?.danger_distance_signal) || 0;
  return (
    inRoom >= SHELTER_SATISFIED_IN_ROOM_THRESHOLD &&
    dangerSignal <= SHELTER_SATISFIED_MAX_DANGER_SIGNAL
  );
}

function hasDangerPrioritySignal(inputValues) {
  const dangerSignal = Number(inputValues?.danger_distance_signal) || 0;
  return dangerSignal >= DANGER_PRIORITY_SIGNAL_THRESHOLD;
}

function applyFallbackFromPathFailure({
  selectedObjective,
  pathFeedback,
  runtimeState,
  config,
}) {
  const fallback = {
    applied: false,
    fallbackObjectiveState: null,
    pendingRetryObjectiveState: runtimeState.pendingRetryObjectiveState ?? null,
    retryRemainingSeconds: Math.max(
      0,
      Number(runtimeState.retryRemainingSeconds) || 0
    ),
    retryCount: Math.max(0, Number(runtimeState.retryCount) || 0),
    lastFailureReason: runtimeState.lastObjectiveFailureReason ?? null,
    retryDelaySeconds: null,
  };
  if (pathFeedback.status !== PATH_FEEDBACK_FAILURE) {
    return {
      selectedObjective,
      fallback,
    };
  }

  if (
    selectedObjective !== OBJECTIVE_DANGER &&
    selectedObjective !== OBJECTIVE_SHELTER
  ) {
    return {
      selectedObjective,
      fallback,
    };
  }

  const retryDelaySeconds =
    selectedObjective === OBJECTIVE_DANGER
      ? Math.max(0, Number(config.objectiveFailureFallback?.dangerRetrySeconds) || 0)
      : Math.max(0, Number(config.objectiveFailureFallback?.shelterRetrySeconds) || 0);

  fallback.applied = true;
  fallback.fallbackObjectiveState = OBJECTIVE_WANDER;
  fallback.pendingRetryObjectiveState = selectedObjective;
  fallback.retryRemainingSeconds = retryDelaySeconds;
  fallback.retryCount += 1;
  fallback.lastFailureReason = pathFeedback.reason || "path_failure";
  fallback.retryDelaySeconds = retryDelaySeconds;

  return {
    selectedObjective: OBJECTIVE_WANDER,
    fallback,
  };
}

function buildPreemptionGate({
  candidateObjective,
  currentObjective,
  scoresByState,
  config,
}) {
  const threshold = Number(config.dangerPreemption?.scoreThreshold) || 0;
  const margin = Number(config.dangerPreemption?.scoreMargin) || 0;
  const dangerScore = scoreForState(scoresByState, OBJECTIVE_DANGER);
  const currentScore = scoreForState(scoresByState, currentObjective);
  const candidateIsDanger = candidateObjective === OBJECTIVE_DANGER;
  const thresholdMet = dangerScore >= threshold;
  const marginValue = dangerScore - currentScore;
  const marginMet = marginValue >= margin;
  return {
    candidateIsDanger,
    threshold,
    margin,
    dangerScore,
    currentScore,
    marginValue,
    thresholdMet,
    marginMet,
    allowed: candidateIsDanger && thresholdMet && marginMet,
  };
}

export function createGuestMentalInputVector(config, inputValues = null) {
  ensureRuntimeConfig(config, "createGuestMentalInputVector config");
  return cloneInputValues(inputValues, config.inputs);
}

export function createGuestMentalRuntimeState(config, options = {}) {
  ensureRuntimeConfig(config, "createGuestMentalRuntimeState config");
  const initialInputs = cloneInputValues(options?.initialInputValues || null, config.inputs);
  const zeroScores = buildZeroScoreMap(config);
  return {
    lastInputValues: initialInputs,
    lastRawScoresByState: { ...zeroScores },
    lastScoresByState: { ...zeroScores },
    enabledStateIds: resolveEnabledStateIds(config),
    disabledStateIds: [...config.disabledStates],
    lastDominantState: null,
    dominantStateHoldSeconds: 0,
    lastObjectiveState: null,
    objectiveHoldSeconds: 0,
    lastArbitrationReasonCode: null,
    lastPreemptionGate: null,
    retryRemainingSeconds: 0,
    retryDelaySeconds: 0,
    pendingRetryObjectiveState: null,
    retryCount: 0,
    lastObjectiveFailureReason: null,
    lastPathFeedback: sanitizePathFeedback(null),
    evaluationCount: 0,
    lastEvaluationResult: null,
  };
}

export function resetGuestMentalRuntimeState(runtimeState, config, options = {}) {
  ensureRuntimeConfig(config, "resetGuestMentalRuntimeState config");
  if (!isPlainObject(runtimeState)) {
    throw new Error("resetGuestMentalRuntimeState runtimeState must be an object.");
  }
  const initialInputs = cloneInputValues(options?.initialInputValues || null, config.inputs);
  const zeroScores = buildZeroScoreMap(config);
  runtimeState.lastInputValues = initialInputs;
  runtimeState.lastRawScoresByState = { ...zeroScores };
  runtimeState.lastScoresByState = { ...zeroScores };
  runtimeState.enabledStateIds = resolveEnabledStateIds(config);
  runtimeState.disabledStateIds = [...config.disabledStates];
  runtimeState.lastDominantState = null;
  runtimeState.dominantStateHoldSeconds = 0;
  runtimeState.lastObjectiveState = null;
  runtimeState.objectiveHoldSeconds = 0;
  runtimeState.lastArbitrationReasonCode = null;
  runtimeState.lastPreemptionGate = null;
  runtimeState.retryRemainingSeconds = 0;
  runtimeState.retryDelaySeconds = 0;
  runtimeState.pendingRetryObjectiveState = null;
  runtimeState.retryCount = 0;
  runtimeState.lastObjectiveFailureReason = null;
  runtimeState.lastPathFeedback = sanitizePathFeedback(null);
  runtimeState.lastEvaluationResult = null;
  if (options?.preserveEvaluationCount !== true) {
    runtimeState.evaluationCount = 0;
  }
  return runtimeState;
}

function selectDominantState(scoresByState, config) {
  const disabled = new Set(config.disabledStates);
  let dominantState = null;
  let dominantScore = -Infinity;

  for (const stateId of config.tieBreakOrder) {
    if (disabled.has(stateId)) {
      continue;
    }
    const score = Number(scoresByState[stateId]);
    if (!Number.isFinite(score)) {
      continue;
    }
    if (score > dominantScore + SCORE_TIE_EPSILON) {
      dominantState = stateId;
      dominantScore = score;
    }
  }

  return {
    dominantState,
    dominantScore: Number.isFinite(dominantScore) ? dominantScore : null,
  };
}

function buildDominantContributionTerms(config, dominantState, inputValues) {
  if (!dominantState || !isPlainObject(config?.stateWeights)) {
    return [];
  }
  const weights = config.stateWeights[dominantState];
  if (!isPlainObject(weights)) {
    return [];
  }

  const terms = [];
  terms.push({
    termType: "bias",
    inputId: null,
    weight: null,
    inputValue: null,
    contribution: Number(config.stateBias?.[dominantState]) || 0,
    absContribution: Math.abs(Number(config.stateBias?.[dominantState]) || 0),
    order: -1,
  });
  for (let i = 0; i < config.inputs.length; i += 1) {
    const inputId = config.inputs[i];
    const weight = Number(weights[inputId]) || 0;
    const inputValue = Number(inputValues?.[inputId]) || 0;
    const contribution = weight * inputValue;
    terms.push({
      termType: "input",
      inputId,
      weight,
      inputValue,
      contribution,
      absContribution: Math.abs(contribution),
      order: i,
    });
  }
  terms.sort((a, b) => {
    if (Math.abs(b.absContribution - a.absContribution) > SCORE_TIE_EPSILON) {
      return b.absContribution - a.absContribution;
    }
    return a.order - b.order;
  });
  return terms.map((term) => ({
    termType: term.termType,
    inputId: term.inputId,
    weight: term.weight,
    inputValue: term.inputValue,
    contribution: term.contribution,
    absContribution: term.absContribution,
  }));
}

export function evaluateGuestMentalModel({
  config,
  runtimeState,
  inputValues = null,
  dtSeconds = 0,
  pathFeedback = null,
} = {}) {
  ensureRuntimeConfig(config, "evaluateGuestMentalModel config");
  if (!isPlainObject(runtimeState)) {
    throw new Error("evaluateGuestMentalModel runtimeState must be an object.");
  }

  const dt = Math.max(0, Number(dtSeconds) || 0);
  const normalizedPathFeedback = sanitizePathFeedback(pathFeedback);
  const normalizedInputs = cloneInputValues(inputValues, config.inputs);
  const rawScoresByState = {};
  const scoresByState = {};

  for (const stateId of config.states) {
    const weights = config.stateWeights[stateId];
    let rawScore = Number(config.stateBias[stateId]) || 0;
    for (const inputId of config.inputs) {
      rawScore += (Number(weights[inputId]) || 0) * normalizedInputs[inputId];
    }
    const clampRange = config.stateClamp[stateId];
    rawScoresByState[stateId] = rawScore;
    scoresByState[stateId] = clampValue(
      rawScore,
      Number(clampRange.min) || 0,
      Number(clampRange.max) || 1
    );
  }

  const winner = selectDominantState(scoresByState, config);
  const dominantContributionTerms = buildDominantContributionTerms(
    config,
    winner.dominantState,
    normalizedInputs
  );
  const dominantTopContributions = dominantContributionTerms.slice(0, 3);
  const previousDominantState = runtimeState.lastDominantState ?? null;
  const dominantStateChanged = previousDominantState !== winner.dominantState;
  const nextHoldSeconds = dominantStateChanged
    ? 0
    : Math.max(0, Number(runtimeState.dominantStateHoldSeconds) || 0) + dt;
  const minimumHoldSeconds = Math.max(0, Number(config.minimumHoldSeconds) || 0);
  const previousObjectiveState = runtimeState.lastObjectiveState ?? null;
  const previousObjectiveHoldSeconds = Math.max(
    0,
    Number(runtimeState.objectiveHoldSeconds) || 0
  );
  let nextRetryRemainingSeconds = Math.max(
    0,
    Number(runtimeState.retryRemainingSeconds) || 0
  );
  let nextRetryDelaySeconds = Math.max(
    0,
    Number(runtimeState.retryDelaySeconds) || 0
  );
  if (nextRetryRemainingSeconds > 0) {
    nextRetryRemainingSeconds = Math.max(0, nextRetryRemainingSeconds - dt);
  }
  let pendingRetryObjectiveState = runtimeState.pendingRetryObjectiveState ?? null;
  let nextRetryCount = Math.max(0, Number(runtimeState.retryCount) || 0);
  let nextObjectiveState = previousObjectiveState;
  let arbitrationReasonCode = "threshold_crossed";
  let holdLocked = false;
  let forcedObjectiveState = null;
  let fallbackActive = false;
  const shelterObjectiveSatisfied = isShelterObjectiveSatisfied(normalizedInputs);
  let shelterSatisfiedOverrideApplied = false;
  const dangerPrioritySignalActive = hasDangerPrioritySignal(normalizedInputs);
  let dangerPriorityOverrideApplied = false;

  if (nextRetryRemainingSeconds > 0) {
    fallbackActive = true;
    forcedObjectiveState = OBJECTIVE_WANDER;
    arbitrationReasonCode = "fallback_retrying";
  } else if (pendingRetryObjectiveState) {
    forcedObjectiveState = pendingRetryObjectiveState;
    pendingRetryObjectiveState = null;
    arbitrationReasonCode = "fallback_retry_due";
  }
  // Brain objective authority now uses scored arbitration as final decision.
  // Keep danger-priority signal in debug telemetry, but do not hard-force
  // objective danger when score winner is a different state.
  if (!forcedObjectiveState && dangerPrioritySignalActive) {
    dangerPriorityOverrideApplied = false;
  }
  if (
    !forcedObjectiveState &&
    shelterObjectiveSatisfied &&
    winner.dominantState === OBJECTIVE_SHELTER
  ) {
    forcedObjectiveState = OBJECTIVE_WANDER;
    arbitrationReasonCode = "shelter_satisfied";
    shelterSatisfiedOverrideApplied = true;
  }

  const candidateObjective = forcedObjectiveState || winner.dominantState;
  if (previousObjectiveState == null) {
    nextObjectiveState = candidateObjective;
    arbitrationReasonCode = forcedObjectiveState ? arbitrationReasonCode : "initial";
  } else if (candidateObjective === previousObjectiveState) {
    nextObjectiveState = previousObjectiveState;
    if (!forcedObjectiveState) {
      arbitrationReasonCode = "retain_same_state";
    }
  } else if (forcedObjectiveState) {
    nextObjectiveState = forcedObjectiveState;
  } else {
    const preemptionGate = buildPreemptionGate({
      candidateObjective,
      currentObjective: previousObjectiveState,
      scoresByState,
      config,
    });
    const holdActive =
      previousObjectiveState !== OBJECTIVE_DANGER &&
      previousObjectiveHoldSeconds < minimumHoldSeconds;

    if (holdActive && !preemptionGate.allowed) {
      holdLocked = true;
      nextObjectiveState = previousObjectiveState;
      arbitrationReasonCode = "hold_locked";
    } else if (holdActive && preemptionGate.allowed) {
      nextObjectiveState = candidateObjective;
      arbitrationReasonCode = "preempted";
    } else {
      nextObjectiveState = candidateObjective;
      arbitrationReasonCode =
        previousObjectiveState !== OBJECTIVE_DANGER
          ? "hold_expired"
          : "threshold_crossed";
    }
  }

  const postSelectionFallback = applyFallbackFromPathFailure({
    selectedObjective: nextObjectiveState,
    pathFeedback: normalizedPathFeedback,
    runtimeState: {
      retryRemainingSeconds: nextRetryRemainingSeconds,
      retryDelaySeconds: nextRetryDelaySeconds,
      pendingRetryObjectiveState,
      retryCount: nextRetryCount,
      lastObjectiveFailureReason: runtimeState.lastObjectiveFailureReason,
    },
    config,
  });
  nextObjectiveState = postSelectionFallback.selectedObjective;
  if (postSelectionFallback.fallback.applied) {
    arbitrationReasonCode = "fallback";
    nextRetryRemainingSeconds =
      postSelectionFallback.fallback.retryRemainingSeconds;
    nextRetryDelaySeconds =
      postSelectionFallback.fallback.retryDelaySeconds ||
      nextRetryDelaySeconds;
    pendingRetryObjectiveState =
      postSelectionFallback.fallback.pendingRetryObjectiveState;
    nextRetryCount = postSelectionFallback.fallback.retryCount;
  }

  const objectiveChanged = previousObjectiveState !== nextObjectiveState;
  const objectiveHoldSeconds = objectiveChanged
    ? 0
    : previousObjectiveHoldSeconds + dt;
  const objectiveTransitionReasonCode = objectiveChanged
    ? arbitrationReasonCode
    : "none";
  const preemptionGate = buildPreemptionGate({
    candidateObjective,
    currentObjective: previousObjectiveState ?? nextObjectiveState,
    scoresByState,
    config,
  });
  const retryDelaySeconds =
    nextRetryDelaySeconds > 0 ? nextRetryDelaySeconds : null;
  const fallbackObjectiveState =
    nextRetryRemainingSeconds > 0 ? OBJECTIVE_WANDER : null;
  const lastObjectiveFailureReason = postSelectionFallback.fallback.applied
    ? postSelectionFallback.fallback.lastFailureReason
    : runtimeState.lastObjectiveFailureReason ?? null;

  runtimeState.lastInputValues = normalizedInputs;
  runtimeState.lastRawScoresByState = rawScoresByState;
  runtimeState.lastScoresByState = scoresByState;
  runtimeState.enabledStateIds = resolveEnabledStateIds(config);
  runtimeState.disabledStateIds = [...config.disabledStates];
  runtimeState.lastDominantState = winner.dominantState;
  runtimeState.dominantStateHoldSeconds = nextHoldSeconds;
  runtimeState.lastObjectiveState = nextObjectiveState;
  runtimeState.objectiveHoldSeconds = objectiveHoldSeconds;
  runtimeState.lastArbitrationReasonCode = arbitrationReasonCode;
  runtimeState.lastPreemptionGate = { ...preemptionGate };
  runtimeState.retryRemainingSeconds = nextRetryRemainingSeconds;
  runtimeState.retryDelaySeconds = nextRetryDelaySeconds;
  runtimeState.pendingRetryObjectiveState = pendingRetryObjectiveState;
  runtimeState.retryCount = nextRetryCount;
  runtimeState.lastObjectiveFailureReason = lastObjectiveFailureReason;
  runtimeState.lastPathFeedback = normalizedPathFeedback;
  runtimeState.evaluationCount =
    Math.max(0, Math.floor(Number(runtimeState.evaluationCount) || 0)) + 1;

  const evaluation = {
    inputValues: { ...normalizedInputs },
    rawScoresByState: { ...rawScoresByState },
    scoresByState: { ...scoresByState },
    enabledStateIds: [...runtimeState.enabledStateIds],
    disabledStateIds: [...runtimeState.disabledStateIds],
    dominantState: winner.dominantState,
    dominantScore: winner.dominantScore,
    previousDominantState,
    dominantStateChanged,
    dominantStateHoldSeconds: nextHoldSeconds,
    objectiveState: nextObjectiveState,
    previousObjectiveState,
    objectiveChanged,
    objectiveTransitionReasonCode,
    objectiveHoldSeconds,
    arbitrationReasonCode,
    holdLocked,
    minimumHoldSeconds,
    preemptionGate: { ...preemptionGate },
    fallback: {
      active: nextRetryRemainingSeconds > 0,
      applied: postSelectionFallback.fallback.applied,
      fallbackObjectiveState,
      pendingRetryObjectiveState,
      retryRemainingSeconds: nextRetryRemainingSeconds,
      retryCount: nextRetryCount,
      retryDelaySeconds,
      lastFailureReason: lastObjectiveFailureReason,
    },
    objectiveCompletion: {
      shelterSatisfied: shelterObjectiveSatisfied,
      shelterSatisfiedOverrideApplied,
    },
    objectivePriority: {
      dangerPrioritySignalActive,
      dangerPriorityOverrideApplied,
    },
    pathFeedback: {
      ...normalizedPathFeedback,
    },
    dominantContributionTerms,
    dominantTopContributions,
    evaluationCount: runtimeState.evaluationCount,
  };
  runtimeState.lastEvaluationResult = evaluation;
  return evaluation;
}
