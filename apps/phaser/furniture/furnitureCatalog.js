export const FURNITURE_CATALOG_VERSION = 1;

export const FURNITURE_TYPE_IDS = Object.freeze([
  "bed",
  "nightstand",
  "closet",
  "sink",
  "mini_bar",
  "chair",
  "table",
]);

export const FURNITURE_MOVEMENT_PROFILE_IDS = Object.freeze(["block", "slow"]);
export const FURNITURE_RESOURCE_SOURCE_IDS = Object.freeze([
  "none",
  "sink_infinite",
  "mini_bar_daily",
]);

const TYPE_KEYS = Object.freeze([
  "displayName",
  "footprint",
  "movementProfile",
  "storage",
  "salvage",
  "tactical",
  "resourceSource",
]);

const FOOTPRINT_KEYS = Object.freeze(["widthTiles", "heightTiles"]);
const STORAGE_KEYS = Object.freeze(["enabled", "slotCapacity"]);
const SALVAGE_KEYS = Object.freeze(["enabled", "yieldTable"]);
const TACTICAL_KEYS = Object.freeze(["coverValue", "barricadeCompatible", "blocksLineOfSight"]);

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

function assertIntegerInRange(value, min, max, label) {
  assertFiniteNumber(value, label);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer in range [${min}, ${max}].`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be boolean.`);
  }
}

function assertEnumValue(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    throw new Error(
      `${label} must be one of: ${allowedValues.join(", ")}. Received "${String(value)}".`
    );
  }
}

function validateFootprint(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(value, FOOTPRINT_KEYS, label);
  assertIntegerInRange(value.widthTiles, 1, 8, `${label}.widthTiles`);
  assertIntegerInRange(value.heightTiles, 1, 8, `${label}.heightTiles`);
}

function validateStorage(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(value, STORAGE_KEYS, label);
  assertBoolean(value.enabled, `${label}.enabled`);
  assertIntegerInRange(value.slotCapacity, 0, 256, `${label}.slotCapacity`);
  if (!value.enabled && value.slotCapacity !== 0) {
    throw new Error(`${label}.slotCapacity must be 0 when storage is disabled.`);
  }
}

function validateSalvageYieldTable(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object.`);
  }
  for (const [resourceId, amount] of Object.entries(value)) {
    assertString(resourceId, `${label}.${resourceId}`);
    assertIntegerInRange(amount, 0, 999, `${label}.${resourceId}`);
  }
}

function validateSalvage(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(value, SALVAGE_KEYS, label);
  assertBoolean(value.enabled, `${label}.enabled`);
  validateSalvageYieldTable(value.yieldTable, `${label}.yieldTable`);
  if (!value.enabled && Object.keys(value.yieldTable).length > 0) {
    throw new Error(`${label}.yieldTable must be empty when salvage is disabled.`);
  }
}

function validateTactical(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(value, TACTICAL_KEYS, label);
  assertFiniteNumber(value.coverValue, `${label}.coverValue`);
  if (value.coverValue < 0 || value.coverValue > 1) {
    throw new Error(`${label}.coverValue must be in range [0, 1].`);
  }
  assertBoolean(value.barricadeCompatible, `${label}.barricadeCompatible`);
  assertBoolean(value.blocksLineOfSight, `${label}.blocksLineOfSight`);
}

export function validateFurnitureTypeDefinition(typeDef, typeId, label = "furnitureType") {
  if (!isPlainObject(typeDef)) {
    throw new Error(`${label}.${typeId} must be an object.`);
  }
  assertNoUnexpectedKeys(typeDef, TYPE_KEYS, `${label}.${typeId}`);
  assertString(typeDef.displayName, `${label}.${typeId}.displayName`);
  validateFootprint(typeDef.footprint, `${label}.${typeId}.footprint`);
  assertEnumValue(
    typeDef.movementProfile,
    FURNITURE_MOVEMENT_PROFILE_IDS,
    `${label}.${typeId}.movementProfile`
  );
  validateStorage(typeDef.storage, `${label}.${typeId}.storage`);
  validateSalvage(typeDef.salvage, `${label}.${typeId}.salvage`);
  validateTactical(typeDef.tactical, `${label}.${typeId}.tactical`);
  assertEnumValue(
    typeDef.resourceSource,
    FURNITURE_RESOURCE_SOURCE_IDS,
    `${label}.${typeId}.resourceSource`
  );
}

function createDefaultCatalog() {
  return {
    bed: {
      displayName: "Bed",
      footprint: { widthTiles: 2, heightTiles: 2 },
      movementProfile: "block",
      storage: { enabled: false, slotCapacity: 0 },
      salvage: { enabled: true, yieldTable: { wood_scrap: 3, fabric_scrap: 2 } },
      tactical: { coverValue: 0.35, barricadeCompatible: false, blocksLineOfSight: false },
      resourceSource: "none",
    },
    nightstand: {
      displayName: "Nightstand",
      footprint: { widthTiles: 1, heightTiles: 1 },
      movementProfile: "block",
      storage: { enabled: true, slotCapacity: 6 },
      salvage: { enabled: true, yieldTable: { wood_scrap: 2 } },
      tactical: { coverValue: 0.2, barricadeCompatible: false, blocksLineOfSight: false },
      resourceSource: "none",
    },
    closet: {
      displayName: "Closet",
      footprint: { widthTiles: 1, heightTiles: 2 },
      movementProfile: "block",
      storage: { enabled: true, slotCapacity: 18 },
      salvage: { enabled: true, yieldTable: { wood_scrap: 4, metal_scrap: 1 } },
      tactical: { coverValue: 0.55, barricadeCompatible: true, blocksLineOfSight: true },
      resourceSource: "none",
    },
    sink: {
      displayName: "Sink",
      footprint: { widthTiles: 1, heightTiles: 1 },
      movementProfile: "block",
      storage: { enabled: false, slotCapacity: 0 },
      salvage: { enabled: true, yieldTable: { metal_scrap: 2 } },
      tactical: { coverValue: 0.25, barricadeCompatible: false, blocksLineOfSight: false },
      resourceSource: "sink_infinite",
    },
    mini_bar: {
      displayName: "Mini-Bar",
      footprint: { widthTiles: 1, heightTiles: 1 },
      movementProfile: "block",
      storage: { enabled: true, slotCapacity: 10 },
      salvage: { enabled: true, yieldTable: { metal_scrap: 2, plastic_scrap: 2 } },
      tactical: { coverValue: 0.3, barricadeCompatible: false, blocksLineOfSight: false },
      resourceSource: "mini_bar_daily",
    },
    chair: {
      displayName: "Chair",
      footprint: { widthTiles: 1, heightTiles: 1 },
      movementProfile: "slow",
      storage: { enabled: false, slotCapacity: 0 },
      salvage: { enabled: true, yieldTable: { wood_scrap: 1 } },
      tactical: { coverValue: 0.1, barricadeCompatible: false, blocksLineOfSight: false },
      resourceSource: "none",
    },
    table: {
      displayName: "Table",
      footprint: { widthTiles: 2, heightTiles: 1 },
      movementProfile: "slow",
      storage: { enabled: false, slotCapacity: 0 },
      salvage: { enabled: true, yieldTable: { wood_scrap: 3 } },
      tactical: { coverValue: 0.25, barricadeCompatible: true, blocksLineOfSight: false },
      resourceSource: "none",
    },
  };
}

function cloneCatalog(catalog) {
  const out = {};
  for (const typeId of FURNITURE_TYPE_IDS) {
    const typeDef = catalog[typeId];
    out[typeId] = {
      displayName: String(typeDef.displayName),
      footprint: {
        widthTiles: Number(typeDef.footprint.widthTiles),
        heightTiles: Number(typeDef.footprint.heightTiles),
      },
      movementProfile: String(typeDef.movementProfile),
      storage: {
        enabled: Boolean(typeDef.storage.enabled),
        slotCapacity: Number(typeDef.storage.slotCapacity),
      },
      salvage: {
        enabled: Boolean(typeDef.salvage.enabled),
        yieldTable: { ...typeDef.salvage.yieldTable },
      },
      tactical: {
        coverValue: Number(typeDef.tactical.coverValue),
        barricadeCompatible: Boolean(typeDef.tactical.barricadeCompatible),
        blocksLineOfSight: Boolean(typeDef.tactical.blocksLineOfSight),
      },
      resourceSource: String(typeDef.resourceSource),
    };
  }
  return out;
}

export function validateFurnitureCatalog(catalog, { label = "furnitureCatalog" } = {}) {
  if (!isPlainObject(catalog)) {
    throw new Error(`${label} must be an object.`);
  }
  assertNoUnexpectedKeys(catalog, FURNITURE_TYPE_IDS, label);
  for (const typeId of FURNITURE_TYPE_IDS) {
    if (!hasOwn(catalog, typeId)) {
      throw new Error(`${label} is missing furniture type "${typeId}".`);
    }
    validateFurnitureTypeDefinition(catalog[typeId], typeId, label);
  }
  return cloneCatalog(catalog);
}

export function createFurnitureCatalog(overrides = null) {
  const baseCatalog = createDefaultCatalog();
  if (overrides == null) {
    return validateFurnitureCatalog(baseCatalog, {
      label: "createFurnitureCatalog defaultCatalog",
    });
  }
  const nextCatalog = {
    ...baseCatalog,
    ...overrides,
  };
  return validateFurnitureCatalog(nextCatalog, {
    label: "createFurnitureCatalog overrides",
  });
}

export function getFurnitureTypeDefinition(catalog, typeId) {
  const validated = validateFurnitureCatalog(catalog, {
    label: "getFurnitureTypeDefinition catalog",
  });
  if (!hasOwn(validated, typeId)) {
    throw new Error(`Unknown furniture type "${String(typeId)}".`);
  }
  return validated[typeId];
}
