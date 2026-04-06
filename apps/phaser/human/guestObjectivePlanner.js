const OBJECTIVE_WANDER = "wander";
const OBJECTIVE_SHELTER = "shelter";
const OBJECTIVE_DANGER = "danger";

const PATH_FEEDBACK_STATUS_NONE = "none";
const PATH_FEEDBACK_STATUS_SUCCESS = "success";
const PATH_FEEDBACK_STATUS_FAILURE = "failure";

const DISPATCH_MODE_WANDER = "wander";
const DISPATCH_MODE_SHELTER = "shelter";
const DISPATCH_MODE_DANGER_FLEE = "danger_flee";
const DISPATCH_MODE_DANGER_ROOM_EGRESS = "danger_room_egress";

const REASON_CODE_ROOM_DANGER_OVERRIDE = "room_danger_override";
const DANGER_ROOM_EGRESS_REASON = "danger_room_egress_nearest_door";
const DANGER_STRATEGY_ROOM_EGRESS = "danger_room_egress";
const DANGER_STRATEGY_FLEE = "danger_flee";
const DANGER_STRATEGY_NONE = "none";

export const GUEST_OBJECTIVE_STATES = Object.freeze([
  OBJECTIVE_WANDER,
  OBJECTIVE_SHELTER,
  OBJECTIVE_DANGER,
]);

export const GUEST_OBJECTIVE_DISPATCH_MODES = Object.freeze([
  DISPATCH_MODE_WANDER,
  DISPATCH_MODE_SHELTER,
  DISPATCH_MODE_DANGER_FLEE,
  DISPATCH_MODE_DANGER_ROOM_EGRESS,
]);

export const GUEST_OBJECTIVE_PATH_FEEDBACK_STATUSES = Object.freeze([
  PATH_FEEDBACK_STATUS_NONE,
  PATH_FEEDBACK_STATUS_SUCCESS,
  PATH_FEEDBACK_STATUS_FAILURE,
]);

export const GUEST_OBJECTIVE_REASON_CODES = Object.freeze({
  ROOM_DANGER_OVERRIDE: REASON_CODE_ROOM_DANGER_OVERRIDE,
});

export const GUEST_DANGER_DISPATCH_STRATEGIES = Object.freeze([
  DANGER_STRATEGY_NONE,
  DANGER_STRATEGY_ROOM_EGRESS,
  DANGER_STRATEGY_FLEE,
]);

const DEFAULT_OBJECTIVE_PLANNING_POLICY = Object.freeze({
  enforceBrainObjectiveAuthority: true,
  allowRoomDangerOverride: false,
});

function normalizeObjectiveState(objectiveState) {
  return objectiveState === OBJECTIVE_DANGER ||
    objectiveState === OBJECTIVE_SHELTER ||
    objectiveState === OBJECTIVE_WANDER
    ? objectiveState
    : OBJECTIVE_WANDER;
}

function normalizeDispatchMode({
  objectiveState,
  lastPlanReason = null,
} = {}) {
  if (objectiveState === OBJECTIVE_DANGER) {
    return lastPlanReason === DANGER_ROOM_EGRESS_REASON
      ? DISPATCH_MODE_DANGER_ROOM_EGRESS
      : DISPATCH_MODE_DANGER_FLEE;
  }
  if (objectiveState === OBJECTIVE_SHELTER) {
    return DISPATCH_MODE_SHELTER;
  }
  return DISPATCH_MODE_WANDER;
}

function normalizeReasonCode(reasonCode) {
  return typeof reasonCode === "string" && reasonCode.length > 0 ? reasonCode : null;
}

function normalizePathFeedbackStatus(status) {
  return status === PATH_FEEDBACK_STATUS_SUCCESS ||
    status === PATH_FEEDBACK_STATUS_FAILURE
    ? status
    : PATH_FEEDBACK_STATUS_NONE;
}

function normalizeOptionalObjectiveState(objectiveState) {
  if (objectiveState == null) {
    return null;
  }
  return normalizeObjectiveState(objectiveState);
}

function normalizeWorldPoint(world) {
  const x = Number(world?.x);
  const y = Number(world?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return {
    x,
    y,
  };
}

function normalizeDangerDispatchStrategy(strategy) {
  return strategy === DANGER_STRATEGY_ROOM_EGRESS ||
    strategy === DANGER_STRATEGY_FLEE ||
    strategy === DANGER_STRATEGY_NONE
    ? strategy
    : DANGER_STRATEGY_NONE;
}

export function createGuestObjectivePlanningPolicy(policy = null) {
  return {
    enforceBrainObjectiveAuthority:
      policy?.enforceBrainObjectiveAuthority !== false &&
      DEFAULT_OBJECTIVE_PLANNING_POLICY.enforceBrainObjectiveAuthority === true,
    allowRoomDangerOverride:
      policy?.allowRoomDangerOverride !== false &&
      DEFAULT_OBJECTIVE_PLANNING_POLICY.allowRoomDangerOverride === true,
  };
}

export function dispatchObjectivePlan({
  brainObjectiveState = OBJECTIVE_WANDER,
  hasDangerTarget = false,
  roomDangerOverrideActive = false,
  arbitrationReasonCode = null,
  lastPlanReason = null,
  policy = null,
} = {}) {
  const resolvedPolicy = createGuestObjectivePlanningPolicy(policy);
  const normalizedBrainObjectiveState = normalizeObjectiveState(brainObjectiveState);
  const effectiveBrainObjectiveState = resolvedPolicy.enforceBrainObjectiveAuthority
    ? normalizedBrainObjectiveState
    : OBJECTIVE_WANDER;
  const shouldApplyRoomDangerOverride =
    resolvedPolicy.enforceBrainObjectiveAuthority !== true &&
    resolvedPolicy.allowRoomDangerOverride &&
    effectiveBrainObjectiveState !== OBJECTIVE_DANGER &&
    roomDangerOverrideActive === true &&
    hasDangerTarget === true;
  const objectiveState = shouldApplyRoomDangerOverride
    ? OBJECTIVE_DANGER
    : effectiveBrainObjectiveState;
  const objectiveDispatchMode = normalizeDispatchMode({
    objectiveState,
    lastPlanReason,
  });
  return {
    objectiveState,
    desiredMode:
      objectiveState === OBJECTIVE_DANGER
        ? "flee"
        : objectiveState === OBJECTIVE_SHELTER
          ? "shelter"
          : "wander",
    objectiveDispatchMode,
    objectiveReasonCode: shouldApplyRoomDangerOverride
      ? REASON_CODE_ROOM_DANGER_OVERRIDE
      : normalizeReasonCode(arbitrationReasonCode),
    objectiveSource: "brain",
    roomDangerOverrideApplied: shouldApplyRoomDangerOverride,
  };
}

export function createObjectivePathFeedbackEnvelope({
  status = PATH_FEEDBACK_STATUS_NONE,
  reason = null,
  objectiveState = null,
  dispatchMode = null,
  targetWorld = null,
} = {}) {
  return {
    status: normalizePathFeedbackStatus(status),
    reason: normalizeReasonCode(reason),
    objectiveState: normalizeOptionalObjectiveState(objectiveState),
    dispatchMode:
      typeof dispatchMode === "string" && dispatchMode.length > 0
        ? dispatchMode
        : null,
    targetWorld: normalizeWorldPoint(targetWorld),
  };
}

export function dispatchDangerObjectivePlan({
  hasDangerTarget = false,
  threatWorld = null,
  roomDangerApplicable = false,
} = {}) {
  const normalizedThreatWorld = normalizeWorldPoint(threatWorld);
  if (hasDangerTarget !== true || !normalizedThreatWorld) {
    return {
      accepted: false,
      strategy: DANGER_STRATEGY_NONE,
      reason: "danger_no_target",
      targetWorld: null,
    };
  }
  const strategy = roomDangerApplicable === true
    ? DANGER_STRATEGY_ROOM_EGRESS
    : DANGER_STRATEGY_FLEE;
  return {
    accepted: true,
    strategy: normalizeDangerDispatchStrategy(strategy),
    reason: "danger_target_resolved",
    targetWorld: normalizedThreatWorld,
  };
}
