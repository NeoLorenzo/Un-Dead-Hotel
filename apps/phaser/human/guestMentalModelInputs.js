import { createGuestMentalInputVector } from "./guestMentalModel.js";

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(value)));
}

function buildDefaultAreaContext() {
  return {
    inRoom: false,
    inCorridor: false,
    classification: "other",
    doorwayTreatedAsRoom: false,
    isDoorwayTile: false,
    tileX: null,
    tileY: null,
    tile: null,
    roomIndex: null,
    chunkX: null,
    chunkY: null,
    identifiedByMemory: false,
    identifiedSourceLos: false,
    identifiedSourceRoomReveal: false,
  };
}

function normalizeAreaContext(areaContext) {
  const base = buildDefaultAreaContext();
  if (!areaContext || typeof areaContext !== "object") {
    return base;
  }
  return {
    inRoom: areaContext.inRoom === true,
    inCorridor: areaContext.inCorridor === true,
    classification: areaContext.classification || "other",
    doorwayTreatedAsRoom: areaContext.doorwayTreatedAsRoom === true,
    isDoorwayTile: areaContext.isDoorwayTile === true,
    tileX: Number.isFinite(areaContext.tileX) ? areaContext.tileX : null,
    tileY: Number.isFinite(areaContext.tileY) ? areaContext.tileY : null,
    tile: Number.isFinite(areaContext.tile) ? areaContext.tile : null,
    roomIndex: Number.isFinite(areaContext.roomIndex) ? areaContext.roomIndex : null,
    chunkX: Number.isFinite(areaContext.chunkX) ? areaContext.chunkX : null,
    chunkY: Number.isFinite(areaContext.chunkY) ? areaContext.chunkY : null,
    identifiedByMemory: areaContext.identifiedByMemory === true,
    identifiedSourceLos: areaContext.identifiedSourceLos === true,
    identifiedSourceRoomReveal: areaContext.identifiedSourceRoomReveal === true,
  };
}

function readHealthNormalized(guestController) {
  if (!guestController) {
    return 0;
  }
  const healthState =
    typeof guestController.getHealthState === "function"
      ? guestController.getHealthState()
      : null;
  const maxHp = Number(
    healthState?.maxHp ??
      (typeof guestController.getMaxHp === "function"
        ? guestController.getMaxHp()
        : 0)
  );
  const currentHp = Number(
    healthState?.currentHp ??
      (typeof guestController.getCurrentHp === "function"
        ? guestController.getCurrentHp()
        : 0)
  );
  if (!Number.isFinite(maxHp) || maxHp <= 0) {
    return 0;
  }
  return clamp01(currentHp / maxHp);
}

function readAreaContext(runtime, guestController, options = {}) {
  const areaContextResolver =
    typeof options?.areaContextResolver === "function"
      ? options.areaContextResolver
      : null;
  if (areaContextResolver) {
    const resolvedAreaContext = areaContextResolver({
      runtime,
      guestController,
      guestId: options?.guestId ?? null,
      guestPerceptionState: options?.guestPerceptionState ?? null,
    });
    return normalizeAreaContext(resolvedAreaContext);
  }

  const world =
    typeof guestController?.getCurrentWorldPosition === "function"
      ? guestController.getCurrentWorldPosition()
      : null;
  if (!Number.isFinite(world?.x) || !Number.isFinite(world?.y)) {
    return buildDefaultAreaContext();
  }
  if (typeof runtime?.classifyAreaAtWorld === "function") {
    const classified = runtime.classifyAreaAtWorld(world.x, world.y);
    return normalizeAreaContext({
      inRoom: classified?.inRoom === true,
      inCorridor: classified?.inCorridor === true,
      classification: classified?.classification || "other",
      doorwayTreatedAsRoom: classified?.doorwayTreatedAsRoom === true,
      isDoorwayTile: classified?.isDoorwayTile === true,
      tileX: Number.isFinite(classified?.tileX) ? classified.tileX : null,
      tileY: Number.isFinite(classified?.tileY) ? classified.tileY : null,
      tile: Number.isFinite(classified?.tile) ? classified.tile : null,
      roomIndex: Number.isFinite(classified?.roomIndex) ? classified.roomIndex : null,
      chunkX: Number.isFinite(classified?.chunkX) ? classified.chunkX : null,
      chunkY: Number.isFinite(classified?.chunkY) ? classified.chunkY : null,
    });
  }
  return buildDefaultAreaContext();
}

function readOptionalSignal(provider, payload) {
  if (typeof provider !== "function") {
    return {
      value: 0,
      active: false,
    };
  }
  const raw = provider(payload);
  if (!Number.isFinite(raw)) {
    return {
      value: 0,
      active: true,
    };
  }
  return {
    value: clamp01(raw),
    active: true,
  };
}

export function createGuestMentalModelInputAdapter({
  runtime,
  dangerDistanceSignalProvider = null,
  thirstSignalProvider = null,
  hungerSignalProvider = null,
  areaContextResolver = null,
} = {}) {
  if (!runtime) {
    throw new Error("createGuestMentalModelInputAdapter requires runtime.");
  }

  function buildInputs({
    config,
    guestController = null,
    guestId = null,
    guestPerceptionState = null,
  } = {}) {
    const hpNormalized = readHealthNormalized(guestController);
    const areaContext = readAreaContext(runtime, guestController, {
      areaContextResolver,
      guestId,
      guestPerceptionState,
    });

    const signalPayload = {
      runtime,
      config,
      guestController,
      guestId,
      guestPerceptionState,
      areaContext,
      hpNormalized,
    };
    const dangerSignal = readOptionalSignal(
      dangerDistanceSignalProvider,
      signalPayload
    );
    const thirstSignal = readOptionalSignal(thirstSignalProvider, signalPayload);
    const hungerSignal = readOptionalSignal(hungerSignalProvider, signalPayload);

    const inputValues = createGuestMentalInputVector(config, {
      hp_normalized: hpNormalized,
      in_corridor: areaContext.inCorridor ? 1 : 0,
      in_room: areaContext.inRoom ? 1 : 0,
      danger_distance_signal: dangerSignal.value,
      thirst_signal: thirstSignal.value,
      hunger_signal: hungerSignal.value,
    });

    return {
      inputValues,
      debug: {
        hpNormalized: inputValues.hp_normalized,
        inRoom: inputValues.in_room >= 0.5,
        inCorridor: inputValues.in_corridor >= 0.5,
        doorwayTreatedAsRoom: areaContext.doorwayTreatedAsRoom === true,
        isDoorwayTile: areaContext.isDoorwayTile === true,
        areaClassification: areaContext.classification || "other",
        areaTile: areaContext.tile,
        areaTileX: areaContext.tileX,
        areaTileY: areaContext.tileY,
        areaRoomIndex: areaContext.roomIndex,
        areaChunkX: areaContext.chunkX,
        areaChunkY: areaContext.chunkY,
        identifiedByMemory: areaContext.identifiedByMemory === true,
        identifiedSourceLos: areaContext.identifiedSourceLos === true,
        identifiedSourceRoomReveal: areaContext.identifiedSourceRoomReveal === true,
        inactiveInputs: {
          danger_distance_signal: !dangerSignal.active,
          thirst_signal: !thirstSignal.active,
          hunger_signal: !hungerSignal.active,
        },
      },
    };
  }

  return {
    buildInputs,
  };
}
