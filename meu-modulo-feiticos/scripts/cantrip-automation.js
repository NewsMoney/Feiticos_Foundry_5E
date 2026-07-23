const MODULE_ID = "meu-modulo-feiticos";
const FLAG_SCOPE = "foundry-spell-pack";

function spellFlag(document, key) {
  return document?.flags?.[FLAG_SCOPE]?.[key]
    ?? document?._source?.flags?.[FLAG_SCOPE]?.[key];
}

function selectedTargets() {
  return [...(game.user?.targets ?? [])];
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

async function playAnimation({ item, token, targets = selectedTargets() } = {}) {
  const config = spellFlag(item, "animation");
  const source = resolveToken(token);
  if (!config || !source || !globalThis.Sequence) return false;

  const destinations = config.targeted && targets.length ? targets : [source];
  for (const destination of destinations) {
    const jobs = [];
    const soundFile = item?.name === "Thunderclap"
      ? "modules/meu-modulo-feiticos/sounds/thunderclap.wav"
      : config.sound;
    if (soundFile) {
      jobs.push(new Sequence()
        .sound()
        .file(soundFile)
        .volume(config.volume ?? 0.25)
        .play());
    }

    const layers = config.layers?.length ? config.layers : [config];
    const sequence = new Sequence();
    for (const layer of layers) {
      if (!layer.file) continue;
      let effect = sequence.effect().file(layer.file);
      if (layer.targeted ?? config.targeted) effect = effect.atLocation(source).stretchTo(destination);
      else effect = effect.atLocation(destination);
      if (layer.scale ?? config.scale) effect.scale(layer.scale ?? config.scale);
      if (layer.belowTokens ?? config.belowTokens) effect.belowTokens();
      if (layer.duration) effect.duration(layer.duration);
      effect.fadeIn(layer.fadeIn ?? 150).fadeOut(layer.fadeOut ?? 300);
    }
    jobs.push(sequence.play());
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

  const targets = (canvas.tokens?.placeables ?? []).filter(candidate => {
    return !!candidate?.actor
      && !(area.excludeSelf && candidate.id === source.id)
      && tokenDistance(source, candidate) <= Number(area.radius ?? 0);
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
  const gridDistance = canvas.scene?.grid?.distance ?? 5;
  return (distance / gridDistance) * gridSize;
}

async function moveToken(target, source, distance, direction = "toward") {
  const moving = resolveToken(target);
  const anchor = resolveToken(source);
  if (!moving?.document || !anchor) return false;
  const from = moving.center;
  const to = anchor.center;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  const pixels = Math.min(gridDistanceToPixels(distance), length);
  const sign = direction === "away" ? -1 : 1;
  const center = { x: from.x + sign * (dx / length) * pixels, y: from.y + sign * (dy / length) * pixels };
  const topLeft = { x: center.x - moving.w / 2, y: center.y - moving.h / 2 };
  const snapped = canvas.grid?.getSnappedPoint?.(topLeft, { mode: CONST.GRID_SNAPPING_MODES?.CENTER }) ?? topLeft;
  await moving.document.update({ x: snapped.x, y: snapped.y });
  return true;
}

async function scatterToken(target, distance = 5) {
  const moving = resolveToken(target);
  if (!moving?.document) return false;
  const angle = Math.floor(Math.random() * 8) * (Math.PI / 4);
  const pixels = gridDistanceToPixels(distance);
  const point = { x: moving.document.x + Math.cos(angle) * pixels, y: moving.document.y + Math.sin(angle) * pixels };
  const snapped = canvas.grid?.getSnappedPoint?.(point, { mode: CONST.GRID_SNAPPING_MODES?.CENTER }) ?? point;
  await moving.document.update({ x: snapped.x, y: snapped.y });
  return true;
}

async function placeCircleTemplate(token, distance, color, flags = {}) {
  const source = resolveToken(token);
  if (!source || !canvas.scene) return null;
  const previous = canvas.scene.templates?.filter(document =>
    spellFlag(document, "sourceSpell") === flags.sourceSpell
    && spellFlag(document, "sourceToken") === source.id
  ) ?? [];
  if (previous.length) await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", previous.map(document => document.id));
  const data = {
    t: "circle", user: game.user.id, x: source.center.x, y: source.center.y,
    distance, direction: 0, fillColor: color, borderColor: color,
    flags: { [FLAG_SCOPE]: { ...flags, sourceToken: source.id } }
  };
  const [created] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
  return created;
}

async function createAmbientLights(token, count = 1) {
  const source = resolveToken(token);
  if (!source || !canvas.scene) return [];
  const radius = gridDistanceToPixels(5);
  const previous = canvas.scene.lights?.filter(document =>
    spellFlag(document, "sourceSpell") === "Dancing Lights"
    && spellFlag(document, "sourceToken") === source.id
  ) ?? [];
  if (previous.length) await canvas.scene.deleteEmbeddedDocuments("AmbientLight", previous.map(document => document.id));
  const data = Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    return {
      x: source.center.x + Math.cos(angle) * radius,
      y: source.center.y + Math.sin(angle) * radius,
      config: { dim: 20, bright: 10, color: "#ffd966", alpha: 0.25, animation: { type: "torch", speed: 2, intensity: 2 } },
      flags: { [FLAG_SCOPE]: { temporary: true, sourceSpell: "Dancing Lights", sourceToken: source.id } }
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

async function runSpecialAutomation({ item, token, targets }) {
  const source = resolveToken(token);
  const first = targets[0];
  try {
    switch (item.name) {
      case "Lightning Lure": if (first) await moveToken(first, source, 10, "toward"); break;
      case "Thorn Whip": if (first) await moveToken(first, source, 10, "toward"); break;
      case "Gust": if (first) await moveToken(first, source, 5, "away"); break;
      case "Infestation": if (first) await scatterToken(first, 5); break;
      case "Create Bonfire": await placeCircleTemplate(source, 5, "#e25822", { sourceSpell: item.name, concentration: true }); break;
      case "Dancing Lights": await createAmbientLights(source, 4); break;
      case "Light": if (first?.document) await first.document.update({ light: { dim: 40, bright: 20, color: "#fff2a8", alpha: 0.25 } }); break;
      case "Produce Flame": if (source?.document) await source.document.update({ light: { dim: 20, bright: 10, color: "#ff8c32", alpha: 0.2 } }); break;
      case "Magic Stone": await createMagicStone(source?.actor, item.img); break;
      case "Shillelagh": await createShillelagh(source?.actor, item.img); break;
      case "Message": if (first) await sendMessage(first); break;
      case "Mage Hand": await placeCircleTemplate(source, 5, "#7fb3ff", { sourceSpell: item.name, movableMarker: true }); break;
      case "Minor Illusion": await placeCircleTemplate(source, 5, "#a875ff", { sourceSpell: item.name, illusion: true }); break;
      case "Mold Earth":
      case "Shape Water":
      case "Control Flames": await placeCircleTemplate(source, 5, "#8c7853", { sourceSpell: item.name, terrainMarker: true }); break;
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
  await playAnimation({ item, token, targets });
  await applyStatus({ item, token, targets });
  await runSpecialAutomation({ item, token, targets });
  if (area?.type === "emanation" && options.workflow) {
    options.workflow._foundrySpellPackEmanationHandled = true;
  }
  return true;
}

async function handleMidiPreTargeting({ workflow } = {}) {
  const item = workflow?.item;
  if (item?.name !== "Thunderclap") return true;
  try {
    await runCantrip({
      item,
      token: workflow.token,
      workflow,
      context: { macroPass: "preTargetingV2", source: "module-hook" }
    });
  } catch (error) {
    console.warn(`${MODULE_ID} | A emanação visual do Thunderclap não pôde ser executada.`, error);
  }
  return true;
}

async function handleMidiPreWaitForSaves(workflow) {
  const item = workflow?.item;
  if (item?.name !== "Thunderclap") return true;
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
    console.warn(`${MODULE_ID} | Os alvos do Thunderclap não puderam ser definidos.`, error);
  }
  return true;
}

function clearEmanationTargets(workflow) {
  if (workflow?.item?.name !== "Thunderclap") return true;
  const targetIds = new Set(workflow._foundrySpellPackEmanationTargetIds ?? []);
  if (!targetIds.size) return true;
  const user = game.user;
  for (const target of [...(user?.targets ?? [])]) {
    if (targetIds.has(target.id)) {
      target.setTarget?.(false, { user, releaseOthers: false, groupSelection: true });
    }
  }
  delete workflow._foundrySpellPackEmanationTargetIds;
  return true;
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
  module.api = { playAnimation, applyStatus, runSpecialAutomation, runCantrip, runSpell: runCantrip, runCompatibilityCheck };
});

Hooks.once("ready", () => {
  Hooks.on("midi-qol.preTargetingV2", handleMidiPreTargeting);
  Hooks.on("midi-qol.preWaitForSaves", handleMidiPreWaitForSaves);
  Hooks.on("midi-qol.preCompleted", clearEmanationTargets);
  Hooks.on("midi-qol.preAbort", clearEmanationTargets);
  Hooks.on("midi-qol.preCancel", clearEmanationTargets);
});
