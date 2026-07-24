const MODULE_ID = "meu-modulo-feiticos";
const RUNTIME_BUILD = "2026-07-24.24";
const FLAG_SCOPE = "foundry-spell-pack";
// Convenção métrica usada pelo mundo: 5 pés = 1,5 metro = 1 quadrado.
const FEET_PER_GRID_SQUARE = 5;
const METERS_PER_GRID_SQUARE = 1.5;
let SINGLE_CELL_SNAP_STATE = null;
const PERSISTENT_AREA_TURN_HITS = new Map();
let PERSISTENT_AREA_ACTIVE_TOKEN = null;
let PERSISTENT_AREA_SCALE_OVERRIDE = null;

function spellFlag(document, key) {
  return document?.flags?.[FLAG_SCOPE]?.[key]
    ?? document?._source?.flags?.[FLAG_SCOPE]?.[key];
}

function selectedTargets() {
  return [...(game.user?.targets ?? [])];
}

function spellTemplateData(item, workflow = null) {
  return workflow?.activity?.target?.template
    ?? workflow?.activity?._source?.target?.template
    ?? item?.system?.target?.template
    ?? item?._source?.system?.target?.template
    ?? activityTemplateForItem(item)
    ?? null;
}

function spellTargetType(item, workflow = null) {
  return workflow?.activity?.target?.affects?.type
    ?? item?.system?.target?.affects?.type
    ?? null;
}

function normalizedDistanceUnit(units) {
  return String(units ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "");
}

function isFeetUnit(units) {
  return ["ft", "foot", "feet", "pe", "pes"].includes(normalizedDistanceUnit(units));
}

function isMetersUnit(units) {
  return ["m", "meter", "meters", "metre", "metres", "metro", "metros"].includes(normalizedDistanceUnit(units));
}

function sceneDistanceUnits() {
  return normalizedDistanceUnit(canvas.scene?.grid?.units);
}

function metersToSceneDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return value;

  const units = sceneDistanceUnits();
  if (isMetersUnit(units)) return value;
  if (isFeetUnit(units)) return (value / METERS_PER_GRID_SQUARE) * FEET_PER_GRID_SQUARE;

  // Para cenas configuradas em "quadrados" ou com unidade personalizada, converte pela
  // escala da grade. Ex.: grid.distance 1 significa que 1 quadrado vale 1 unidade da cena.
  const gridDistance = Number(canvas.scene?.grid?.distance);
  if (Number.isFinite(gridDistance) && gridDistance > 0) {
    return (value / METERS_PER_GRID_SQUARE) * gridDistance;
  }
  return value;
}

function distanceToSceneUnits(value, units) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (isFeetUnit(units)) return feetToSceneDistance(numeric);
  if (isMetersUnit(units)) return metersToSceneDistance(numeric);
  return numeric;
}

function sameDistance(left, right, tolerance = 0.02) {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= Math.max(Math.abs(b) * tolerance, 0.001);
}

function spellFlowProfile(item, workflow = null) {
  const template = spellTemplateData(item, workflow);
  const targetType = spellTargetType(item, workflow);
  const areaType = spellFlag(item, "automation")?.area?.type ?? null;
  const templateSize = distanceToSceneUnits(template?.size, template?.units);
  const gridDistance = Number(canvas.scene?.grid?.distance ?? 0);
  // Compara tudo na unidade da cena: 5 ft vira exatamente uma célula tanto em cenas configuradas
  // em pés (5), metros (1,5) quanto em quadrados (1).
  const isSingleCellSize = gridDistance > 0 && sameDistance(templateSize, gridDistance);
  return {
    areaType,
    targetType,
    templateType: template?.type ?? null,
    usesTemplate: !!template?.type,
    persistentTemplate: !!spellFlag(item, "animation")?.persistent,
    singleGridCellTemplate: targetType === "space"
      && template?.type === "cube"
      && isSingleCellSize
  };
}

function affectedTargets(item, workflow, fallback) {
  if (!workflow) return fallback;
  const activityType = workflow.activity?.type
    ?? Object.values(item?.system?.activities ?? {})[0]?.type;
  if (activityType === "attack") return [...(workflow.hitTargets ?? fallback)];
  if (activityType === "save") return [...(workflow.failedSaves ?? fallback)];
  return fallback;
}

function resolveToken(candidate) {
  return candidate?.object ?? candidate ?? canvas.tokens?.controlled?.[0] ?? null;
}

function sceneUsers() {
  const sceneId = canvas.scene?.id;
  return [...(game.users ?? [])].filter(user => user.active && (!user.viewedScene || user.viewedScene === sceneId));
}

function userOwnedTokens(user) {
  return (canvas.tokens?.placeables ?? []).filter(token => {
    return token.actor?.testUserPermission?.(user, "OWNER")
      || token.document?.testUserPermission?.(user, "OWNER");
  });
}

function thunderclapAudibleDistance() {
  // A descrição usa 100 pés; no mundo métrico isso corresponde a 30 metros.
  return feetToSceneDistance(100);
}

function thunderclapSoundUsers(source) {
  const maximumDistance = thunderclapAudibleDistance();
  return sceneUsers()
    .filter(user => userOwnedTokens(user).some(token => tokenDistance(source, token) <= maximumDistance))
    .map(user => user.id);
}

function tokenCanSeePoint(token, point) {
  if (!token?.document?.sight?.enabled) return false;
  if (typeof token.vision?.contains === "function") {
    return token.vision.contains(point.x, point.y);
  }
  const sightBackend = globalThis.CONFIG?.Canvas?.polygonBackends?.sight;
  if (!sightBackend?.testCollision) return false;
  return !sightBackend.testCollision(token.center, point, { type: "sight", mode: "any" });
}

function thunderclapVisualUsers(source) {
  return sceneUsers()
    .filter(user => user.isGM || userOwnedTokens(user).some(token => tokenCanSeePoint(token, source.center)))
    .map(user => user.id);
}

function availableAnimationFile(layer, config) {
  const candidates = [layer.file, ...(layer.fallbacks ?? []), ...(config.fallbacks ?? [])].filter(Boolean);
  const database = globalThis.Sequencer?.Database;
  if (!database?.entryExists) return candidates[0];
  return candidates.find(file => {
    if (/^(modules|systems|worlds)\//.test(file)) return true;
    try { return database.entryExists(file); } catch (error) { return false; }
  });
}

function singleCellAreaCenter(item, location, workflow = null) {
  const document = location?.document ?? location;
  const shapes = document?.shapes ?? document?._source?.shapes;
  const rectangle = shapes?.find?.(shape => shape.type === "rectangle");
  if (rectangle) {
    return {
      x: Number(rectangle.x) + (Number(rectangle.width) / 2),
      y: Number(rectangle.y) + (Number(rectangle.height) / 2)
    };
  }
  const profile = spellFlowProfile(item, workflow);
  const templateType = document?.t ?? document?._source?.t;
  if (!profile.singleGridCellTemplate && templateType !== "rect") return null;
  const x = Number(document?.x);
  const y = Number(document?.y);
  const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !gridSize) return null;
  return { x: x + (gridSize / 2), y: y + (gridSize / 2) };
}

async function createSpellTestActors() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Somente o mestre pode criar as fichas de teste.");
    return [];
  }

  const pack = game.packs?.get(`${MODULE_ID}.feiticos-5e`);
  if (!pack) throw new Error("O compêndio Feitiços D&D 5e — 2014 não está disponível.");
  const spells = await pack.getDocuments();
  const folder = game.folders?.find(entry => {
    return entry.type === "Actor" && entry.flags?.[FLAG_SCOPE]?.spellTestFolder === true;
  }) ?? await Folder.create({
    name: "Testes de Magia",
    type: "Actor",
    color: "#6655aa",
    flags: { [FLAG_SCOPE]: { spellTestFolder: true } }
  });

  const abilities = Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map(ability => [ability, { value: ability === "int" ? 20 : 14 }])
  );
  const slots = Object.fromEntries(
    Array.from({ length: 9 }, (_, index) => [`spell${index + 1}`, { value: 99, max: 99 }])
  );
  const created = [];

  for (let level = 0; level <= 9; level += 1) {
    const name = level === 0 ? "Teste — Truques" : `Teste — Magias de ${level}º nível`;
    let actor = game.actors?.find(entry => {
      return entry.flags?.[FLAG_SCOPE]?.spellTestLevel === level;
    });
    const actorData = {
      name,
      type: "npc",
      img: "systems/dnd5e/icons/svg/actors/npc.svg",
      folder: folder.id,
      system: {
        abilities,
        attributes: {
          hp: { value: 250, max: 250 },
          ac: { flat: 18, calc: "flat" },
          spellcasting: "int"
        },
        details: { cr: 20 },
        spells: slots
      },
      prototypeToken: {
        name,
        actorLink: true,
        disposition: 1,
        sight: { enabled: true, range: 60, visionMode: "basic" }
      },
      flags: { [FLAG_SCOPE]: { spellTestLevel: level } }
    };

    if (actor) {
      await actor.update(actorData);
      const previousSpells = actor.items.filter(item => item.type === "spell").map(item => item.id);
      if (previousSpells.length) await actor.deleteEmbeddedDocuments("Item", previousSpells);
    } else {
      actor = await Actor.create(actorData);
    }

    const levelSpells = spells
      .filter(spell => spell.type === "spell" && Number(spell.system?.level) === level)
      .map(spell => {
        const data = spell.toObject();
        delete data._id;
        delete data.folder;
        delete data.sort;
        return data;
      });
    if (levelSpells.length) await actor.createEmbeddedDocuments("Item", levelSpells);
    created.push(actor);
  }

  ui.notifications?.info("10 fichas de teste criadas e sincronizadas com o compêndio.");
  return created;
}

async function playAnimation({ item, token, targets = selectedTargets(), location = null, workflow = null } = {}) {
  const config = spellFlag(item, "animation");
  const source = resolveToken(token);
  if (!config || !source || !globalThis.Sequence) return false;

  const isThunderclap = item?.name === "Thunderclap";
  if (config.targeted && !targets.length && !location) return false;
  const soundUsers = isThunderclap ? thunderclapSoundUsers(source) : null;
  const visualUsers = isThunderclap ? thunderclapVisualUsers(source) : null;
  const destinations = location ? [location] : config.targeted && targets.length ? targets : [source];
  const persistentEffectName = `${MODULE_ID}:${item.uuid}`;
  if (location && config.persistent && globalThis.Sequencer?.EffectManager?.endEffects) {
    await globalThis.Sequencer.EffectManager.endEffects({ name: persistentEffectName });
  }
  for (const destination of destinations) {
    const jobs = [];
    const soundFile = isThunderclap
      ? "modules/meu-modulo-feiticos/sounds/thunderclap.wav"
      : config.sound;
    if (soundFile && (!isThunderclap || soundUsers.length)) {
      const soundSequence = new Sequence();
      let sound = soundSequence.sound()
        .file(soundFile)
        .volume(config.volume ?? 0.25);
      if (isThunderclap) {
        sound = sound
          .atLocation(source)
          .radius(thunderclapAudibleDistance())
          .forUsers(soundUsers);
      }
      jobs.push(soundSequence.play());
    }

    const layers = config.layers?.length ? config.layers : [config];
    const sequence = new Sequence();
    for (const layer of (!isThunderclap || visualUsers.length) ? layers : []) {
      const animationFile = availableAnimationFile(layer, config);
      if (!animationFile) continue;
      let effect = sequence.effect().file(animationFile);
      if (location && (layer.persistent ?? config.persistent)) {
        const areaCenter = singleCellAreaCenter(item, location, workflow);
        if (areaCenter) {
          effect = effect
            .atLocation(areaCenter)
            .center()
            .spriteAnchor(0.5)
            .size(Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100))
            .persist()
            .name(persistentEffectName);
        } else {
          effect = effect.attachTo(location.object ?? location).persist().name(persistentEffectName);
        }
      } else if (layer.targeted ?? config.targeted) effect = effect.atLocation(source).stretchTo(destination);
      else if (isThunderclap) {
        effect = effect.attachTo(source, {
          bindVisibility: true,
          bindAlpha: false,
          bindElevation: true,
          bindScale: false,
          bindRotation: false
        });
      } else effect = effect.atLocation(destination);
      if (isThunderclap) effect.forUsers(visualUsers);
      if (layer.scale ?? config.scale) effect.scale(layer.scale ?? config.scale);
      if (layer.belowTokens ?? config.belowTokens) effect.belowTokens();
      if (layer.duration) effect.duration(layer.duration);
      effect.fadeIn(layer.fadeIn ?? 150).fadeOut(layer.fadeOut ?? 300);
    }
    if (!isThunderclap || visualUsers.length) jobs.push(sequence.play());
    await Promise.allSettled(jobs);
  }
  return true;
}

function tokenDistance(source, target) {
  try {
    const distance = globalThis.MidiQOL?.computeDistance?.(source, target, { wallsBlock: false });
    if (Number.isFinite(distance) && distance >= 0) return distance;
  } catch (error) {}
  const measurement = canvas.grid?.measurePath?.([source.center, target.center]);
  return Number(measurement?.distance ?? Number.POSITIVE_INFINITY);
}

function setUserTargets(targets) {
  const user = game.user;
  for (const current of [...(user?.targets ?? [])]) {
    current.setTarget?.(false, { user, releaseOthers: false, groupSelection: true });
  }
  targets.forEach((target, index) => {
    target.setTarget?.(true, {
      user,
      releaseOthers: index === 0,
      groupSelection: true
    });
  });
}

async function targetEmanation({ item, token, workflow } = {}) {
  const source = resolveToken(token);
  const area = spellFlag(item, "automation")?.area;
  if (!source || area?.type !== "emanation") return [];
  const gridDistance = Number(canvas.scene?.grid?.distance ?? METERS_PER_GRID_SQUARE);
  const radius = Number.isFinite(Number(area.radiusSquares))
    ? gridDistance * Number(area.radiusSquares)
    : Number(area.radius ?? 0);

  const targets = (canvas.tokens?.placeables ?? []).filter(candidate => {
    return !!candidate?.actor
      && !(area.excludeSelf && candidate.id === source.id)
      && !(area.disposition === "enemy"
        && candidate.document?.disposition === source.document?.disposition)
      && !(area.requireVision && !tokenCanSeePoint(source, candidate.center))
      && tokenDistance(source, candidate) <= radius;
  });
  setUserTargets(targets);
  if (typeof workflow?.setTargets === "function") {
    workflow.setTargets(new Set(targets));
  } else if (workflow && "targets" in workflow) {
    workflow.targets = new Set(targets);
  }
  return targets;
}

async function applyStatus({ item, token, targets = selectedTargets() } = {}) {
  const config = spellFlag(item, "status");
  if (!config?.id) return false;

  const affected = config.target === "self" ? [resolveToken(token)] : targets;
  for (const target of affected) {
    const actor = target.actor ?? target;
    if (!actor) continue;
    const effectData = {
      name: config.label ?? item.name,
      img: item.img,
      origin: item.uuid,
      disabled: false,
      transfer: false,
      statuses: config.core ? (config.ids ?? [config.id]) : [],
      duration: config.duration ?? { rounds: 1, turns: 1 },
      changes: config.changes ?? [],
      flags: {
        dae: { specialDuration: config.specialDuration ?? [] },
        [FLAG_SCOPE]: { sourceSpell: item.name }
      }
    };
    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
  return true;
}

function notify(message) {
  ui.notifications?.info(`${message}`);
}

function gridDistanceToPixels(distance) {
  const gridSize = canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100;
  const gridDistance = canvas.scene?.grid?.distance ?? METERS_PER_GRID_SQUARE;
  return (distance / gridDistance) * gridSize;
}

function feetToPixels(feet) {
  return gridDistanceToPixels(feetToSceneDistance(feet));
}

async function moveToken(target, source, distanceFeet, direction = "toward") {
  const moving = resolveToken(target);
  const anchor = resolveToken(source);
  if (!moving?.document || !anchor) return false;
  const from = moving.center;
  const to = anchor.center;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  const pixels = Math.min(feetToPixels(distanceFeet), length);
  const sign = direction === "away" ? -1 : 1;
  const center = { x: from.x + sign * (dx / length) * pixels, y: from.y + sign * (dy / length) * pixels };
  const topLeft = { x: center.x - moving.w / 2, y: center.y - moving.h / 2 };
  const snapped = canvas.grid?.getSnappedPoint?.(topLeft, { mode: CONST.GRID_SNAPPING_MODES?.CENTER }) ?? topLeft;
  await moving.document.update({ x: snapped.x, y: snapped.y });
  return true;
}

async function scatterToken(target, distanceFeet = 5) {
  const moving = resolveToken(target);
  if (!moving?.document) return false;
  const angle = Math.floor(Math.random() * 8) * (Math.PI / 4);
  const pixels = feetToPixels(distanceFeet);
  const point = { x: moving.document.x + Math.cos(angle) * pixels, y: moving.document.y + Math.sin(angle) * pixels };
  const snapped = canvas.grid?.getSnappedPoint?.(point, { mode: CONST.GRID_SNAPPING_MODES?.CENTER }) ?? point;
  await moving.document.update({ x: snapped.x, y: snapped.y });
  return true;
}

function sceneDistanceBetweenPoints(origin, destination) {
  if (!origin || !destination) return Number.POSITIVE_INFINITY;
  try {
    const measurement = canvas.grid?.measurePath?.([origin, destination]);
    const distance = Number(measurement?.distance);
    if (Number.isFinite(distance)) return distance;
  } catch (error) {
    console.debug(`${MODULE_ID} | Não foi possível medir a distância pela grade.`, error);
  }
  const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100);
  const gridDistance = Number(canvas.scene?.grid?.distance ?? METERS_PER_GRID_SQUARE);
  if (!(gridSize > 0) || !(gridDistance > 0)) return Number.POSITIVE_INFINITY;
  return Math.hypot(Number(destination.x) - Number(origin.x), Number(destination.y) - Number(origin.y))
    / gridSize * gridDistance;
}

// ---------------------------------------------------------------------------
// Invocação móvel: Mage Hand
// ---------------------------------------------------------------------------
// Diferente do objeto estático, a mão é reposicionável e tem coleira: some se passar de 9 metros
// do conjurador (por movimento dela ou dele) e expira em 1 minuto. O marcador é um MeasuredTemplate
// de uma célula, que serve de alça para arrastar; a arte é uma animação persistente do Sequencer.

function mageHandEffectName(sourceTokenId) {
  return `${MODULE_ID}:mage-hand:${sourceTokenId}`;
}

async function endMageHandEffect(markerOrName) {
  const effectName = typeof markerOrName === "string"
    ? markerOrName
    : spellFlag(markerOrName, "effectName");
  if (!effectName) return false;
  try {
    await globalThis.Sequencer?.EffectManager?.endEffects?.({ name: effectName });
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Não foi possível encerrar a animação de Mage Hand.`, error);
    return false;
  }
}

async function playMageHandEffect(item, marker, point = null) {
  const config = spellFlag(item, "animation");
  if (!config || !marker || !globalThis.Sequence) return false;
  const location = point ?? singleGridCellBounds(marker);
  const center = location?.centerX !== undefined
    ? { x: Number(location.centerX), y: Number(location.centerY) }
    : location;
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) return false;

  const effectName = spellFlag(marker, "effectName") ?? mageHandEffectName(spellFlag(marker, "sourceToken"));
  await endMageHandEffect(effectName);
  const layers = config.layers?.length ? config.layers : [config];
  const sequence = new Sequence();
  let effects = 0;
  for (const layer of layers) {
    const file = availableAnimationFile(layer, config);
    if (!file) continue;
    let effect = sequence.effect()
      .file(file)
      .atLocation(center)
      .center()
      .spriteAnchor(0.5)
      .size(Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100))
      .persist()
      .name(effectName)
      .fadeIn(layer.fadeIn ?? config.fadeIn ?? 150)
      .fadeOut(layer.fadeOut ?? config.fadeOut ?? 300);
    if (layer.scale ?? config.scale) effect.scale(layer.scale ?? config.scale);
    if (layer.belowTokens ?? config.belowTokens) effect.belowTokens();
    effects += 1;
  }
  if (!effects) return false;
  await sequence.play();
  return true;
}

async function createMageHandMarker(item, token, center) {
  const source = resolveToken(token);
  if (!source || !canvas.scene || !center) return null;
  const gridDistance = Number(canvas.scene?.grid?.distance ?? METERS_PER_GRID_SQUARE);
  const diagonal = Math.hypot(gridDistance, gridDistance);
  let topLeft = { x: Number(center.x), y: Number(center.y) };
  try {
    topLeft = canvas.grid?.getTopLeftPoint?.(topLeft) ?? topLeft;
  } catch (error) {
    console.debug(`${MODULE_ID} | Mage Hand: não foi possível encaixar a célula na grade.`, error);
  }

  const previous = [...(canvas.scene.templates ?? [])].filter(document =>
    spellFlag(document, "mageHand") === true
    && spellFlag(document, "sourceToken") === source.id
  );
  const seconds = markerDurationSeconds(item) || 60;
  const expiry = Number(game.time?.worldTime ?? 0) + seconds;
  const effectName = mageHandEffectName(source.id);
  const [created] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
    t: "rect",
    user: game.user.id,
    x: Number(topLeft.x),
    y: Number(topLeft.y),
    distance: diagonal,
    direction: 45,
    width: 0,
    fillColor: "#7fb3ff",
    borderColor: "#4f87d9",
    flags: {
      [FLAG_SCOPE]: {
        mageHand: true,
        movableMarker: true,
        moduleMarker: true,
        sourceSpell: item.name,
        sourceItem: item.uuid,
        sourceToken: source.id,
        maxRangeFeet: 30,
        lastValidX: Number(topLeft.x),
        lastValidY: Number(topLeft.y),
        markerExpiry: expiry,
        combatId: game.combat?.id ?? null,
        expiryRound: game.combat ? Number(game.combat.round ?? 0) + Math.ceil(seconds / 6) : null,
        effectName
      }
    }
  }]);
  if (!created) return null;

  // Só remove a mão anterior depois que a nova posição foi criada com sucesso.
  for (const marker of previous) {
    await endMageHandEffect(marker);
    if (canvas.scene.templates?.get(marker.id)) {
      await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [marker.id], {
        [FLAG_SCOPE]: { mageHandReplacement: true }
      });
    }
  }

  await playMageHandEffect(item, created);
  console.log(`${MODULE_ID} | Mage Hand: marcador ${created.id} criado em `
    + `(${Math.round(created.x)}, ${Math.round(created.y)}), alcance máximo 30 pés.`);
  return created;
}

function latestItemTemplate(item) {
  const itemUuid = item?.uuid;
  if (!itemUuid || !canvas.scene) return null;
  const owned = [...(canvas.scene.templates ?? [])].filter(template => {
    const source = template.flags?.dnd5e?.item ?? template._source?.flags?.dnd5e?.item;
    return source === itemUuid;
  });
  if (!owned.length) return null;
  return owned
    .sort((a, b) => Number(a._stats?.createdTime ?? 0) - Number(b._stats?.createdTime ?? 0))
    .at(-1);
}

function workflowTemplate(workflow) {
  if (workflow?.template?.documentName === "MeasuredTemplate") return workflow.template;
  if (workflow?.template?.document?.documentName === "MeasuredTemplate") return workflow.template.document;
  const templateId = workflow?.templateId ?? workflow?.template?.id;
  if (templateId) return canvas.scene?.templates?.get(templateId) ?? null;
  const uuid = workflow?.templateUuids?.[0] ?? workflow?.templateUuid;
  if (uuid && typeof fromUuidSync === "function") return fromUuidSync(uuid) ?? null;
  return latestItemTemplate(workflow?.item);
}

async function markWorkflowTemplate(workflow, flags = {}) {
  const template = workflowTemplate(workflow);
  if (!template) return null;
  await template.update({ [`flags.${FLAG_SCOPE}`]: {
    ...(template.flags?.[FLAG_SCOPE] ?? {}),
    ...flags,
    sourceToken: workflow.token?.id,
    sourceItem: workflow.item?.uuid
  } });
  return template;
}

async function createAmbientLights(token, count = 1, center = null, expirySeconds = 0) {
  const source = resolveToken(token);
  if (!source || !canvas.scene) return [];
  const origin = (center && Number.isFinite(center.x) && Number.isFinite(center.y)) ? center : source.center;
  const radius = feetToPixels(5);
  const previous = canvas.scene.lights?.filter(document =>
    spellFlag(document, "sourceSpell") === "Dancing Lights"
    && spellFlag(document, "sourceToken") === source.id
  ) ?? [];
  if (previous.length) await canvas.scene.deleteEmbeddedDocuments("AmbientLight", previous.map(document => document.id));
  const markerExpiry = expirySeconds ? Number(game.time?.worldTime ?? 0) + expirySeconds : null;
  const data = Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    return {
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * radius,
      config: { dim: feetToSceneDistance(20), bright: feetToSceneDistance(10), color: "#ffd966", alpha: 0.25, animation: { type: "torch", speed: 2, intensity: 2 } },
      flags: { [FLAG_SCOPE]: { temporary: true, moduleMarker: true, markerExpiry, sourceSpell: "Dancing Lights", sourceToken: source.id } }
    };
  });
  return canvas.scene.createEmbeddedDocuments("AmbientLight", data);
}

async function createTemporaryItem(actor, data) {
  if (!actor) return null;
  const old = actor.items?.filter(entry => spellFlag(entry, "temporaryCantrip") === data.name);
  if (old?.length) await actor.deleteEmbeddedDocuments("Item", old.map(entry => entry.id));
  const [created] = await actor.createEmbeddedDocuments("Item", [{
    ...data,
    flags: { ...(data.flags ?? {}), [FLAG_SCOPE]: { temporaryCantrip: data.name } }
  }]);
  return created;
}

async function createMagicStone(actor, img) {
  return createTemporaryItem(actor, {
    name: "Magic Stone (3 pedras)", type: "weapon", img,
    system: {
      weaponType: "simpleR", equipped: false, proficient: true,
      quantity: 3, uses: { value: 3, max: "3", per: "charges", recovery: [] },
      range: { value: 60, long: null, units: "ft" },
      damage: { base: { number: 1, denomination: 6, bonus: "@mod", types: ["bludgeoning"], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null } } },
      activities: {}
    }
  });
}

async function createShillelagh(actor, img) {
  const weapon = actor?.items?.find(entry => entry.type === "weapon" && /club|quarterstaff|clava|bordão/i.test(entry.name));
  const base = weapon?.toObject?.() ?? { type: "weapon", system: { activities: {} } };
  delete base._id;
  base.name = `Shillelagh — ${weapon?.name ?? "bordão"}`;
  base.img = img;
  base.system = foundry.utils.mergeObject(base.system ?? {}, {
    weaponType: "simpleM", equipped: true, proficient: true, quantity: 1, ability: "spellcasting",
    damage: { base: { number: 1, denomination: 8, bonus: "", types: ["bludgeoning"] } }
  }, { inplace: false });
  base.system.properties = [...new Set([...(base.system.properties ?? []), "mgc"])];
  return createTemporaryItem(actor, base);
}

async function useMeleeWeapon(actor) {
  const weapon = actor?.items?.find(entry => entry.type === "weapon" && entry.system?.equipped);
  if (!weapon) {
    ui.notifications?.warn("Equipe uma arma corpo a corpo e conjure novamente.");
    return false;
  }
  await weapon.use?.({}, { configureDialog: true });
  return true;
}

async function sendMessage(target) {
  const actor = target?.actor ?? target;
  const recipients = ChatMessage.getWhisperRecipients?.("GM") ?? [];
  for (const user of game.users ?? []) if (actor?.testUserPermission?.(user, "OWNER")) recipients.push(user);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(), whisper: [...new Set(recipients.map(user => user.id))],
    content: `<p><strong>Message:</strong> o conjurador pode enviar uma mensagem privada ao alvo e receber uma resposta.</p>`
  });
}

function cantripDiceForLevel(level) {
  const value = Number(level) || 0;
  return value >= 17 ? 4 : value >= 11 ? 3 : value >= 5 ? 2 : 1;
}

function casterCantripDice(actor) {
  const level = Number(actor?.system?.details?.level)
    || Math.floor(Number(actor?.system?.details?.cr ?? 0))
    || 1;
  return cantripDiceForLevel(level);
}

function isActiveGMClient() {
  const activeGM = game.users?.activeGM ?? null;
  return !!activeGM && game.user === activeGM;
}

function tokenDocCenter(tokenDoc) {
  const center = tokenDoc?.object?.center;
  if (center) return center;
  const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100);
  return {
    x: Number(tokenDoc?.x ?? 0) + (Number(tokenDoc?.width) || 1) * gridSize / 2,
    y: Number(tokenDoc?.y ?? 0) + (Number(tokenDoc?.height) || 1) * gridSize / 2
  };
}

// O MeasuredTemplate é usado somente para escolher a célula. Depois, a geometria canônica é
// transferida para o efeito de concentração e o template é apagado com noConcentrationCheck.
// Assim, não existe hachura persistente e a área mecânica continua sincronizada com a magia.
function storedPersistentZoneBounds(zone) {
  if (!zone) return null;
  const values = [zone.x, zone.y, zone.width, zone.height].map(Number);
  if (!values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) return null;
  const [x, y, width, height] = values;
  return {
    x,
    y,
    width,
    height,
    centerX: Number.isFinite(Number(zone.centerX)) ? Number(zone.centerX) : x + (width / 2),
    centerY: Number.isFinite(Number(zone.centerY)) ? Number(zone.centerY) : y + (height / 2),
    geometrySource: zone.geometrySource ?? "persistent-zone-flags"
  };
}

function actorsRelevantToPersistentAreas() {
  const actors = new Map();
  for (const tokenDoc of canvas.scene?.tokens ?? []) {
    const actor = tokenDoc.actor;
    if (actor) actors.set(actor.uuid ?? tokenDoc.uuid, actor);
  }
  for (const actor of game.actors ?? []) {
    if (actor) actors.set(actor.uuid, actor);
  }
  return [...actors.values()];
}

function persistentAreaEffectRecords() {
  const records = [];
  const seen = new Set();
  for (const actor of actorsRelevantToPersistentAreas()) {
    for (const effect of actor.effects ?? []) {
      const zone = spellFlag(effect, "persistentZone");
      if (!zone || seen.has(effect.uuid)) continue;
      if (zone.sceneId && zone.sceneId !== canvas.scene?.id) continue;
      const bounds = storedPersistentZoneBounds(zone);
      if (!bounds) continue;
      seen.add(effect.uuid);
      records.push({
        ...zone,
        ...bounds,
        id: effect.uuid,
        effectUuid: effect.uuid
      });
    }
  }
  return records;
}

function persistentAreaZones() {
  const zones = persistentAreaEffectRecords();

  // Objetos estáticos sem concentração ficam hospedados na cena.
  for (const zone of sceneStaticZones()) {
    if (zone.sceneId && zone.sceneId !== canvas.scene?.id) continue;
    const bounds = storedPersistentZoneBounds(zone);
    if (bounds) zones.push({ ...zone, ...bounds, host: "scene" });
  }

  // Compatibilidade com áreas criadas por builds anteriores: elas continuam funcionando até
  // a concentração terminar, mas novas áreas deixam de depender do MeasuredTemplate visível.
  for (const template of canvas.scene?.templates ?? []) {
    const zone = spellFlag(template, "persistentZone");
    if (!zone) continue;
    const bounds = storedPersistentZoneBounds(zone)
      ?? templateCellBounds(template, { singleGridCell: zone.singleGridCell === true });
    if (bounds) zones.push({ ...zone, ...bounds, id: template.id });
  }
  return zones;
}

async function clearLegacyPersistentAreaZones() {
  if (!isActiveGMClient()) return;
  if (!canvas.scene?.flags?.[FLAG_SCOPE]?.persistentAreas) return;
  await canvas.scene.update({ [`flags.${FLAG_SCOPE}.-=persistentAreas`]: null });
}

function zoneContainsPoint(zone, point) {
  if (!zone || !point) return false;
  const x = Number(point.x);
  const y = Number(point.y);
  return x >= Number(zone.x) && x < Number(zone.x) + Number(zone.width)
    && y >= Number(zone.y) && y < Number(zone.y) + Number(zone.height);
}

function validCanvasBounds(bounds) {
  if (!bounds) return false;
  return [bounds.x, bounds.y, bounds.width, bounds.height].every(value => Number.isFinite(Number(value)))
    && Number(bounds.width) > 0
    && Number(bounds.height) > 0;
}

// Retorna exatamente a célula escolhida. Isso evita usar `object.bounds`, que também pode
// englobar régua, ícone de controle e outros elementos do MeasuredTemplate, produzindo uma
// área muito maior do que as hachuras visíveis.
function singleGridCellBounds(templateDoc) {
  const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100);
  const rawPoint = { x: Number(templateDoc?.x), y: Number(templateDoc?.y) };
  if (!Number.isFinite(rawPoint.x) || !Number.isFinite(rawPoint.y) || !(gridSize > 0)) return null;

  let topLeft = rawPoint;
  try {
    topLeft = canvas.grid?.getTopLeftPoint?.(rawPoint) ?? rawPoint;
  } catch (error) {
    console.debug(`${MODULE_ID} | Não foi possível reenquadrar a origem da célula; usando x/y do template.`, error);
  }

  const x = Number(topLeft.x);
  const y = Number(topLeft.y);
  return {
    x,
    y,
    width: gridSize,
    height: gridSize,
    centerX: x + (gridSize / 2),
    centerY: y + (gridSize / 2),
    geometrySource: "single-grid-cell"
  };
}

// Para áreas de uma célula, a grade é a autoridade. Para outras áreas, priorizamos os dados do
// documento/shape e nunca `object.bounds`, pois esse último pode incluir controles do template.
function templateCellBounds(templateDoc, { singleGridCell = false } = {}) {
  if (singleGridCell) return singleGridCellBounds(templateDoc);

  const x = Number(templateDoc?.x);
  const y = Number(templateDoc?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100);
  const gridDistance = Number(canvas.scene?.grid?.distance ?? METERS_PER_GRID_SQUARE) || METERS_PER_GRID_SQUARE;
  const widthUnits = Number(templateDoc?.width ?? templateDoc?._source?.width);
  const heightUnits = Number(templateDoc?.height ?? templateDoc?._source?.height);

  // Para retângulos, width/height refletem a geometria final e têm prioridade sobre distance.
  if (templateDoc?.t === "rect" && Number.isFinite(widthUnits) && widthUnits > 0) {
    const width = (widthUnits / gridDistance) * gridSize;
    const height = (Number.isFinite(heightUnits) && heightUnits > 0
      ? heightUnits
      : widthUnits) / gridDistance * gridSize;
    return {
      x,
      y,
      width,
      height,
      centerX: x + (width / 2),
      centerY: y + (height / 2),
      geometrySource: "document.width-height"
    };
  }

  // Fallback para a forma local, sem usar os limites globais do placeable.
  try {
    const shapeBounds = templateDoc?.object?.shape?.getBounds?.();
    if (validCanvasBounds(shapeBounds)) {
      const shapeX = x + Number(shapeBounds.x);
      const shapeY = y + Number(shapeBounds.y);
      const width = Number(shapeBounds.width);
      const height = Number(shapeBounds.height);
      return {
        x: shapeX,
        y: shapeY,
        width,
        height,
        centerX: shapeX + (width / 2),
        centerY: shapeY + (height / 2),
        geometrySource: "object.shape"
      };
    }
  } catch (error) {
    console.debug(`${MODULE_ID} | Não foi possível ler a forma local do template.`, error);
  }

  // Último fallback para documentos antigos que só tenham distance.
  const distance = Number(templateDoc?.distance);
  const side = (templateDoc?.t === "rect" && Number.isFinite(distance) && distance > 0)
    ? (distance / Math.SQRT2 / gridDistance) * gridSize
    : gridSize;
  return {
    x,
    y,
    width: side,
    height: side,
    centerX: x + (side / 2),
    centerY: y + (side / 2),
    geometrySource: "document.distance-fallback"
  };
}

async function normalizePlacedSingleGridCellTemplate(template) {
  if (!template) return null;
  const gridDistance = Number(canvas.scene?.grid?.distance);
  if (!Number.isFinite(gridDistance) || gridDistance <= 0) return template;
  const diagonal = Math.hypot(gridDistance, gridDistance);
  const needsUpdate = template.t !== "rect"
    || !sameDistance(template.distance, diagonal, 0.001)
    || Number(template.direction) !== 45
    || Number(template.width ?? 0) !== 0;
  if (needsUpdate) {
    await template.update({
      t: "rect",
      distance: diagonal,
      direction: 45,
      width: 0
    }, { [FLAG_SCOPE]: { singleGridCellNormalization: true } });
  }
  console.log(`${MODULE_ID} | template final ${template.id} normalizado: lado ${gridDistance}`
    + ` ${canvas.scene?.grid?.units ?? ""}, diagonal ${diagonal}.`);
  return template;
}

function effectMatchesItem(effect, item) {
  if (!effect || !item?.uuid) return false;
  const identifiers = [
    effect.origin,
    effect.flags?.dnd5e?.itemUuid,
    effect._source?.flags?.dnd5e?.itemUuid
  ].filter(Boolean).map(String);
  return identifiers.some(identifier => identifier === item.uuid
    || identifier.startsWith(`${item.uuid}.`)
    || item.uuid.startsWith(`${identifier}.`));
}

async function resolvePersistentAreaConcentrationEffect(template, item, actor) {
  const dependentOn = template?.getFlag?.("dnd5e", "dependentOn")
    ?? template?.flags?.dnd5e?.dependentOn
    ?? template?._source?.flags?.dnd5e?.dependentOn;
  if (dependentOn) {
    try {
      const parent = typeof fromUuid === "function" ? await fromUuid(dependentOn) : fromUuidSync?.(dependentOn);
      if (parent?.documentName === "ActiveEffect") return parent;
    } catch (error) {
      console.debug(`${MODULE_ID} | Não foi possível resolver o efeito pai ${dependentOn}.`, error);
    }
  }

  const candidates = new Map();
  for (const effect of actor?.concentration?.effects ?? []) candidates.set(effect.uuid, effect);
  for (const effect of actor?.effects ?? []) candidates.set(effect.uuid, effect);
  return [...candidates.values()].find(effect => effectMatchesItem(effect, item)) ?? null;
}

async function persistAreaOnConcentration(template, item, actor, zone) {
  let effect = null;
  for (const delay of [0, 50, 150, 300]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    effect = await resolvePersistentAreaConcentrationEffect(template, item, actor);
    if (effect) break;
  }
  if (!effect) return null;

  const persistentZone = {
    ...zone,
    sceneId: canvas.scene?.id,
    sourceItem: item?.uuid
  };
  await effect.update({
    [`flags.${FLAG_SCOPE}.persistentZone`]: persistentZone,
    [`flags.${FLAG_SCOPE}.sourceItem`]: item?.uuid,
    [`flags.${FLAG_SCOPE}.sourceSpell`]: zone.sourceSpell ?? item?.name
  });
  return { ...persistentZone, id: effect.uuid, effectUuid: effect.uuid };
}

async function deleteTransferredPlacementTemplate(template) {
  if (!template || !canvas.scene?.templates?.get(template.id)) return true;
  await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [template.id], {
    // Midi-QOL verifica explicitamente esta opção antes de remover o efeito de concentração.
    noConcentrationCheck: true,
    [FLAG_SCOPE]: { persistentZoneTransferred: true }
  });
  console.log(`${MODULE_ID} | template de posicionamento ${template.id} removido com `
    + `noConcentrationCheck; área mantida no efeito de concentração.`);
  return true;
}

async function markPersistentAreaTemplate(workflow, item, zoneData = {}, style = {}) {
  const template = workflowTemplate(workflow);
  if (template && zoneData.singleGridCell === true) await normalizePlacedSingleGridCellTemplate(template);
  const bounds = template ? templateCellBounds(template, { singleGridCell: zoneData.singleGridCell === true }) : null;
  if (!template || !bounds) return null;
  const seconds = markerDurationSeconds(item);
  const zone = {
    ...zoneData,
    sourceItem: item?.uuid,
    expiry: seconds ? Number(game.time?.worldTime ?? 0) + seconds : null,

    // Persiste a geometria antes de transferi-la ao efeito de concentração e apagar o template.
    // Assim, movimentação, salvaguardas e animação usam a célula escolhida originalmente.
    x: Number(bounds.x),
    y: Number(bounds.y),
    width: Number(bounds.width),
    height: Number(bounds.height),
    centerX: Number(bounds.centerX ?? (Number(bounds.x) + Number(bounds.width) / 2)),
    centerY: Number(bounds.centerY ?? (Number(bounds.y) + Number(bounds.height) / 2)),
    geometrySource: bounds.geometrySource ?? "stored-before-transfer"
  };
  const update = {
    [`flags.${FLAG_SCOPE}.persistentZone`]: zone,
    [`flags.${FLAG_SCOPE}.sourceSpell`]: zoneData.sourceSpell ?? item?.name,
    [`flags.${FLAG_SCOPE}.sourceItem`]: item?.uuid,
    [`flags.${FLAG_SCOPE}.sourceToken`]: zoneData.sourceToken ?? null,
    [`flags.${FLAG_SCOPE}.moduleMarker`]: true,
    [`flags.${FLAG_SCOPE}.markerExpiry`]: zone.expiry
  };
  if (style.fillColor) update.fillColor = style.fillColor;
  if (style.borderColor) update.borderColor = style.borderColor;
  await template.update(update);
  console.log(`${MODULE_ID} | ${item?.name}: template ${template.id} t=${template.t}`
    + ` x=${Math.round(Number(template.x))} y=${Math.round(Number(template.y))}`
    + ` distance=${template.distance} width=${template.width} height=${template.height}`
    + ` direction=${template.direction}; grade ${canvas.grid?.size}px = `
    + `${canvas.scene?.grid?.distance}${canvas.scene?.grid?.units ?? ""}; área visual `
    + `${Math.round(bounds.width)}x${Math.round(bounds.height)}px via ${bounds.geometrySource}.`);
  return { ...zone, ...bounds, id: template.id };
}

// No dnd5e 5.x `system.abilities.<hab>.save` é um objeto (`{ value, proficient, ... }`),
// não um número: somar direto produzia "1d20 + NaN" e derrubava a rolagem no fallback manual.
function abilitySaveBonus(actor, ability) {
  const save = actor?.system?.abilities?.[ability]?.save;
  const value = Number(save?.value ?? save);
  return Number.isFinite(value) ? value : 0;
}

async function rollPersistentAreaSave(actor, ability, dc) {
  try {
    const rolls = await actor?.rollSavingThrow?.(
      { ability, target: dc },
      { configure: false },
      { data: { speaker: ChatMessage.getSpeaker({ actor }) } }
    );
    const roll = Array.isArray(rolls) ? rolls[0] : rolls;
    const total = Number(roll?.total);
    if (Number.isFinite(total)) return { total, success: roll.isSuccess ?? (total >= dc), systemCard: true };
  } catch (error) {
    console.warn(`${MODULE_ID} | rollSavingThrow indisponível; usando rolagem simples.`, error);
  }
  const bonus = abilitySaveBonus(actor, ability);
  const roll = await new Roll(`1d20 + ${bonus}`).evaluate();
  const total = Number(roll.total);
  return { total, success: total >= dc, systemCard: false, formula: `1d20+${bonus}` };
}

async function triggerPersistentAreaSave(zone, tokenDoc, reason) {
  const config = zone?.recurringSave;
  const actor = tokenDoc?.actor;
  if (!config || !actor) return false;
  const label = zone?.sourceSpell ?? "Área persistente";
  const ability = String(config.ability ?? "dex");
  const dc = Number(config.dc) || 10;
  const damageType = config.damageType ?? "fire";
  try {
    const { total, success, systemCard, formula } = await rollPersistentAreaSave(actor, ability, dc);
    let damageTotal = 0;
    if (!success || config.onSave === "half") {
      const damageRoll = await new Roll(String(config.damageFormula ?? "1d8")).evaluate();
      damageTotal = success ? Math.floor(Number(damageRoll.total) / 2) : Number(damageRoll.total);
      if (damageTotal > 0) await actor.applyDamage?.([{ value: damageTotal, type: damageType }]);
    }
    const concentrating = (actor.concentration?.effects?.size ?? 0) > 0;
    const outcome = success
      ? (damageTotal ? `sucesso, ${damageTotal} de dano de ${damageType} (metade)` : "sucesso, sem dano")
      : `falha, ${damageTotal} de dano de ${damageType}`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><strong>${label}</strong> — ${actor.name} ${reason}.</p>`
        + `<p>Salvaguarda de ${ability.toUpperCase()}: ${systemCard ? "" : `${formula} = `}`
        + `<strong>${total}</strong> vs CD ${dc} — ${outcome}.</p>`
        + (damageTotal && concentrating
          ? `<p><em>${actor.name} sofreu dano enquanto se concentra — o teste de concentração vem do sistema; `
            + `falhar nele encerra a magia e apaga a área.</em></p>`
          : ""),
      flags: { [FLAG_SCOPE]: { persistentAreaResult: true } }
    });
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | ${label}: não foi possível resolver a salvaguarda recorrente automaticamente.`, error);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><strong>${label}</strong>: ${actor?.name ?? "a criatura"} ${reason}. Role a salvaguarda de `
        + `${ability.toUpperCase()} (CD ${dc}) e aplique ${config.damageFormula ?? "1d8"} de ${config.damageType ?? "fire"} na falha.</p>`
    }).catch(() => {});
    return false;
  }
}

async function handlePersistentAreaMovement(tokenDoc, changes) {
  if (!isActiveGMClient()) return true;
  if (!("x" in changes) && !("y" in changes)) return true;
  const zones = persistentAreaZones();
  if (!zones.length) return true;
  const center = tokenDocCenter(tokenDoc);
  for (const zone of zones) {
    if (!zoneTriggers(zone).includes("enter")) continue;
    if (!zoneContainsPoint(zone, center)) continue;
    let hits = PERSISTENT_AREA_TURN_HITS.get(zone.id);
    if (!hits) { hits = new Set(); PERSISTENT_AREA_TURN_HITS.set(zone.id, hits); }
    if (hits.has(tokenDoc.id)) continue;
    hits.add(tokenDoc.id);
    await triggerPersistentAreaSave(zone, tokenDoc, "entrou na área pela primeira vez neste turno");
  }
  return true;
}

// O texto de 2014 varia por magia: a fogueira queima quem TERMINA o turno nela, enquanto
// Moonbeam e Cloud of Daggers pegam quem COMEÇA. Por isso o gatilho é declarado por magia.
async function fireZoneTurnTrigger(zones, tokenId, trigger, reason) {
  if (!tokenId || !zones.length) return;
  const tokenDoc = canvas.scene?.tokens?.get(tokenId);
  if (!tokenDoc) return;
  const center = tokenDocCenter(tokenDoc);
  for (const zone of zones) {
    if (!zoneTriggers(zone).includes(trigger)) continue;
    if (zoneContainsPoint(zone, center)) await triggerPersistentAreaSave(zone, tokenDoc, reason);
  }
}

async function handlePersistentAreaTurn(combat, changed) {
  if (!isActiveGMClient()) return true;
  if (!("turn" in changed) && !("round" in changed)) return true;
  const endedTokenId = PERSISTENT_AREA_ACTIVE_TOKEN;
  PERSISTENT_AREA_TURN_HITS.clear();
  const zones = persistentAreaZones();
  await fireZoneTurnTrigger(zones, endedTokenId, "endTurn", "terminou o turno na área");
  PERSISTENT_AREA_ACTIVE_TOKEN = combat.combatant?.tokenId ?? null;
  await fireZoneTurnTrigger(zones, PERSISTENT_AREA_ACTIVE_TOKEN, "startTurn", "começou o turno na área");
  return true;
}

function handlePersistentAreaCombatStart(combat) {
  if (isActiveGMClient()) PERSISTENT_AREA_ACTIVE_TOKEN = combat.combatant?.tokenId ?? null;
  return true;
}

const MARKER_DURATION_UNITS = { round: 6, turn: 6, minute: 60, hour: 3600, day: 86400 };

function markerDurationSeconds(item) {
  const duration = item?.system?.duration ?? {};
  const perUnit = MARKER_DURATION_UNITS[duration.units];
  const value = Number(duration.value);
  if (!perUnit || !Number.isFinite(value) || value <= 0) return 0;
  return perUnit * value;
}

// Devolve `null` quando não há ponto válido. Cair na posição do conjurador era pior que falhar:
// colocava o marcador em cima de quem conjurou, fora do alcance pretendido.
async function markerLocation(source, rangeFt = 30) {
  const maximumRange = rangeFt ? feetToSceneDistance(rangeFt) : null;
  const targeted = [...(game.user?.targets ?? [])][0];
  if (targeted?.center) {
    const targetDistance = sceneDistanceBetweenPoints(source.center, targeted.center);
    if (!maximumRange || targetDistance <= maximumRange) return targeted.center;
    ui.notifications?.warn(`O alvo selecionado está além do alcance de ${rangeFt} pés; escolha outro ponto.`);
  }
  const crosshair = globalThis.Sequencer?.Crosshair;
  if (crosshair?.show) {
    try {
      const picked = await crosshair.show({
        gridHighlight: true,
        location: { obj: source, limitMaxRange: maximumRange, showRange: true }
      });
      if (picked && Number.isFinite(picked.x) && Number.isFinite(picked.y)) {
        const pickedDistance = sceneDistanceBetweenPoints(source.center, picked);
        if (!maximumRange || pickedDistance <= maximumRange) return { x: picked.x, y: picked.y };
        ui.notifications?.warn(`O ponto escolhido está além do alcance de ${rangeFt} pés.`);
        return null;
      }
    } catch (error) {
      console.warn(`${MODULE_ID} | Seleção de ponto via Crosshair falhou.`, error);
    }
  }
  notify("Não foi possível selecionar um ponto válido para o marcador.");
  return null;
}

async function applyMarkerLifecycle(document, item, { fillColor = null, borderColor = null } = {}) {
  if (!document) return document;
  try {
    const seconds = markerDurationSeconds(item);
    const update = {
      [`flags.${FLAG_SCOPE}.markerExpiry`]: seconds ? Number(game.time?.worldTime ?? 0) + seconds : null,
      [`flags.${FLAG_SCOPE}.moduleMarker`]: true
    };
    if (document.documentName === "MeasuredTemplate") {
      if (fillColor) update.fillColor = fillColor;
      if (borderColor) update.borderColor = borderColor;
    }
    await document.update(update);
  } catch (error) {
    console.warn(`${MODULE_ID} | Não foi possível agendar o ciclo de vida do marcador.`, error);
  }
  return document;
}

async function purgeExpiredMarkers() {
  if (!isActiveGMClient() || !canvas.scene) return true;
  const now = Number(game.time?.worldTime ?? 0);
  const isExpired = document => {
    const expiry = spellFlag(document, "markerExpiry");
    return Number.isFinite(Number(expiry)) && now >= Number(expiry);
  };
  const templates = [...(canvas.scene.templates ?? [])].filter(isExpired);
  for (const template of templates) {
    if (spellFlag(template, "mageHand") === true) await endMageHandEffect(template);
    else {
      const sourceItem = spellFlag(template, "sourceItem");
      if (sourceItem) await endPersistentAreaEffect(sourceItem);
    }
    PERSISTENT_AREA_TURN_HITS.delete(template.id);
  }
  if (templates.length) await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", templates.map(template => template.id));
  const lights = [...(canvas.scene.lights ?? [])].filter(isExpired);
  if (lights.length) await canvas.scene.deleteEmbeddedDocuments("AmbientLight", lights.map(light => light.id));

  // Objetos estáticos hospedados na cena expiram por duração; tiles e paredes caem junto.
  const sceneZones = sceneStaticZones();
  const expired = sceneZones.filter(zone => Number.isFinite(Number(zone.expiry)) && now >= Number(zone.expiry));
  for (const zone of expired) {
    if (zone.sourceItem) await endPersistentAreaEffect(zone.sourceItem);
    await removeStaticObjectPlaceables({ zoneKey: zone.id, sourceItem: zone.sourceItem });
    PERSISTENT_AREA_TURN_HITS.delete(zone.id);
  }
  if (expired.length) await writeSceneStaticZones(sceneZones.filter(zone => !expired.includes(zone)));
  const orphanTiles = [...(canvas.scene.tiles ?? [])].filter(isExpired);
  if (orphanTiles.length) await canvas.scene.deleteEmbeddedDocuments("Tile", orphanTiles.map(tile => tile.id));
  const orphanWalls = [...(canvas.scene.walls ?? [])].filter(isExpired);
  if (orphanWalls.length) await canvas.scene.deleteEmbeddedDocuments("Wall", orphanWalls.map(wall => wall.id));
  return true;
}

function persistentAreaAnimationPoint(zone) {
  if (!zone) return null;
  const centerX = Number(zone.centerX);
  const centerY = Number(zone.centerY);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return { x: centerX, y: centerY };
  }
  const x = Number(zone.x);
  const y = Number(zone.y);
  const width = Number(zone.width);
  const height = Number(zone.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x: x + (width / 2), y: y + (height / 2) };
}

async function playPersistentAreaEffect(item, zone, animationPoint = null) {
  const config = spellFlag(item, "animation");
  const location = animationPoint ?? persistentAreaAnimationPoint(zone);
  if (!config || !zone || !location || !globalThis.Sequence) return false;
  const file = availableAnimationFile(config, config);
  if (!file) return false;
  try {
    await endPersistentAreaEffect(item.uuid);
    const sequence = new Sequence();
    const effectSize = persistentAreaSpriteSize(zone, config);
    const effect = sequence.effect()
      .file(file)
      .atLocation(location, { cacheLocation: true })
      .center()
      .spriteAnchor(0.5)
      .size(effectSize)
      .persist()
      .name(`${MODULE_ID}:${item.uuid}`)
      .fadeIn(config.fadeIn ?? 150)
      .fadeOut(config.fadeOut ?? 300);

    // Não aplique `config.scale` aqui. `.size()` já fixa o quadro da animação ao tamanho real
    // da célula; aplicar o scale genérico depois multiplicava o tamanho uma segunda vez.
    // Para ajuste específico de uma área persistente, use somente `animation.areaScale`.
    if (config.belowTokens) effect.belowTokens();
    await sequence.play();
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | A animação persistente de ${item.name} não pôde ser reancorada.`, error);
    return false;
  }
}

// A animação deve LER como o quadrado, e `.size()` dimensiona o quadro do vídeo, não a chama:
// assets JB2A trazem margem transparente, então a arte visível fica menor que a área. Este fator
// compensa essa margem — 1 = quadro do tamanho exato da célula. Ajuste ao vivo com
// game.modules.get("meu-modulo-feiticos").api.setPersistentAreaScale(1.3)
// e, quando achar o valor certo, ele vira `animation.areaScale` no override da magia.
function persistentAreaSpriteSize(zone, config) {
  const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100);
  const measuredSide = Math.max(Number(zone.width), Number(zone.height));
  const side = zone?.singleGridCell === true ? gridSize : measuredSide;

  // O arquivo da fogueira possui uma margem transparente grande. O quadro precisa ser maior
  // que a célula para que a arte visível ocupe aproximadamente o quadrado, mas a posição e a
  // área mecânica continuam sendo exatamente uma célula. O fator específico pode ser ajustado
  // em `visualScale`; o override da API continua tendo prioridade para testes ao vivo.
  let scale;
  if (zone?.singleGridCell === true) {
    const requested = Number(PERSISTENT_AREA_SCALE_OVERRIDE ?? zone?.visualScale ?? 1.8);
    scale = Number.isFinite(requested) ? Math.min(2.4, Math.max(1, requested)) : 1.8;
  } else {
    scale = Number(PERSISTENT_AREA_SCALE_OVERRIDE ?? config?.areaScale ?? 1) || 1;
  }

  const size = side * scale;
  console.log(`${MODULE_ID} | animação de área: base ${Math.round(side)}px × fator ${scale}`
    + ` = ${Math.round(size)}px; geometria ${zone?.geometrySource ?? "desconhecida"}.`);
  return size;
}

async function setPersistentAreaScale(scale = null) {
  PERSISTENT_AREA_SCALE_OVERRIDE = scale === null ? null : Number(scale);
  let replayed = 0;
  for (const zone of persistentAreaZones()) {
    const item = zone.sourceItem ? await fromUuid(zone.sourceItem) : null;
    if (!item) continue;
    if (await playPersistentAreaEffect(item, zone)) replayed += 1;
  }
  ui.notifications?.info(`Fator da animação de área: ${PERSISTENT_AREA_SCALE_OVERRIDE ?? "padrão da magia"}`
    + ` (${replayed} área(s) redesenhada(s)).`);
  return PERSISTENT_AREA_SCALE_OVERRIDE;
}

async function endPersistentAreaEffect(sourceItem) {
  try {
    await globalThis.Sequencer?.EffectManager?.endEffects?.({ name: `${MODULE_ID}:${sourceItem}` });
  } catch (error) {
    console.warn(`${MODULE_ID} | Não foi possível encerrar a animação persistente.`, error);
  }
}

// ---------------------------------------------------------------------------
// Objetos estáticos: zonas persistentes, tiles e barreiras
// ---------------------------------------------------------------------------
// Generalização do fluxo validado no Create Bonfire: o MeasuredTemplate serve só para escolher o
// lugar; a geometria vai para um hospedeiro durável (o efeito de concentração quando a magia
// concentra, senão as flags da cena) e o template é apagado com noConcentrationCheck. Tile e
// paredes são opcionais e declarados por magia — nada disso liga para quem não pede.
//
// Declarar em `flags["foundry-spell-pack"].staticObject` no override da magia:
// {
//   "shape": "cell" | "template",       // cell = normaliza para um quadrado
//   "anchor": "concentration" | "duration",
//   "visualScale": 1.8,
//   "fillColor": "#ff7a1a", "borderColor": "#ff3b00",
//   "recurringSave": { "ability": "dex", "damageFormula": "2d4", "damageType": "piercing",
//                      "onSave": "none", "triggers": ["enter", "startTurn"] },
//   "tile": { "texture": "modules/.../teia.webp", "alpha": 0.9, "scale": 1 },
//   "walls": { "move": true, "sight": false }
// }

function staticObjectSpec(item) {
  const spec = spellFlag(item, "staticObject");
  return spec && typeof spec === "object" ? spec : null;
}

function itemConcentrates(item) {
  const properties = item?.system?.properties;
  if (properties?.has) return properties.has("concentration");
  if (Array.isArray(properties)) return properties.includes("concentration");
  return item?.system?.duration?.concentration === true;
}

function buildRecurringSave(spec, actor) {
  if (!spec) return null;
  const declaredDc = Number(spec.dc);
  const damageFormula = spec.damageFormula
    ?? (spec.cantripScaling ? `${casterCantripDice(actor)}d${Number(spec.damageDie) || 8}` : null);
  return {
    ability: spec.ability ?? "dex",
    dc: Number.isFinite(declaredDc) && declaredDc > 0
      ? declaredDc
      : (Number(actor?.system?.attributes?.spelldc) || 10),
    damageFormula,
    damageType: spec.damageType ?? "fire",
    onSave: spec.onSave ?? "none",
    triggers: Array.isArray(spec.triggers) && spec.triggers.length ? spec.triggers : ["enter", "endTurn"]
  };
}

function zoneTriggers(zone) {
  const triggers = zone?.recurringSave?.triggers;
  return Array.isArray(triggers) && triggers.length ? triggers : ["enter", "endTurn"];
}

// Magias sem concentração (Grease, por exemplo) não têm efeito onde pendurar a área, então a
// cena vira o hospedeiro. A expiração por duração continua valendo em `purgeExpiredMarkers`.
function sceneStaticZones() {
  const zones = canvas.scene?.flags?.[FLAG_SCOPE]?.staticZones;
  return Array.isArray(zones) ? zones : [];
}

async function writeSceneStaticZones(zones) {
  if (!canvas.scene) return;
  await canvas.scene.update({ [`flags.${FLAG_SCOPE}.staticZones`]: zones });
}

async function anchorStaticZone(template, item, actor, zone, spec) {
  if (spec?.anchor !== "duration" && itemConcentrates(item)) {
    const persisted = await persistAreaOnConcentration(template, item, actor, zone);
    if (persisted) return persisted;
    if (spec?.requireConcentration !== false) return null;
  }
  const stored = {
    ...zone,
    id: foundry.utils.randomID(),
    sceneId: canvas.scene?.id,
    host: "scene"
  };
  await writeSceneStaticZones([...sceneStaticZones(), stored]);
  return stored;
}

async function createStaticTile(item, zone, spec) {
  if (!spec?.texture || !canvas.scene) return null;
  const scale = Number(spec.scale) > 0 ? Number(spec.scale) : 1;
  const width = Number(zone.width) * scale;
  const height = Number(zone.height) * scale;
  if (!(width > 0) || !(height > 0)) return null;
  const data = {
    texture: { src: spec.texture },
    x: Number(zone.centerX) - (width / 2),
    y: Number(zone.centerY) - (height / 2),
    width,
    height,
    alpha: Number.isFinite(Number(spec.alpha)) ? Number(spec.alpha) : 1,
    hidden: spec.hidden === true,
    flags: { [FLAG_SCOPE]: {
      staticObject: true,
      zoneKey: zone.id,
      sourceItem: item?.uuid,
      sourceSpell: item?.name,
      markerExpiry: zone.expiry ?? null
    } }
  };
  if (Number.isFinite(Number(spec.elevation))) data.elevation = Number(spec.elevation);
  const [created] = await canvas.scene.createEmbeddedDocuments("Tile", [data]);
  return created ?? null;
}

function wallRestriction(value) {
  const types = CONST?.WALL_SENSE_TYPES ?? {};
  if (value === "limited") return types.LIMITED ?? 10;
  if (value === true || value === "normal") return types.NORMAL ?? 20;
  return types.NONE ?? 0;
}

async function createStaticWalls(item, zone, spec) {
  if (!spec || !canvas.scene || !validCanvasBounds(zone)) return [];
  const { x, y, width, height } = zone;
  const corners = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
  const base = {
    move: spec.move === false ? (CONST?.WALL_MOVEMENT_TYPES?.NONE ?? 0) : (CONST?.WALL_MOVEMENT_TYPES?.NORMAL ?? 20),
    sight: wallRestriction(spec.sight),
    sound: wallRestriction(spec.sound),
    light: wallRestriction(spec.light),
    flags: { [FLAG_SCOPE]: {
      staticObject: true,
      zoneKey: zone.id,
      sourceItem: item?.uuid,
      sourceSpell: item?.name,
      markerExpiry: zone.expiry ?? null
    } }
  };
  const data = corners.map((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    return { ...base, c: [corner[0], corner[1], next[0], next[1]] };
  });
  return canvas.scene.createEmbeddedDocuments("Wall", data);
}

async function removeStaticObjectPlaceables({ zoneKey = null, sourceItem = null } = {}) {
  if (!canvas.scene || (!zoneKey && !sourceItem)) return { tiles: 0, walls: 0 };
  const matches = document => {
    if (!spellFlag(document, "staticObject")) return false;
    if (zoneKey && spellFlag(document, "zoneKey") === zoneKey) return true;
    return !!sourceItem && spellFlag(document, "sourceItem") === sourceItem;
  };
  const tiles = [...(canvas.scene.tiles ?? [])].filter(matches);
  const walls = [...(canvas.scene.walls ?? [])].filter(matches);
  if (tiles.length) await canvas.scene.deleteEmbeddedDocuments("Tile", tiles.map(tile => tile.id));
  if (walls.length) await canvas.scene.deleteEmbeddedDocuments("Wall", walls.map(wall => wall.id));
  return { tiles: tiles.length, walls: walls.length };
}

async function summonStaticObject({ workflow, item, token, spec = null }) {
  const declared = spec ?? staticObjectSpec(item);
  if (!declared) return null;
  const source = resolveToken(token);
  const caster = source?.actor;

  const zone = await markPersistentAreaTemplate(workflow, item, {
    sourceSpell: item.name,
    sourceToken: source?.id,
    singleGridCell: declared.shape !== "template",
    visualScale: declared.visualScale,
    difficultTerrain: declared.difficultTerrain === true,
    recurringSave: buildRecurringSave(declared.recurringSave, caster)
  }, { fillColor: declared.fillColor, borderColor: declared.borderColor });
  if (!zone) {
    notify(`${item.name}: a área não pôde ser registrada; resolva os efeitos recorrentes manualmente.`);
    return null;
  }

  const template = canvas.scene?.templates?.get(zone.id) ?? workflowTemplate(workflow);
  const host = await anchorStaticZone(template, item, caster, zone, declared);
  if (!host) {
    notify(`${item.name}: não foi possível vincular a área ao efeito de concentração; o template foi mantido para segurança.`);
    return null;
  }

  const animationPoint = persistentAreaAnimationPoint(host);
  try {
    if (declared.tile) await createStaticTile(item, host, declared.tile);
    if (declared.walls) await createStaticWalls(item, host, declared.walls);
  } catch (error) {
    console.warn(`${MODULE_ID} | ${item.name}: tile/paredes do objeto estático não puderam ser criados.`, error);
    notify(`${item.name}: a área ficou de pé, mas o cenário (tile/paredes) falhou; ajuste manualmente.`);
  }

  // O template serviu apenas para o posicionamento; a mecânica já vive no hospedeiro.
  await deleteTransferredPlacementTemplate(template);
  if (!await playPersistentAreaEffect(item, host, animationPoint)) {
    notify(`${item.name}: a área foi registrada, mas a animação não pôde ser criada.`);
  }
  console.log(`${MODULE_ID} | ${item.name}: objeto estático em `
    + `(${Math.round(host.x)}, ${Math.round(host.y)}) ${Math.round(host.width)}x${Math.round(host.height)}px; `
    + `hospedeiro ${host.host === "scene" ? "cena" : host.effectUuid}; `
    + `gatilhos ${zoneTriggers(host).join("+")}; tile: ${!!declared.tile}; paredes: ${!!declared.walls}.`);
  return host;
}

async function runSpecialAutomation({ item, token, targets, workflow }) {
  const source = resolveToken(token);
  const first = targets[0];
  try {
    // Despacho dirigido por dados: qualquer magia que declare `staticObject` no override roda a
    // primitiva sem precisar de um case aqui.
    if (staticObjectSpec(item)) {
      await summonStaticObject({ workflow, item, token: source });
      return true;
    }
    switch (item.name) {
      case "Lightning Lure": if (first) await moveToken(first, source, 10, "toward"); break;
      case "Thorn Whip": if (first) await moveToken(first, source, 10, "toward"); break;
      case "Gust": if (first) await moveToken(first, source, 5, "away"); break;
      case "Infestation": if (first) await scatterToken(first, 5); break;
      // Caso de referência da primitiva de objeto estático. Quando o override da magia declarar
      // `staticObject`, o despacho genérico no topo assume e este case deixa de ser alcançado.
      case "Create Bonfire": {
        await summonStaticObject({ workflow, item, token: source, spec: {
          shape: "cell",
          visualScale: 1.8,
          fillColor: "#ff7a1a",
          borderColor: "#ff3b00",
          recurringSave: {
            ability: "dex",
            cantripScaling: true,
            damageDie: 8,
            damageType: "fire",
            onSave: "none",
            triggers: ["enter", "endTurn"]
          }
        } });
        break;
      }
      case "Dancing Lights": await createAmbientLights(source, 4, await markerLocation(source, 120), markerDurationSeconds(item)); break;
      case "Light": if (first?.document) await first.document.update({ light: { dim: feetToSceneDistance(40), bright: feetToSceneDistance(20), color: "#fff2a8", alpha: 0.25 } }); break;
      case "Produce Flame": {
        if (!source?.document) break;
        const throwing = workflow?.activity?.type === "attack";
        await source.document.update({
          light: throwing
            ? { dim: 0, bright: 0 }
            : { dim: feetToSceneDistance(20), bright: feetToSceneDistance(10), color: "#ff8c32", alpha: 0.2 }
        });
        break;
      }
      case "Magic Stone": await createMagicStone(source?.actor, item.img); break;
      case "Shillelagh": await createShillelagh(source?.actor, item.img); break;
      case "Message": if (first) await sendMessage(first); break;
      case "Mage Hand": {
        const point = await markerLocation(source, 30);
        if (!point) break;
        const marker = await createMageHandMarker(item, source, point);
        if (!marker) notify("Mage Hand: não foi possível criar o marcador móvel.");
        break;
      }
      case "Minor Illusion": await applyMarkerLifecycle(await markWorkflowTemplate(workflow, { sourceSpell: item.name, illusion: true }), item, { fillColor: "#b18cff", borderColor: "#8a5cff" }); break;
      case "Mold Earth":
      case "Shape Water":
      case "Control Flames": await applyMarkerLifecycle(await markWorkflowTemplate(workflow, { sourceSpell: item.name, terrainMarker: true }), item, { fillColor: "#8a6a3a", borderColor: "#5a4020" }); break;
      case "Booming Blade": await useMeleeWeapon(source?.actor); break;
      case "Green-Flame Blade": await useMeleeWeapon(source?.actor); notify("Selecione o alvo secundário do salto de fogo, quando aplicável."); break;
      case "Mending": notify("Mending: selecione ou descreva a ruptura do objeto reparado."); break;
      case "Druidcraft":
      case "Prestidigitation":
      case "Thaumaturgy": notify(`${item.name}: escolha o efeito sensorial descrito no item.`); break;
      case "Encode Thoughts": await createTemporaryItem(source?.actor, { name: "Filamento de pensamento", type: "loot", img: item.img, system: { quantity: 1, description: { value: "Memória codificada por Encode Thoughts." } } }); break;
      default: break;
    }
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Automação especial de ${item.name} não pôde ser concluída.`, error);
    ui.notifications?.warn(`${item.name}: automação parcial; conclua o efeito manualmente.`);
    return false;
  }
}

async function runCantrip(options = {}) {
  const item = options.item ?? globalThis.item;
  const token = options.token ?? options.workflow?.token ?? globalThis.token;
  const macroPass = options.context?.macroPass ?? options.workflow?.macroPass;
  if (!item) return false;
  if (options.workflow?._foundrySpellPackMechanicsHandled) return true;
  const area = spellFlag(item, "automation")?.area;
  if (area?.type === "emanation" && options.workflow?._foundrySpellPackEmanationHandled) {
    return true;
  }
  if (area?.type === "emanation" && macroPass && !["preTargetingV2", "preSave"].includes(macroPass)) return true;
  const emanationTargets = area?.type === "emanation"
    ? await targetEmanation({ item, token, workflow: options.workflow })
    : null;
  const targets = emanationTargets
    ?? affectedTargets(item, options.workflow, options.targets ?? selectedTargets());
  const template = workflowTemplate(options.workflow);
  const deferredPersistentArea = !!template && spellFlag(item, "animation")?.persistent === true;
  // A mão desenha a própria animação no marcador, depois de escolhido o ponto.
  const deferredSpecialAnimation = item.name === "Mage Hand";
  if (!options.workflow?._foundrySpellPackAnimationPlayed && !deferredPersistentArea && !deferredSpecialAnimation) {
    await playAnimation({ item, token, targets, location: template, workflow: options.workflow });
  }
  await applyStatus({ item, token, targets });
  await runSpecialAutomation({ item, token, targets, workflow: options.workflow });
  if (area?.type === "emanation" && options.workflow) {
    options.workflow._foundrySpellPackEmanationHandled = true;
  }
  if (options.workflow) options.workflow._foundrySpellPackMechanicsHandled = true;
  return true;
}

function midiWorkflow(payload) {
  return payload?.workflow ?? payload ?? null;
}

function isModuleCantrip(item) {
  return isModuleSpell(item) && Number(item.system?.level) === 0;
}

function isModuleSpell(item) {
  return item?.type === "spell"
    && !!spellFlag(item, "animation");
}

// Convenção do mundo: 5 pés = 1,5 metro = 1 quadrado. A unidade declarada nos itens pode
// continuar em pés, mas qualquer valor enviado ao canvas precisa estar na unidade da cena.
function feetToSceneDistance(feet) {
  const value = Number(feet);
  if (!Number.isFinite(value)) return value;

  const units = sceneDistanceUnits();
  if (isMetersUnit(units)) {
    return (value / FEET_PER_GRID_SQUARE) * METERS_PER_GRID_SQUARE;
  }
  if (isFeetUnit(units)) return value;

  // Cenas com unidade "quadrado" ou personalizada usam a distância configurada na grade.
  const gridDistance = Number(canvas.scene?.grid?.distance);
  if (Number.isFinite(gridDistance) && gridDistance > 0) {
    return (value / FEET_PER_GRID_SQUARE) * gridDistance;
  }

  // Fallback seguro para este módulo, que opera em metros.
  return (value / FEET_PER_GRID_SQUARE) * METERS_PER_GRID_SQUARE;
}

// A conversão principal ocorre em `forceGridAlignedCubeTemplate`, sobre o `templateData`
// transitório, e uma segunda validação ocorre em `preCreateMeasuredTemplate`. Não mutar
// `activity.target.template` nem `item.system` é essencial:
// o dnd5e re-deriva esses modelos a partir do `_source`, e a marca de "já convertido" não
// sobrevive à re-derivação enquanto o tamanho convertido sobrevive — no lançamento seguinte a
// área era convertida de novo (5 pés → 1 quadrado → 0,2 quadrado).

function restoreSingleCellTemplateSnap(workflow = null) {
  const state = SINGLE_CELL_SNAP_STATE;
  if (!state) return;
  if (workflow && state.workflowId && workflow.id !== state.workflowId) return;
  for (const patch of state.patches) {
    if (patch.hadOwnMethod) patch.target[patch.method] = patch.originalMethod;
    else delete patch.target[patch.method];
  }
  SINGLE_CELL_SNAP_STATE = null;
}

// O alvo de 1 quadrado precisa ancorar no canto superior esquerdo da célula sob o cursor:
// o retângulo do dnd5e cresce para baixo/direita a partir de (x,y). O snap padrão (e o do
// Midi-QOL, em canvas.grid.getSnappedPoint com mode VERTEX) prende no vértice mais próximo,
// então o quadrado cai numa célula vizinha em 3 dos 4 quadrantes. Trocamos os dois pontos de
// entrada de snap enquanto a prévia está aberta para que a célula clicada seja a célula usada.
function activateSingleCellTemplateSnap({ workflowId = null, itemUuid = null } = {}) {
  const layer = canvas?.templates;
  const grid = canvas?.grid;
  if (!layer || !grid?.isSquare) return;
  restoreSingleCellTemplateSnap();
  const patches = [];
  for (const target of [layer, grid]) {
    const originalMethod = target.getSnappedPoint;
    if (typeof originalMethod !== "function") continue;
    patches.push({ target, method: "getSnappedPoint", originalMethod, hadOwnMethod: Object.hasOwn(target, "getSnappedPoint") });
    target.getSnappedPoint = function(point, ...rest) {
      if (!point || !canvas.grid?.isSquare) return originalMethod.call(this, point, ...rest);
      return canvas.grid.getTopLeftPoint({ x: Number(point.x), y: Number(point.y) });
    };
  }
  SINGLE_CELL_SNAP_STATE = { patches, workflowId, itemUuid };
}

// Lê o tamanho do lado a partir do próprio templateData, que já está na escala da cena —
// `activity.target.template.size` continua em pés e misturar os dois dava o cubo de 5 quadrados.
function cubeTemplateSize(templateData) {
  const width = Number(templateData?.width);
  if (Number.isFinite(width) && width > 0) return width;
  const distance = Number(templateData?.distance);
  if (!Number.isFinite(distance) || distance <= 0) return null;
  return Number(templateData?.direction) === 45 ? distance / Math.SQRT2 : distance;
}

function forceGridAlignedCubeTemplate(activity, templateData) {
  if (!isModuleSpell(activity?.item)) return true;
  const gridDistance = Number(canvas.scene?.grid?.distance);
  if (!Number.isFinite(gridDistance) || gridDistance <= 0) return true;

  const declared = activity?.target?.template;
  const targetType = declared?.type;
  const shape = CONFIG.DND5E?.areaTargetTypes?.[targetType]?.template
    ?? (["cube", "square"].includes(targetType) ? "rect" : null);
  if (shape !== "rect") return true;

  // Para retângulos, a fonte declarada é a autoridade. Assim, 5 ft não pode ser interpretado
  // acidentalmente como 5 unidades da cena (e, numa cena de 1 unidade por célula, 5 quadrados).
  // Se não houver tamanho declarado utilizável, mantemos o valor que veio do sistema.
  const declaredSize = distanceToSceneUnits(declared?.size, declared?.units);
  let size = Number.isFinite(declaredSize) && declaredSize > 0
    ? declaredSize
    : cubeTemplateSize(templateData);
  if (size === null || !(size > 0)) return true;

  const singleCell = sameDistance(size, gridDistance);
  if (singleCell) size = gridDistance;
  const diagonal = Math.hypot(size, size);
  templateData.t = "rect";
  templateData.width = 0;
  delete templateData.height;
  templateData.distance = diagonal;
  templateData.direction = 45;
  templateData._foundrySpellPackScaled = true;

  console.log(`${MODULE_ID} | ${activity.item?.name}: alvo ${targetType} ${declared?.size}${declared?.units ?? ""}`
    + ` → lado ${size} un. de cena (grade ${gridDistance}); uma célula: ${singleCell}.`);
  if (singleCell) activateSingleCellTemplateSnap({ itemUuid: activity.item?.uuid });
  return true;
}

function activityTemplateForItem(item, activityId = null) {
  const activities = item?.system?.activities;
  const selected = activityId
    ? (activities?.get?.(activityId) ?? activities?.[activityId])
    : null;
  if (selected?.target?.template) return selected.target.template;
  const values = activities?.values ? [...activities.values()] : Object.values(activities ?? {});
  return values.find(activity => activity?.target?.template)?.target?.template
    ?? item?.system?.target?.template
    ?? item?._source?.system?.target?.template
    ?? null;
}

// Segunda barreira de segurança. Mesmo que uma atualização do dnd5e altere ou deixe de chamar
// `dnd5e.preCreateActivityTemplate`, o documento final ainda é normalizado antes de ser criado.
function normalizeMeasuredTemplateUnits(document, data = {}) {
  const sourceItemUuid = data?.flags?.dnd5e?.item
    ?? data?.flags?.dnd5e?.itemUuid
    ?? document?._source?.flags?.dnd5e?.item
    ?? document?._source?.flags?.dnd5e?.itemUuid
    ?? document?.flags?.dnd5e?.item
    ?? document?.flags?.dnd5e?.itemUuid;
  if (!sourceItemUuid || typeof fromUuidSync !== "function") return true;
  const resolved = fromUuidSync(sourceItemUuid);
  const item = resolved?.type === "spell"
    ? resolved
    : resolved?.item?.type === "spell"
      ? resolved.item
      : resolved?.parent?.type === "spell"
        ? resolved.parent
        : null;
  if (!isModuleSpell(item)) return true;

  const activityId = data?.flags?.dnd5e?.activity
    ?? data?.flags?.dnd5e?.activityId
    ?? document?._source?.flags?.dnd5e?.activity
    ?? document?._source?.flags?.dnd5e?.activityId
    ?? document?.flags?.dnd5e?.activity
    ?? document?.flags?.dnd5e?.activityId;
  const declared = activityTemplateForItem(item, activityId);
  const targetType = declared?.type;
  const shape = CONFIG.DND5E?.areaTargetTypes?.[targetType]?.template
    ?? (["cube", "square"].includes(targetType) ? "rect" : null);
  if (shape !== "rect") return true;

  const side = distanceToSceneUnits(declared?.size, declared?.units);
  if (!Number.isFinite(side) || side <= 0) return true;
  const normalizedSide = sameDistance(side, canvas.scene?.grid?.distance)
    ? Number(canvas.scene.grid.distance)
    : side;
  document.updateSource({
    t: "rect",
    width: 0,
    distance: Math.hypot(normalizedSide, normalizedSide),
    direction: 45
  });
  return true;
}

function restoreSingleCellSnapForCreatedArea(document) {
  const state = SINGLE_CELL_SNAP_STATE;
  if (!state) return true;
  const sourceItem = document?.flags?.dnd5e?.item
    ?? document?._source?.flags?.dnd5e?.item;
  const isMeasuredTemplate = document?.flags?.core?.MeasuredTemplate === true
    || document?._source?.flags?.core?.MeasuredTemplate === true;
  if (sourceItem === state.itemUuid || isMeasuredTemplate) restoreSingleCellTemplateSnap();
  return true;
}

function spellRangeDistance(workflow) {
  const range = workflow.activity?.range?.override ? workflow.activity.range : workflow.item?.system?.range;
  if (!range || range.units === "self") return null;
  if (range.units === "touch") return feetToSceneDistance(5);
  const value = Number(range.value);
  if (!Number.isFinite(value)) return null;
  return isFeetUnit(range.units) ? feetToSceneDistance(value) : value;
}

async function showTemporarySpellArea(workflow) {
  if (workflow._foundrySpellPackAreaId || workflow.activity?.target?.template?.type) return;
  const source = resolveToken(workflow.token);
  const area = spellFlag(workflow.item, "automation")?.area;
  const range = area?.type === "emanation"
    ? Number(canvas.scene?.grid?.distance ?? METERS_PER_GRID_SQUARE) * Number(area.radiusSquares ?? 1)
    : spellRangeDistance(workflow);
  if (!source || !Number.isFinite(range) || range <= 0 || !canvas.scene) return;
  const [created] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
    t: "circle", user: game.user.id, x: source.center.x, y: source.center.y,
    distance: range, direction: 0, fillColor: "#d6b45a", borderColor: "#f4df91",
    flags: { [FLAG_SCOPE]: { temporarySpellArea: true, workflowId: workflow.id } }
  }]);
  workflow._foundrySpellPackAreaId = created?.id;
}

async function removeTemporarySpellArea(workflow) {
  const id = workflow?._foundrySpellPackAreaId;
  if (!id || !canvas.scene) return;
  if (canvas.scene.templates?.has(id)) await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [id]);
  delete workflow._foundrySpellPackAreaId;
}

async function repositionTemporarySpellArea(workflow, target, distance) {
  if (!canvas.scene || !target) return;
  const oldId = workflow._foundrySpellPackAreaId;
  if (oldId && canvas.scene.templates?.has(oldId)) {
    await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [oldId]);
  }
  const [created] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
    t: "circle", user: game.user.id, x: target.center.x, y: target.center.y,
    distance, direction: 0, fillColor: "#d6b45a", borderColor: "#f4df91",
    flags: { [FLAG_SCOPE]: { temporarySpellArea: true, workflowId: workflow.id, repositioned: true } }
  }]);
  workflow._foundrySpellPackAreaId = created?.id;
}

async function selectTargetsByClick(workflow, targetType) {
  const targetCount = Number(workflow.activity?.target?.affects?.count ?? 1) || 1;
  const itemName = workflow.item?.name ?? "magia";
  const user = game.user;
  const oldControl = ui.controls?.control;
  const oldTool = ui.controls?.tool;
  const tokenControl = ui.controls?.controls?.tokens;
  const targetTool = tokenControl?.tools?.target;
  if (tokenControl && targetTool) await ui.controls.activate({ control: tokenControl.name, tool: targetTool.name });
  const notice = ui.notifications?.info?.(
    targetCount > 1
      ? `${itemName}: clique nos ${targetCount} alvos da magia no canvas para selecioná-los.`
      : `${itemName}: clique no alvo da magia no canvas para selecioná-lo.`
  );
  const hint = document.createElement("div");
  hint.dataset.foundrySpellPackTargetHint = "true";
  hint.style.cssText = "position:fixed;right:320px;top:120px;width:240px;margin:6px;padding:8px;border:1px solid #c8a951;border-radius:4px;background:rgba(30,25,15,.95);color:#f4e7b2;font-size:12px;text-align:center;z-index:1000;box-shadow:0 2px 8px #000";
  hint.textContent = targetCount > 1
    ? `${itemName}: clique nos ${targetCount} alvos da magia no canvas para selecioná-los.`
    : `${itemName}: clique no alvo da magia no canvas para selecioná-lo.`;
  let launchButton = null;
  if (itemName === "Acid Splash") {
    launchButton = document.createElement("button");
    launchButton.type = "button";
    launchButton.textContent = "Lançar com este alvo";
    launchButton.style.cssText = "display:none;margin-top:6px;width:100%;cursor:pointer";
    hint.appendChild(document.createElement("br"));
    hint.appendChild(launchButton);
  }
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.style.cssText = "display:block;margin-top:6px;width:100%;cursor:pointer";
  hint.appendChild(cancelButton);
  document.body.appendChild(hint);
  workflow._foundrySpellPackTargetHint = hint;
  for (const target of [...(user.targets ?? [])]) {
    target.setTarget?.(false, { user, releaseOthers: false, groupSelection: true });
  }
  const selected = await new Promise(resolve => {
    let hookId;
    let finishSelection;
    let intervalId;
    let firstTargetId = null;
    let firstTarget = null;
    const finish = result => {
      if (hookId) Hooks.off("targetToken", hookId);
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      resolve(result);
    };
    cancelButton.addEventListener("click", () => finish([]));
    const processTargets = targets => {
      if (workflow.item?.name === "Acid Splash" && firstTargetId && targets.length === 1
        && targets[0].id !== firstTargetId) {
        if (tokenDistance(firstTarget, targets[0]) <= feetToSceneDistance(5)) {
          finish([firstTarget, targets[0]]);
        } else {
          targets[0].setTarget?.(false, { user, releaseOthers: false, groupSelection: true });
          ui.notifications?.warn("Acid Splash: o segundo alvo deve estar a até 1,5 metro do primeiro.");
        }
        return;
      }
      if (workflow.item?.name === "Acid Splash" && targets.length >= 1 && firstTargetId !== targets[0].id) {
        firstTargetId = targets[0].id;
        firstTarget = targets[0];
        void repositionTemporarySpellArea(workflow, firstTarget, feetToSceneDistance(5));
        if (launchButton) launchButton.style.display = "block";
      }
      if (workflow.item?.name === "Acid Splash" && targets.length === 2
        && tokenDistance(targets[0], targets[1]) > feetToSceneDistance(5)) {
        const second = targets[1];
        second.setTarget?.(false, { user, releaseOthers: false, groupSelection: true });
        ui.notifications?.warn("Acid Splash: o segundo alvo deve estar a até 1,5 metro do primeiro.");
        return;
      }
      if (targets.length >= targetCount) finish(targets);
    };
    finishSelection = finish;
    launchButton?.addEventListener("click", () => {
      const targets = [...(user.targets ?? [])];
      if (workflow.item?.name === "Acid Splash" && firstTarget && !targets.some(target => target.id === firstTarget.id)) {
        targets.unshift(firstTarget);
      }
      if (targets.length) finishSelection(targets);
    });
    hookId = Hooks.on("targetToken", (changedUser, token, targeted) => {
      if (changedUser?.id !== user.id || !targeted) return;
      processTargets([... (user.targets ?? [])]);
    });
    intervalId = setInterval(() => processTargets([... (user.targets ?? [])]), 100);
    const timeoutId = setTimeout(() => finish([]), 60000);
  });
  await removeTemporarySpellArea(workflow);
  if (oldControl && oldTool) await ui.controls.activate({ control: oldControl.name, tool: oldTool.name });
  hint.remove();
  delete workflow._foundrySpellPackTargetHint;
  if (!selected.length) return false;
  workflow.setTargets?.(new Set(selected));
  workflow._foundrySpellPackTargetIds = selected.map(target => target.id);
  return true;
}

async function handleMidiPreTargeting(payload = {}) {
  const workflow = midiWorkflow(payload);
  const item = workflow?.item;
  if (!isModuleSpell(item)) return true;
  if (spellFlowProfile(item, workflow).singleGridCellTemplate) {
    activateSingleCellTemplateSnap({ workflowId: workflow.id, itemUuid: item?.uuid });
  }
  if (!isModuleCantrip(item)) return true;
  if (workflow.activity?.target?.template?.type) {
    workflow.workflowOptions ??= {};
    workflow.workflowOptions.targetConfirmation = "never";
  }
  await showTemporarySpellArea(workflow);
  const isEmanation = spellFlag(item, "automation")?.area?.type === "emanation";
  const targetType = workflow.activity?.target?.affects?.type
    ?? item.system?.target?.affects?.type;
  if (!isEmanation && ["creature", "enemy", "ally", "creatureOrObject", "object"].includes(targetType)) {
    if (!workflow._foundrySpellPackTargetDialogShown) {
      workflow._foundrySpellPackTargetDialogShown = true;
      if (!await selectTargetsByClick(workflow, targetType)) return false;
    }
  }
  if (item.system?.target?.template?.type || item.name === "Mage Hand") return true;
  try {
    await playAnimation({
      item,
      token: workflow.token,
      targets: [...(workflow.targets ?? selectedTargets())],
      workflow
    });
    workflow._foundrySpellPackAnimationPlayed = true;
  } catch (error) {
    console.warn(`${MODULE_ID} | A animação de ${item.name} não pôde ser executada.`, error);
  }
  return true;
}

async function handleMidiPreWaitForSaves(payload) {
  const workflow = midiWorkflow(payload);
  restoreSingleCellTemplateSnap(workflow);
  const item = workflow?.item;
  if (spellFlag(item, "automation")?.area?.type !== "emanation") return true;
  await removeTemporarySpellArea(workflow);
  try {
    const targets = await targetEmanation({
      item,
      token: workflow.token,
      workflow
    });
    workflow.workflowOptions ??= {};
    workflow.workflowOptions.ignoreUserTargets = true;
    workflow.hitTargets = new Set(targets);
    workflow._foundrySpellPackEmanationTargetIds = targets.map(target => target.id);
  } catch (error) {
    console.warn(`${MODULE_ID} | Os alvos da emanação de ${item.name} não puderam ser definidos.`, error);
  }
  return true;
}

async function handleMidiPostActiveEffects(payload) {
  const workflow = midiWorkflow(payload);
  restoreSingleCellTemplateSnap(workflow);
  const item = workflow?.item;
  if (!isModuleCantrip(item) || workflow._foundrySpellPackMechanicsHandled) return true;
  try {
    await runCantrip({
      item,
      token: workflow.token,
      workflow,
      context: { macroPass: "postActiveEffects", source: "module-hook" }
    });
  } catch (error) {
    console.warn(`${MODULE_ID} | Os efeitos de ${item.name} não puderam ser concluídos.`, error);
  }
  return true;
}

async function handleMidiRollComplete(payload) {
  const workflow = midiWorkflow(payload);
  restoreSingleCellTemplateSnap(workflow);
  const item = workflow?.item;
  if (!isModuleCantrip(item) || workflow._foundrySpellPackMechanicsHandled) return true;
  try {
    await runCantrip({
      item,
      token: workflow.token,
      workflow,
      targets: [...(workflow.hitTargets ?? workflow.failedSaves ?? workflow.targets ?? [])],
      context: { macroPass: "RollComplete", source: "module-hook" }
    });
  } catch (error) {
    console.warn(`${MODULE_ID} | O fluxo de ${item.name} não pôde ser concluído.`, error);
  }
  return true;
}

function clearEmanationTargets(payload) {
  const workflow = midiWorkflow(payload);
  restoreSingleCellTemplateSnap(workflow);
  workflow?._foundrySpellPackTargetHint?.remove?.();
  if (workflow) delete workflow._foundrySpellPackTargetHint;
  const targetIds = new Set([
    ...(workflow?._foundrySpellPackEmanationTargetIds ?? []),
    ...(workflow?._foundrySpellPackTargetIds ?? [])
  ]);
  removeTemporarySpellArea(workflow);
  if (!targetIds.size) return true;
  const user = game.user;
  for (const target of [...(user?.targets ?? [])]) {
    if (targetIds.has(target.id)) {
      target.setTarget?.(false, { user, releaseOthers: false, groupSelection: true });
    }
  }
  delete workflow._foundrySpellPackEmanationTargetIds;
  delete workflow._foundrySpellPackTargetIds;
  return true;
}

async function clearConcentrationTemplates(effect) {
  if (!canvas.scene) return;
  const zone = spellFlag(effect, "persistentZone");
  const sourceItems = new Set([zone?.sourceItem, spellFlag(effect, "sourceItem")].filter(Boolean));
  if (zone) PERSISTENT_AREA_TURN_HITS.delete(effect.uuid);

  // Compatibilidade com templates persistentes de builds anteriores.
  const origin = effect?.origin;
  const templates = canvas.scene.templates?.filter(template => {
    const sourceItem = spellFlag(template, "sourceItem");
    return sourceItem && (sourceItem === origin || origin?.startsWith(`${sourceItem}.`));
  }) ?? [];
  for (const template of templates) {
    const sourceItem = spellFlag(template, "sourceItem");
    if (sourceItem) sourceItems.add(sourceItem);
    PERSISTENT_AREA_TURN_HITS.delete(template.id);
  }

  for (const sourceItem of sourceItems) await endPersistentAreaEffect(sourceItem);
  // Tile e paredes do objeto estático morrem com o efeito que hospedava a área.
  let removedPlaceables = { tiles: 0, walls: 0 };
  if (zone) removedPlaceables = await removeStaticObjectPlaceables({ zoneKey: zone.id ?? effect.uuid });
  for (const sourceItem of sourceItems) {
    const extra = await removeStaticObjectPlaceables({ sourceItem });
    removedPlaceables = { tiles: removedPlaceables.tiles + extra.tiles, walls: removedPlaceables.walls + extra.walls };
  }
  const existing = templates.filter(template => canvas.scene.templates?.get(template.id));
  if (existing.length) {
    await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", existing.map(template => template.id), {
      noConcentrationCheck: true,
      [FLAG_SCOPE]: { concentrationCleanup: true }
    });
  }
  if (zone || existing.length || removedPlaceables.tiles || removedPlaceables.walls) {
    console.log(`${MODULE_ID} | área encerrada pelo fim do efeito "${effect?.name ?? effect?.label ?? "?"}"; `
      + `${existing.length} template(s) legado(s), ${removedPlaceables.tiles} tile(s) e `
      + `${removedPlaceables.walls} parede(s) removidos.`);
  }
}

// Limpeza manual: numa cena de teste o tempo do mundo não avança, então `purgeExpiredMarkers`
// (que roda em updateWorldTime) nunca dispara e sobram marcadores de lançamentos anteriores.
// Use no console: game.modules.get("meu-modulo-feiticos").api.clearModuleMarkers()
// Passe { all: true } para apagar TODOS os templates da cena, inclusive os que não são do módulo.
async function clearModuleMarkers({ all = false, notifyUser = true } = {}) {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Somente o mestre pode limpar os marcadores.");
    return { templates: 0, lights: 0, areas: 0 };
  }
  if (!canvas.scene) return { templates: 0, lights: 0, areas: 0 };
  const isModuleMarker = document => !!(spellFlag(document, "moduleMarker")
    ?? spellFlag(document, "persistentZone")
    ?? spellFlag(document, "temporarySpellArea")
    ?? spellFlag(document, "sourceSpell"));
  const templates = [...(canvas.scene.templates ?? [])].filter(template => all || isModuleMarker(template));
  const lights = [...(canvas.scene.lights ?? [])].filter(isModuleMarker);
  const areaRecords = persistentAreaEffectRecords();
  const areaEffects = areaRecords
    .map(record => typeof fromUuidSync === "function" ? fromUuidSync(record.effectUuid) : null)
    .filter(Boolean);

  for (const record of areaRecords) {
    if (record.sourceItem) await endPersistentAreaEffect(record.sourceItem);
    PERSISTENT_AREA_TURN_HITS.delete(record.id);
  }
  for (const effect of areaEffects) {
    await effect.unsetFlag?.(FLAG_SCOPE, "persistentZone");
    await effect.unsetFlag?.(FLAG_SCOPE, "sourceItem");
    await effect.unsetFlag?.(FLAG_SCOPE, "sourceSpell");
  }
  for (const template of templates) {
    if (spellFlag(template, "mageHand") === true) await endMageHandEffect(template);
    else {
      const sourceItem = spellFlag(template, "sourceItem");
      if (sourceItem) await endPersistentAreaEffect(sourceItem);
    }
    PERSISTENT_AREA_TURN_HITS.delete(template.id);
  }
  if (templates.length) {
    await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", templates.map(t => t.id), {
      noConcentrationCheck: true,
      [FLAG_SCOPE]: { manualMarkerCleanup: true }
    });
  }
  if (lights.length) await canvas.scene.deleteEmbeddedDocuments("AmbientLight", lights.map(l => l.id));

  // Objetos estáticos: zonas hospedadas na cena, mais os tiles e paredes que elas criaram.
  const sceneZones = sceneStaticZones();
  let placeables = { tiles: 0, walls: 0 };
  for (const zone of sceneZones) {
    if (zone.sourceItem) await endPersistentAreaEffect(zone.sourceItem);
    const removed = await removeStaticObjectPlaceables({ zoneKey: zone.id, sourceItem: zone.sourceItem });
    placeables = { tiles: placeables.tiles + removed.tiles, walls: placeables.walls + removed.walls };
    PERSISTENT_AREA_TURN_HITS.delete(zone.id);
  }
  if (sceneZones.length) await writeSceneStaticZones([]);
  for (const record of areaRecords) {
    const removed = await removeStaticObjectPlaceables({ zoneKey: record.id, sourceItem: record.sourceItem });
    placeables = { tiles: placeables.tiles + removed.tiles, walls: placeables.walls + removed.walls };
  }

  const report = {
    templates: templates.length,
    lights: lights.length,
    areas: areaEffects.length + sceneZones.length,
    tiles: placeables.tiles,
    walls: placeables.walls
  };
  const resumo = `${report.templates} template(s), ${report.lights} luz(es), `
    + `${report.areas} área(s) persistente(s), ${report.tiles} tile(s) e ${report.walls} parede(s) removidos.`;
  console.log(`${MODULE_ID} | limpeza: ${resumo}`);
  if (notifyUser) ui.notifications?.info(resumo);
  return report;
}

async function handleMageHandMarkerUpdate(document, changed, options = {}, userId = null) {
  if (spellFlag(document, "mageHand") !== true) return true;
  if (!("x" in changed) && !("y" in changed)) return true;
  if (options?.[FLAG_SCOPE]?.mageHandInternalUpdate) return true;
  const activeGM = game.users?.activeGM ?? null;
  if (activeGM ? game.user?.id !== activeGM.id : game.user?.id !== userId) return true;

  const sourceTokenId = spellFlag(document, "sourceToken");
  const source = canvas.tokens?.get?.(sourceTokenId)
    ?? canvas.tokens?.placeables?.find(token => token.id === sourceTokenId);
  if (!source) {
    ui.notifications?.warn("Mage Hand: o token do conjurador não está disponível nesta cena.");
    return true;
  }
  const bounds = singleGridCellBounds(document);
  if (!bounds) return true;
  const maximumRange = feetToSceneDistance(Number(spellFlag(document, "maxRangeFeet")) || 30);
  const distance = sceneDistanceBetweenPoints(source.center, { x: bounds.centerX, y: bounds.centerY });

  if (distance > maximumRange + 0.001) {
    const lastX = Number(spellFlag(document, "lastValidX"));
    const lastY = Number(spellFlag(document, "lastValidY"));
    ui.notifications?.warn("Mage Hand deve permanecer a até 30 pés do conjurador.");
    if (Number.isFinite(lastX) && Number.isFinite(lastY)) {
      await document.update({ x: lastX, y: lastY }, { [FLAG_SCOPE]: { mageHandInternalUpdate: true } });
    }
    return false;
  }

  await document.update({
    [`flags.${FLAG_SCOPE}.lastValidX`]: Number(document.x),
    [`flags.${FLAG_SCOPE}.lastValidY`]: Number(document.y)
  }, { [FLAG_SCOPE]: { mageHandInternalUpdate: true } });
  const itemUuid = spellFlag(document, "sourceItem");
  const item = itemUuid && typeof fromUuid === "function" ? await fromUuid(itemUuid) : null;
  if (item) await playMageHandEffect(item, document, { x: bounds.centerX, y: bounds.centerY });
  return true;
}

function handleMageHandMarkerDeleted(document, options = {}, userId = null) {
  if (spellFlag(document, "mageHand") !== true) return true;
  if (options?.[FLAG_SCOPE]?.mageHandReplacement) return true;
  const activeGM = game.users?.activeGM ?? null;
  if (activeGM ? game.user?.id !== activeGM.id : game.user?.id !== userId) return true;
  void endMageHandEffect(document);
  return true;
}

async function removeMageHandMarker(marker, reason = null) {
  if (!marker) return false;
  await endMageHandEffect(marker);
  if (canvas.scene?.templates?.get(marker.id)) {
    await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [marker.id], {
      [FLAG_SCOPE]: { mageHandCleanup: true }
    });
  }
  if (reason) ui.notifications?.info(reason);
  return true;
}

async function handleMageHandSourceMovement(tokenDoc, changes) {
  if (!isActiveGMClient() || (!("x" in changes) && !("y" in changes))) return true;
  const markers = [...(canvas.scene?.templates ?? [])].filter(template =>
    spellFlag(template, "mageHand") === true
    && spellFlag(template, "sourceToken") === tokenDoc.id
  );
  if (!markers.length) return true;
  const sourceCenter = tokenDocCenter(tokenDoc);
  for (const marker of markers) {
    const bounds = singleGridCellBounds(marker);
    if (!bounds) continue;
    const maximumRange = feetToSceneDistance(Number(spellFlag(marker, "maxRangeFeet")) || 30);
    const distance = sceneDistanceBetweenPoints(sourceCenter, { x: bounds.centerX, y: bounds.centerY });
    if (distance > maximumRange + 0.001) {
      await removeMageHandMarker(marker, "Mage Hand desapareceu por ficar a mais de 30 pés do conjurador.");
    }
  }
  return true;
}

async function handleMageHandCombatExpiry(combat, changed) {
  if (!isActiveGMClient() || !("round" in changed)) return true;
  const round = Number(combat?.round ?? 0);
  const expired = [...(canvas.scene?.templates ?? [])].filter(template => {
    if (spellFlag(template, "mageHand") !== true) return false;
    const combatId = spellFlag(template, "combatId");
    const expiryRound = Number(spellFlag(template, "expiryRound"));
    return combatId === combat?.id && Number.isFinite(expiryRound) && round >= expiryRound;
  });
  for (const marker of expired) await removeMageHandMarker(marker, "Mage Hand terminou após 1 minuto.");
  return true;
}

async function moveMageHand(token = null) {
  const source = resolveToken(token);
  if (!source || !canvas.scene) return null;
  const marker = [...(canvas.scene.templates ?? [])].find(template =>
    spellFlag(template, "mageHand") === true
    && spellFlag(template, "sourceToken") === source.id
  );
  if (!marker) {
    ui.notifications?.warn("Mage Hand: nenhuma mão ativa foi encontrada para este token.");
    return null;
  }
  const point = await markerLocation(source, Number(spellFlag(marker, "maxRangeFeet")) || 30);
  if (!point) return marker;
  let topLeft = point;
  try { topLeft = canvas.grid?.getTopLeftPoint?.(point) ?? point; } catch (error) {}
  await marker.update({ x: Number(topLeft.x), y: Number(topLeft.y) });
  return marker;
}

async function runCompatibilityCheck({ notifyUser = true } = {}) {
  const report = {
    coreVersion: game.version,
    systemId: game.system?.id,
    systemVersion: game.system?.version,
    moduleActive: game.modules.get(MODULE_ID)?.active === true,
    packId: `${MODULE_ID}.feiticos-5e`,
    packEntries: 0,
    valid: false,
    errors: []
  };
  if (game.release?.generation !== 14) report.errors.push(`Foundry ${game.version}; esperado V14.`);
  if (game.system?.id !== "dnd5e") report.errors.push(`Sistema ${game.system?.id ?? "desconhecido"}; esperado dnd5e.`);
  if (!foundry.utils.isNewerVersion(game.system?.version ?? "0", "5.2.99")) report.errors.push(`D&D5e ${game.system?.version ?? "desconhecido"}; esperado 5.3.0 ou superior.`);
  const pack = game.packs.get(report.packId);
  if (!pack) report.errors.push(`Compêndio ${report.packId} não encontrado.`);
  else {
    const index = await pack.getIndex({ fields: ["type", "system.level", "system.activities"] });
    report.packEntries = index.size;
    if (index.size !== 517) report.errors.push(`Compêndio contém ${index.size} entradas; esperado 517.`);
    const malformed = index.filter(entry => entry.type !== "spell" || !entry.system?.activities);
    if (malformed.length) report.errors.push(`${malformed.length} entradas sem estrutura de magia/atividade.`);
  }
  report.valid = report.errors.length === 0;
  console.table(report);
  if (report.errors.length) console.warn(`${MODULE_ID} | Falhas de compatibilidade`, report.errors);
  if (notifyUser) ui.notifications?.[report.valid ? "info" : "error"](report.valid
    ? `${MODULE_ID}: Foundry 14, D&D5e ${report.systemVersion} e 517 magias verificados.`
    : `${MODULE_ID}: verificação encontrou ${report.errors.length} problema(s); consulte o console.`);
  return report;
}

Hooks.once("init", () => {
  const module = game.modules.get(MODULE_ID);
  module.api = {
    playAnimation,
    applyStatus,
    runSpecialAutomation,
    runCantrip,
    runSpell: runCantrip,
    runCompatibilityCheck,
    createSpellTestActors,
    clearModuleMarkers,
    setPersistentAreaScale,
    createMageHandMarker,
    playMageHandEffect,
    moveMageHand
  };
});

// Novas áreas transferem sua geometria para o efeito de concentração e apagam o template de
// posicionamento. Este hook permanece apenas para templates legados e exclusões manuais.
function handlePersistentAreaTemplateDeleted(template, options = {}) {
  PERSISTENT_AREA_TURN_HITS.delete(template?.id);
  if (options?.[FLAG_SCOPE]?.persistentZoneTransferred || options?.noConcentrationCheck) return true;
  const sourceItem = spellFlag(template, "sourceItem");
  if (sourceItem && spellFlag(template, "persistentZone")) endPersistentAreaEffect(sourceItem);
  return true;
}

async function normalizeCreatedModuleTemplate(document) {
  restoreSingleCellSnapForCreatedArea(document);
  const sourceItemUuid = document?.flags?.dnd5e?.item
    ?? document?._source?.flags?.dnd5e?.item;
  const resolved = sourceItemUuid && typeof fromUuidSync === "function" ? fromUuidSync(sourceItemUuid) : null;
  const item = resolved?.type === "spell"
    ? resolved
    : resolved?.item?.type === "spell"
      ? resolved.item
      : resolved?.parent?.type === "spell"
        ? resolved.parent
        : null;
  if (!item || !spellFlowProfile(item).singleGridCellTemplate) return true;
  await normalizePlacedSingleGridCellTemplate(document);
  return true;
}

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | runtime ${RUNTIME_BUILD} carregado.`);
  const sceneUnits = canvas.scene?.grid?.units ?? "";
  const sceneGridDistance = Number(canvas.scene?.grid?.distance);
  if (isMetersUnit(sceneUnits) && !sameDistance(sceneGridDistance, METERS_PER_GRID_SQUARE, 0.001)) {
    console.warn(`${MODULE_ID} | A cena está em metros, mas cada quadrado vale ${sceneGridDistance} m;`
      + ` o esperado para a convenção do módulo é ${METERS_PER_GRID_SQUARE} m.`);
  }
  clearLegacyPersistentAreaZones();
  Hooks.on("deleteMeasuredTemplate", handlePersistentAreaTemplateDeleted);
  Hooks.on("deleteMeasuredTemplate", handleMageHandMarkerDeleted);
  Hooks.on("updateMeasuredTemplate", handleMageHandMarkerUpdate);
  Hooks.on("dnd5e.preCreateActivityTemplate", forceGridAlignedCubeTemplate);
  Hooks.on("preCreateMeasuredTemplate", normalizeMeasuredTemplateUnits);
  Hooks.on("midi-qol.preTargetingV2", handleMidiPreTargeting);
  Hooks.on("midi-qol.preWaitForSaves", handleMidiPreWaitForSaves);
  Hooks.on("midi-qol.postActiveEffects", handleMidiPostActiveEffects);
  Hooks.on("midi-qol.RollComplete", handleMidiRollComplete);
  Hooks.on("midi-qol.preCompleted", clearEmanationTargets);
  Hooks.on("midi-qol.preAbort", clearEmanationTargets);
  Hooks.on("midi-qol.preCancel", clearEmanationTargets);
  Hooks.on("createMeasuredTemplate", normalizeCreatedModuleTemplate);
  Hooks.on("createRegion", restoreSingleCellSnapForCreatedArea);
  Hooks.on("deleteActiveEffect", clearConcentrationTemplates);
  Hooks.on("updateToken", handlePersistentAreaMovement);
  Hooks.on("updateToken", handleMageHandSourceMovement);
  Hooks.on("updateCombat", handlePersistentAreaTurn);
  Hooks.on("updateCombat", handleMageHandCombatExpiry);
  Hooks.on("combatStart", handlePersistentAreaCombatStart);
  Hooks.on("updateWorldTime", purgeExpiredMarkers);
});
