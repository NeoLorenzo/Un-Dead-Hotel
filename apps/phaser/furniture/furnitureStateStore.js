import {
  FURNITURE_TYPE_IDS,
  createFurnitureCatalog,
  getFurnitureTypeDefinition,
} from "./furnitureCatalog.js";

export const FURNITURE_STATE_SCHEMA_VERSION = 1;
export const FURNITURE_CLOCK_SCHEMA_VERSION = 1;
export const FURNITURE_ID_PREFIX = "furn";
export const FURNITURE_ORIENTATION_IDS = Object.freeze([
  "north",
  "east",
  "south",
  "west",
]);

const FURNITURE_RECORD_KEYS = Object.freeze([
  "furnitureId",
  "typeId",
  "tileX",
  "tileY",
  "orientation",
  "chunkX",
  "chunkY",
  "roomId",
  "spawnSlotId",
  "inventory",
  "resourceState",
]);

const CLOCK_KEYS = Object.freeze([
  "clockSchemaVersion",
  "dayLengthSeconds",
  "dayIndex",
  "secondsIntoDay",
  "elapsedSeconds",
]);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function assertNoUnexpectedKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} has unexpected key "${key}".`);
    }
  }
}

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertInteger(value, label) {
  assertFiniteNumber(value, label);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
}

function assertNonNegativeNumber(value, label) {
  assertFiniteNumber(value, label);
  if (value < 0) {
    throw new Error(`${label} must be >= 0.`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function assertOrientation(value, label) {
  if (!FURNITURE_ORIENTATION_IDS.includes(value)) {
    throw new Error(
      `${label} must be one of: ${FURNITURE_ORIENTATION_IDS.join(", ")}.`
    );
  }
}

function sanitizeIdSegment(value, label) {
  const source = String(value ?? "").trim();
  if (source.length === 0) {
    throw new Error(`${label} must be a non-empty segment.`);
  }
  return source.replace(/[:\s]/g, "_");
}

function tileKey(tileX, tileY) {
  return `${tileX},${tileY}`;
}

function occupiedTileKeysForRecord(record, catalog) {
  const typeDef = getFurnitureTypeDefinition(catalog, record.typeId);
  const widthTiles = Math.max(1, Number(typeDef?.footprint?.widthTiles) || 1);
  const heightTiles = Math.max(1, Number(typeDef?.footprint?.heightTiles) || 1);
  const keys = [];

  for (let dy = 0; dy < heightTiles; dy += 1) {
    for (let dx = 0; dx < widthTiles; dx += 1) {
      keys.push(tileKey(record.tileX + dx, record.tileY + dy));
    }
  }

  return keys;
}

function cloneInventory(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => ({
    ...item,
  }));
}

function cloneResourceState(value) {
  if (!isPlainObject(value)) {
    return {};
  }
  return { ...value };
}

export function createDeterministicFurnitureId({
  chunkX,
  chunkY,
  roomId,
  spawnSlotId,
  typeId,
} = {}) {
  assertInteger(chunkX, "createDeterministicFurnitureId.chunkX");
  assertInteger(chunkY, "createDeterministicFurnitureId.chunkY");
  assertString(typeId, "createDeterministicFurnitureId.typeId");
  if (!FURNITURE_TYPE_IDS.includes(typeId)) {
    throw new Error(
      `createDeterministicFurnitureId.typeId must be one of: ${FURNITURE_TYPE_IDS.join(", ")}.`
    );
  }
  const normalizedRoomId = sanitizeIdSegment(roomId, "createDeterministicFurnitureId.roomId");
  const normalizedSpawnSlotId = sanitizeIdSegment(
    spawnSlotId,
    "createDeterministicFurnitureId.spawnSlotId"
  );
  return `${FURNITURE_ID_PREFIX}:${chunkX},${chunkY}:${normalizedRoomId}:${normalizedSpawnSlotId}:${typeId}`;
}

export function createFurnitureClockState({
  dayLengthSeconds = 600,
  dayIndex = 1,
  secondsIntoDay = 0,
  elapsedSeconds = 0,
} = {}) {
  assertFiniteNumber(dayLengthSeconds, "createFurnitureClockState.dayLengthSeconds");
  if (dayLengthSeconds <= 0) {
    throw new Error("createFurnitureClockState.dayLengthSeconds must be > 0.");
  }
  assertInteger(dayIndex, "createFurnitureClockState.dayIndex");
  if (dayIndex < 1) {
    throw new Error("createFurnitureClockState.dayIndex must be >= 1.");
  }
  assertNonNegativeNumber(secondsIntoDay, "createFurnitureClockState.secondsIntoDay");
  assertNonNegativeNumber(elapsedSeconds, "createFurnitureClockState.elapsedSeconds");
  const normalizedSecondsIntoDay = secondsIntoDay % dayLengthSeconds;
  return {
    clockSchemaVersion: FURNITURE_CLOCK_SCHEMA_VERSION,
    dayLengthSeconds: Number(dayLengthSeconds),
    dayIndex: Number(dayIndex),
    secondsIntoDay: Number(normalizedSecondsIntoDay),
    elapsedSeconds: Number(elapsedSeconds),
  };
}

export function advanceFurnitureClockState(clockState, deltaSeconds) {
  if (!isPlainObject(clockState)) {
    throw new Error("advanceFurnitureClockState.clockState must be an object.");
  }
  validateFurnitureClockState(clockState, {
    label: "advanceFurnitureClockState.clockState",
  });
  assertFiniteNumber(deltaSeconds, "advanceFurnitureClockState.deltaSeconds");
  if (deltaSeconds < 0) {
    throw new Error("advanceFurnitureClockState.deltaSeconds must be >= 0.");
  }

  const dayLengthSeconds = Number(clockState.dayLengthSeconds);
  let nextSeconds = Number(clockState.secondsIntoDay) + Number(deltaSeconds);
  let dayOffset = 0;
  while (nextSeconds >= dayLengthSeconds) {
    nextSeconds -= dayLengthSeconds;
    dayOffset += 1;
  }

  return {
    clockSchemaVersion: FURNITURE_CLOCK_SCHEMA_VERSION,
    dayLengthSeconds,
    dayIndex: Number(clockState.dayIndex) + dayOffset,
    secondsIntoDay: nextSeconds,
    elapsedSeconds: Number(clockState.elapsedSeconds) + Number(deltaSeconds),
  };
}

export function formatFurnitureClockDisplay(clockState) {
  validateFurnitureClockState(clockState, {
    label: "formatFurnitureClockDisplay.clockState",
  });
  const dayLengthSeconds = Number(clockState.dayLengthSeconds);
  const secondsIntoDay = Number(clockState.secondsIntoDay);
  const dayProgress = dayLengthSeconds > 0 ? secondsIntoDay / dayLengthSeconds : 0;
  const totalMinutes = Math.floor(dayProgress * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hoursLabel = String(hours).padStart(2, "0");
  const minutesLabel = String(minutes).padStart(2, "0");
  return {
    dayLabel: `Day ${Number(clockState.dayIndex)}`,
    timeLabel: `${hoursLabel}:${minutesLabel}`,
  };
}

export function validateFurnitureClockState(clockState, { label = "furnitureClockState" } = {}) {
  if (!isPlainObject(clockState)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(clockState, CLOCK_KEYS, label);
  assertInteger(clockState.clockSchemaVersion, `${label}.clockSchemaVersion`);
  if (Number(clockState.clockSchemaVersion) !== FURNITURE_CLOCK_SCHEMA_VERSION) {
    throw new Error(
      `${label}.clockSchemaVersion must equal ${FURNITURE_CLOCK_SCHEMA_VERSION}.`
    );
  }
  assertFiniteNumber(clockState.dayLengthSeconds, `${label}.dayLengthSeconds`);
  if (Number(clockState.dayLengthSeconds) <= 0) {
    throw new Error(`${label}.dayLengthSeconds must be > 0.`);
  }
  assertInteger(clockState.dayIndex, `${label}.dayIndex`);
  if (Number(clockState.dayIndex) < 1) {
    throw new Error(`${label}.dayIndex must be >= 1.`);
  }
  assertNonNegativeNumber(clockState.secondsIntoDay, `${label}.secondsIntoDay`);
  if (Number(clockState.secondsIntoDay) >= Number(clockState.dayLengthSeconds)) {
    throw new Error(`${label}.secondsIntoDay must be < dayLengthSeconds.`);
  }
  assertNonNegativeNumber(clockState.elapsedSeconds, `${label}.elapsedSeconds`);
  return createFurnitureClockState(clockState);
}

function normalizeFurnitureRecord(record, catalog, { label = "furnitureRecord" } = {}) {
  if (!isPlainObject(record)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(record, FURNITURE_RECORD_KEYS, label);

  const typeId = String(record.typeId || "");
  if (!FURNITURE_TYPE_IDS.includes(typeId)) {
    throw new Error(`${label}.typeId must be one of: ${FURNITURE_TYPE_IDS.join(", ")}.`);
  }
  getFurnitureTypeDefinition(catalog, typeId);

  assertString(record.furnitureId, `${label}.furnitureId`);
  assertInteger(record.tileX, `${label}.tileX`);
  assertInteger(record.tileY, `${label}.tileY`);
  assertOrientation(record.orientation, `${label}.orientation`);
  assertInteger(record.chunkX, `${label}.chunkX`);
  assertInteger(record.chunkY, `${label}.chunkY`);
  assertString(record.roomId, `${label}.roomId`);
  assertString(record.spawnSlotId, `${label}.spawnSlotId`);

  return {
    furnitureId: String(record.furnitureId),
    typeId,
    tileX: Number(record.tileX),
    tileY: Number(record.tileY),
    orientation: String(record.orientation),
    chunkX: Number(record.chunkX),
    chunkY: Number(record.chunkY),
    roomId: String(record.roomId),
    spawnSlotId: String(record.spawnSlotId),
    inventory: cloneInventory(record.inventory),
    resourceState: cloneResourceState(record.resourceState),
  };
}

function cloneFurnitureRecord(record) {
  return {
    furnitureId: String(record.furnitureId),
    typeId: String(record.typeId),
    tileX: Number(record.tileX),
    tileY: Number(record.tileY),
    orientation: String(record.orientation),
    chunkX: Number(record.chunkX),
    chunkY: Number(record.chunkY),
    roomId: String(record.roomId),
    spawnSlotId: String(record.spawnSlotId),
    inventory: cloneInventory(record.inventory),
    resourceState: cloneResourceState(record.resourceState),
  };
}

function compareRecordsById(a, b) {
  const aId = String(a?.furnitureId || "");
  const bId = String(b?.furnitureId || "");
  if (aId < bId) {
    return -1;
  }
  if (aId > bId) {
    return 1;
  }
  return 0;
}

export function createFurnitureStateStore({
  catalog = null,
  initialClockState = null,
} = {}) {
  const resolvedCatalog = catalog == null ? createFurnitureCatalog() : createFurnitureCatalog(catalog);
  let clockState =
    initialClockState == null
      ? createFurnitureClockState()
      : validateFurnitureClockState(initialClockState, {
          label: "createFurnitureStateStore.initialClockState",
        });
  const furnitureById = new Map();
  const occupancyByTileKey = new Map();

  function setClockState(nextClockState) {
    clockState = validateFurnitureClockState(nextClockState, {
      label: "setClockState.nextClockState",
    });
    return getClockState();
  }

  function advanceClock(deltaSeconds) {
    clockState = advanceFurnitureClockState(clockState, deltaSeconds);
    return getClockState();
  }

  function getClockState() {
    return {
      ...clockState,
    };
  }

  function upsertFurniture(record, { allowOverwrite = true } = {}) {
    const normalized = normalizeFurnitureRecord(record, resolvedCatalog, {
      label: "upsertFurniture.record",
    });

    const existing = furnitureById.get(normalized.furnitureId);
    if (existing && !allowOverwrite) {
      throw new Error(
        `upsertFurniture cannot overwrite existing furniture "${normalized.furnitureId}".`
      );
    }

    const nextTileKeys = occupiedTileKeysForRecord(normalized, resolvedCatalog);
    const previousTileKeys = existing
      ? occupiedTileKeysForRecord(existing, resolvedCatalog)
      : [];
    const nextTileKeySet = new Set(nextTileKeys);

    for (const nextKey of nextTileKeys) {
      const occupiedById = occupancyByTileKey.get(nextKey);
      if (occupiedById && occupiedById !== normalized.furnitureId) {
        throw new Error(`Tile ${nextKey} is already occupied by "${occupiedById}".`);
      }
    }

    if (existing) {
      for (const previousKey of previousTileKeys) {
        if (!nextTileKeySet.has(previousKey)) {
          occupancyByTileKey.delete(previousKey);
        }
      }
    }

    for (const nextKey of nextTileKeys) {
      occupancyByTileKey.set(nextKey, normalized.furnitureId);
    }
    furnitureById.set(normalized.furnitureId, normalized);
    return cloneFurnitureRecord(normalized);
  }

  function removeFurnitureById(furnitureId) {
    const id = String(furnitureId || "");
    const existing = furnitureById.get(id);
    if (!existing) {
      return null;
    }
    furnitureById.delete(id);
    const occupiedTileKeys = occupiedTileKeysForRecord(existing, resolvedCatalog);
    for (const key of occupiedTileKeys) {
      occupancyByTileKey.delete(key);
    }
    return cloneFurnitureRecord(existing);
  }

  function clearFurniture() {
    furnitureById.clear();
    occupancyByTileKey.clear();
  }

  function setFurnitureRecords(records, { replace = true } = {}) {
    if (!Array.isArray(records)) {
      throw new Error("setFurnitureRecords.records must be an array.");
    }
    if (replace) {
      clearFurniture();
    }
    const sorted = [...records].sort(compareRecordsById);
    for (const record of sorted) {
      upsertFurniture(record, { allowOverwrite: true });
    }
    return getFurnitureRecords();
  }

  function getFurnitureById(furnitureId) {
    const record = furnitureById.get(String(furnitureId || ""));
    return record ? cloneFurnitureRecord(record) : null;
  }

  function getFurnitureRecords() {
    return [...furnitureById.values()].sort(compareRecordsById).map(cloneFurnitureRecord);
  }

  function getOccupiedTileEntries() {
    return [...occupancyByTileKey.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([keyValue, furnitureId]) => ({
        tileKey: keyValue,
        furnitureId: String(furnitureId),
      }));
  }

  function serialize() {
    return {
      schemaVersion: FURNITURE_STATE_SCHEMA_VERSION,
      clockState: getClockState(),
      furnitureRecords: getFurnitureRecords(),
    };
  }

  function hydrate(serializedState, { replace = true } = {}) {
    if (!isPlainObject(serializedState)) {
      throw new Error("hydrate.serializedState must be an object.");
    }
    assertInteger(serializedState.schemaVersion, "hydrate.serializedState.schemaVersion");
    if (Number(serializedState.schemaVersion) !== FURNITURE_STATE_SCHEMA_VERSION) {
      throw new Error(
        `hydrate.serializedState.schemaVersion must equal ${FURNITURE_STATE_SCHEMA_VERSION}.`
      );
    }
    setClockState(serializedState.clockState);
    setFurnitureRecords(serializedState.furnitureRecords, { replace });
    return serialize();
  }

  return {
    getCatalog: () => createFurnitureCatalog(resolvedCatalog),
    getClockState,
    setClockState,
    advanceClock,
    formatClockDisplay: () => formatFurnitureClockDisplay(clockState),
    upsertFurniture,
    removeFurnitureById,
    clearFurniture,
    setFurnitureRecords,
    getFurnitureById,
    getFurnitureRecords,
    getOccupiedTileEntries,
    serialize,
    hydrate,
  };
}
