import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { composeDescription } from "./description-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = [
  ...JSON.parse(await readFile(path.join(root, "data", "spells-levels-1-2.json"), "utf8")),
  ...JSON.parse(await readFile(path.join(root, "data", "spells-levels-3-4.json"), "utf8")),
  ...JSON.parse(await readFile(path.join(root, "data", "spells-levels-5-6.json"), "utf8")),
  ...JSON.parse(await readFile(path.join(root, "data", "spells-levels-7-9.json"), "utf8"))
];
const supportedLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const requestedLevels = process.argv.slice(2).map(Number).filter(level => supportedLevels.includes(level));
if (!requestedLevels.length) requestedLevels.push(1, 2);
const srdDescriptions = JSON.parse(await readFile(path.join(root, "data", "descriptions-srd-5.1.json"), "utf8"));
const translatedDescriptionsFile = "descriptions-reviewed-srd-pt-br.json";
const translatedDescriptions = JSON.parse(await readFile(path.join(root, "data", translatedDescriptionsFile), "utf8"));
const reviewedDescriptions = {};
for (const file of (await readdir(path.join(root, "data"))).filter(name => name.startsWith("descriptions-reviewed") && name.endsWith(".json") && name !== translatedDescriptionsFile)) {
  Object.assign(reviewedDescriptions, JSON.parse(await readFile(path.join(root, "data", file), "utf8")));
}
const flagScope = "foundry-spell-pack";
const id = value => crypto.createHash("sha256").update(value).digest("base64url").slice(0, 16);
const workflowOverrides = {};
for (const level of supportedLevels) {
  const filename = path.join(root, "data", `workflow-overrides-level-${level}.json`);
  try { Object.assign(workflowOverrides, JSON.parse(await readFile(filename, "utf8"))); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

function deepMerge(base, override) {
  if (Array.isArray(override)) return structuredClone(override);
  if (!override || typeof override !== "object") return override;
  const result = base && typeof base === "object" && !Array.isArray(base) ? structuredClone(base) : {};
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(result[key], value)
      : structuredClone(value);
  }
  return result;
}

function finalizeItem(item) {
  const activities = Object.values(item.system?.activities ?? {});
  for (const activity of activities) {
    if (activity.target?.template?.type && activity.target.prompt === undefined) activity.target.prompt = true;
  }
  if (activities.length !== 1) return item;
  const activity = activities[0];
  const itemTemplate = item.system?.target?.template;
  const activityTemplate = activity.target?.template;
  if (itemTemplate?.type && !activityTemplate?.type) {
    activity.target ??= {};
    activity.target.template = structuredClone(itemTemplate);
  } else if (itemTemplate?.type === activityTemplate?.type && itemTemplate?.size && !activityTemplate?.size) {
    activity.target.template.size = itemTemplate.size;
  } else if (activityTemplate?.type && !itemTemplate?.type) {
    item.system.target ??= {};
    item.system.target.template = structuredClone(activityTemplate);
  }
  return item;
}

const mechanicalOverrides = {
  "Chaos Bolt": { damage: [[2, 8, "force"], [1, 6, "force"]] },
  "Chromatic Orb": { damage: [[3, 8, "acid"]] },
  "Spiritual Weapon": { damage: [[1, 8, "force"]] },
  "Hold Person": { conditions: ["paralyzed"] },
  "Blindness/Deafness": { conditions: ["blinded"] },
  "Entangle": { conditions: ["restrained"] },
  "Grease": { conditions: ["prone"] },
  "Sleep": { conditions: ["unconscious"] },
  "Tasha’s Hideous Laughter": { conditions: ["prone", "incapacitated"] },
  "Nathair’s Mischief": { conditions: [] },
  "Branding Smite": { conditions: [] },
  "Protection from Poison": { conditions: [] },
  "Ray of Enfeeblement": { conditions: [] },
  "Feign Death": { conditions: ["incapacitated"] },
  "Summon Fey": { conditions: [] },
  "Summon Undead": { conditions: [] },
  "Mordenkainen’s Faithful Hound": { conditions: [] },
  "Polymorph": { conditions: [] },
  "Watery Sphere": { conditions: ["restrained"] },
  "Awaken": { conditions: ["charmed"], statusDuration: { days: 30 } },
  "Contagion": { conditions: ["poisoned"] },
  "Dispel Evil and Good": { conditions: [] },
  "Holy Weapon": { conditions: [] },
  "Investiture of Stone": { conditions: [] },
  "Wind Walk": { conditions: [] },
  "Mordenkainen’s Magnificent Mansion": { conditions: [] },
  "Prismatic Spray": { conditions: [] },
  "Symbol": { conditions: [] },
  "Animal Shapes": { conditions: [] },
  "Reality Break": { conditions: [] },
  "Power Word Heal": { conditions: [] },
  "Prismatic Wall": { conditions: [] },
  "Shapechange": { conditions: [] },
  "True Polymorph": { conditions: [] },
  "Storm of Vengeance": { conditions: [] },
  "Imprisonment": { conditions: [] }
};
for (const def of catalog) {
  Object.assign(def, mechanicalOverrides[def.name] ?? {});
  Object.assign(def, workflowOverrides[def.name]?.definition ?? {});
}

const animations = {
  acid: ["jb2a.liquid.splash.bright_green", "jb2a.impact.004.green"],
  bludgeoning: ["jb2a.boulder.toss.01", "jb2a.impact.ground_crack.orange.01"],
  cold: ["jb2a.ray_of_frost.blue", "jb2a.impact.frost.blue"],
  fire: ["jb2a.fire_bolt.orange", "jb2a.impact.004.orange"],
  force: ["jb2a.bullet.01.blue", "jb2a.impact.004.blue"],
  lightning: ["jb2a.chain_lightning.primary.blue", "jb2a.static_electricity.03.blue"],
  necrotic: ["jb2a.energy_strands.range.standard.dark_purple", "jb2a.impact.004.dark_purple"],
  piercing: ["jb2a.arrow.physical.white", "jb2a.impact.ground_crack.white.01"],
  poison: ["jb2a.breath_weapons.poison.cone.green", "jb2a.impact.004.green"],
  psychic: ["jb2a.lasershot.pink", "jb2a.impact.004.dark_purple"],
  radiant: ["jb2a.guiding_bolt.01.yellow", "jb2a.impact.004.yellow"],
  slashing: ["jb2a.melee_generic.slashing.one_handed", "jb2a.impact.ground_crack.white.01"],
  thunder: ["jb2a.thunderwave.center.blue", "jb2a.impact.ground_crack.01.blue"],
  abj: ["jb2a.shield.01.intro.blue", "jb2a.magic_signs.rune.abjuration.intro.blue"],
  con: ["jb2a.magic_signs.rune.conjuration.intro.purple", "jb2a.portals.vertical.vortex.purple"],
  div: ["jb2a.detect_magic.circle.blue", "jb2a.magic_signs.rune.divination.intro.blue"],
  enc: ["jb2a.magic_signs.rune.enchantment.intro.pink", "jb2a.markers.heart.pink"],
  evo: ["jb2a.magic_signs.rune.evocation.intro.blue", "jb2a.impact.004.blue"],
  ill: ["jb2a.magic_signs.rune.illusion.intro.purple", "jb2a.markers.smoke.ring.loop"],
  nec: ["jb2a.magic_signs.rune.necromancy.intro.purple", "jb2a.energy_strands.complete.dark_purple"],
  trs: ["jb2a.magic_signs.rune.transmutation.intro.yellow", "jb2a.swirling_sparkles.01.blue"]
};

function parseDuration(raw, concentration) {
  const value = Number(raw.match(/\d+/)?.[0] ?? 0) || null;
  const lower = raw.toLowerCase();
  const units = lower.includes("round") ? "round" : lower.includes("minute") ? "minute" : lower.includes("hour") ? "hour" : lower.includes("day") ? "day" : lower.includes("instant") ? "inst" : lower.includes("dispel") ? "perm" : "spec";
  return { value, units, concentration };
}

function damagePart([number, denomination, type]) {
  return { custom: { enabled: false, formula: "" }, number, denomination, bonus: "", types: [type], scaling: { mode: "whole", number: 1 } };
}

function templateFrom(def) {
  const special = def.range.special ?? "";
  const shape = /cone/i.test(special) ? "cone" : /cube/i.test(special) ? "cube" : /line/i.test(special) ? "line" : /radius|sphere/i.test(special) ? "circle" : "";
  const size = Number(special.match(/(\d+)[- ]foot/i)?.[1] ?? 0) || null;
  return { contiguous: false, units: "ft", type: shape, size };
}

function makeActivity(def, activityId) {
  const common = {
    type: def.mode,
    activation: { type: def.activation, value: def.activationValue, override: false, condition: def.activationCondition },
    consumption: { scaling: { allowed: true }, spellSlot: true, targets: [] },
    description: { chatFlavor: "" }, duration: { ...parseDuration(def.duration, def.concentration), override: false },
    effects: [], range: { override: false },
    target: { template: templateFrom(def), affects: { choice: false }, override: false, prompt: true },
    uses: { spent: 0, recovery: [], max: "" }, midiProperties: {},
    overTimeProperties: { saveRemoves: true, preRemoveConditionText: "", postRemoveConditionText: "" }
  };
  if (def.damage.length) common.damage = { parts: def.damage.map(damagePart), critical: { allow: def.mode === "attack" }, onSave: def.onSave };
  if (def.mode === "save") common.save = { ability: [def.save], dc: { calculation: "spellcasting", formula: "" } };
  if (def.mode === "attack") common.attack = { ability: "", bonus: "", critical: { threshold: null }, flat: false, type: { value: def.attack, classification: "spell" } };
  if (def.mode === "heal") common.healing = { number: def.heal[0], denomination: def.heal[1], bonus: "@mod", types: ["healing"], custom: { enabled: false, formula: "" }, scaling: { mode: "whole", number: 1 } };
  return { [activityId]: common };
}

function makeItem(def) {
  const activityId = id(`${def.name}:activity`);
  const damageType = def.damage[0]?.[2];
  const [file, fallback] = animations[damageType] ?? animations[def.school];
  const status = def.conditions[0] ? { id: def.conditions[0], ids: def.conditions, label: def.conditions.join(" + "), core: true, target: def.range.units === "self" ? "self" : "targets", duration: def.statusDuration ?? parseDuration(def.duration, def.concentration), specialDuration: [] } : null;
  const properties = [...def.properties, ...(def.concentration ? ["concentration"] : []), ...(def.ritual ? ["ritual"] : [])];
  const range = def.range.units === "ft" || def.range.units === "mi"
    ? { value: def.range.value, units: def.range.units, special: def.range.special }
    : { value: null, units: def.range.units, special: def.range.special };
  const targetType = def.range.units === "self" ? "self" : "creature";
  const img = "icons/svg/book.svg";
  const description = composeDescription(def, { reviewed: reviewedDescriptions[def.name], translated: translatedDescriptions[def.name], srd: srdDescriptions[def.name] });
  return {
    _id: id(def.name), name: def.name, type: "spell", img,
    system: {
      description: { value: description.html, chat: "" },
      source: { custom: def.source }, level: def.level, school: def.school,
      activation: { type: def.activation, value: def.activationValue, condition: def.activationCondition },
      duration: parseDuration(def.duration, def.concentration), range,
      target: { template: templateFrom(def), affects: { choice: false, count: "1", type: targetType, special: "" } },
      properties, materials: { value: def.materials, consumed: false, cost: 0, supply: 0 },
      preparation: { mode: "prepared", prepared: false }, activities: makeActivity(def, activityId)
    },
    effects: [],
    flags: {
      [flagScope]: {
        animation: { file, fallbacks: [fallback], targeted: def.range.units !== "self" },
        automation: { generated: true, needsReview: true, conditions: def.conditions },
        description: { quality: description.quality, needsReview: !["reviewed-pt-br", "technical-reviewed-pt-br"].includes(description.quality) },
        ...(status ? { status } : {})
      },
      itemacro: { macro: { command: `const workflow = typeof args !== "undefined" ? (args[0]?.workflow ?? args[0]) : null;\nawait game.modules.get("meu-modulo-feiticos")?.api?.runSpell({ item, token, workflow });`, name: def.name, img, type: "script", scope: "global", ownership: { default: 3 }, flags: {} } },
      "midi-qol": { onUseMacroName: "[postActiveEffects]ItemMacro" }
    }
  };
}

for (const level of requestedLevels) {
  const dir = path.join(root, "Spells", `level ${level}`);
  await mkdir(dir, { recursive: true });
  const entries = catalog.filter(def => def.level === level).map(def =>
    finalizeItem(deepMerge(makeItem(def), workflowOverrides[def.name]?.item ?? {}))
  );
  for (const entry of entries) {
    const filename = entry.name.replaceAll("/", "-");
    await writeFile(path.join(dir, `${filename}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  }
  console.log(`Geradas ${entries.length} magias de nível ${level}.`);
}
