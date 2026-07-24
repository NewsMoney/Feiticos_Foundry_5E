import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { markdownToHtml } from "./description-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "Spells", "level 0");
const iconDir = path.join(root, "icons");
const moduleIconRoot = "modules/meu-modulo-feiticos/icons";
const srdDescriptions = JSON.parse(await readFile(path.join(root, "data", "descriptions-srd-5.1.json"), "utf8"));
const translatedDescriptionsFile = "descriptions-reviewed-srd-pt-br.json";
const translatedDescriptions = JSON.parse(await readFile(path.join(root, "data", translatedDescriptionsFile), "utf8"));
const reviewedDescriptions = {};
for (const file of (await readdir(path.join(root, "data"))).filter(name => name.startsWith("descriptions-reviewed") && name.endsWith(".json") && name !== translatedDescriptionsFile)) {
  Object.assign(reviewedDescriptions, JSON.parse(await readFile(path.join(root, "data", file), "utf8")));
}
let workflowOverrides = {};
try {
  workflowOverrides = JSON.parse(await readFile(path.join(root, "data", "workflow-overrides-level-0.json"), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
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

const A = "action";
const BA = "bonus";
const defs = [];
const spell = (name, school, mode, options = {}) => defs.push({
  name, school, mode, activation: A, range: 60, duration: { units: "inst" },
  properties: ["vocal", "somatic"], target: "creature", count: "1",
  source: "", description: "", animation: {}, ...options
});

spell("Acid Splash", "con", "save", { save: "dex", damage: [1, 6, "acid"], count: "2", source: "PHB/SRD", description: "Arremessa ácido contra uma ou duas criaturas próximas entre si; cada alvo evita o dano com um teste de Destreza.", animation: { file: "jb2a.liquid.splash.bright_green", targeted: true } });
spell("Blade Ward", "abj", "utility", { range: "self", target: "self", duration: { units: "round", value: "1" }, source: "PHB", description: "Protege o conjurador por uma rodada contra dano físico causado por ataques de armas.", animation: { file: "jb2a.shield.01.intro.blue" }, status: { id: "blade-ward", label: "Blade Ward", target: "self", changes: [{ key: "system.traits.dr.value", mode: 2, value: "bludgeoning", priority: 20 }, { key: "system.traits.dr.value", mode: 2, value: "piercing", priority: 20 }, { key: "system.traits.dr.value", mode: 2, value: "slashing", priority: 20 }], specialDuration: ["turnStartSource"] } });
spell("Booming Blade", "evo", "utility", { range: 5, properties: ["somatic", "material"], source: "SCAG/TCE", description: "Realiza um ataque com arma envolto em energia trovejante; movimento voluntário posterior pode causar dano adicional.", animation: { file: "jb2a.melee_generic.slashing.one_handed", targeted: true, fallbacks: ["jb2a.static_electricity.03.blue"] }, status: { id: "booming-blade", label: "Energia trovejante", specialDuration: ["turnStartSource"] } });
spell("Chill Touch", "nec", "attack", { range: 120, attack: "ranged", damage: [1, 8, "necrotic"], source: "PHB/SRD", description: "Uma mão espectral causa dano necrótico e impede o alvo de recuperar pontos de vida por uma rodada.", animation: { file: "jb2a.ranged.01.projectile.01.dark_purple", targeted: true, fallbacks: ["jb2a.energy_strands.range.standard.dark_purple"] }, status: { id: "chill-touch", label: "Cura bloqueada", changes: [{ key: "flags.midi-qol.noHealing", mode: 5, value: "1", priority: 20 }], specialDuration: ["turnStartSource"] } });
spell("Control Flames", "trs", "utility", { range: 60, properties: ["somatic"], duration: { units: "hour", value: "1" }, target: "space", source: "EE/XGE", description: "Manipula uma chama não mágica, alterando sua forma, luz, tamanho ou extinguindo-a.", animation: { file: "jb2a.fireflies.few.01.orange", fallbacks: ["jb2a.cast_shape.circle.01.yellow"] } });
spell("Create Bonfire", "con", "save", { save: "dex", damage: [1, 8, "fire"], range: 60, target: "space", duration: { units: "minute", value: "1" }, concentration: true, source: "EE/XGE", description: "Cria uma fogueira mágica que queima criaturas em seu espaço enquanto a concentração for mantida.", animation: { file: "jb2a.bonfire.01.orange", persistent: true, belowTokens: true, fallbacks: ["jb2a.fire_trap.02.single.orange"] } });
spell("Dancing Lights", "evo", "utility", { range: 120, duration: { units: "minute", value: "1" }, concentration: true, properties: ["vocal", "somatic", "material"], target: "space", source: "PHB/SRD", description: "Cria até quatro luzes móveis que podem ser controladas enquanto durar a concentração.", animation: { file: "jb2a.dancing_light.blueyellow", fallbacks: ["jb2a.markers.light_orb.complete.yellow"] } });
spell("Druidcraft", "trs", "utility", { range: 30, source: "PHB/SRD", description: "Produz um pequeno efeito natural, como prever o clima, florescer uma planta ou criar um sinal sensorial.", animation: { file: "jb2a.cast_shape.circle.01.green", fallbacks: ["jb2a.swirling_leaves.outburst.01"] } });
spell("Eldritch Blast", "evo", "attack", { range: 120, attack: "ranged", damage: [1, 10, "force"], source: "PHB/SRD", description: "Dispara um raio de energia arcana; cria raios adicionais conforme o nível do conjurador.", animation: { file: "jb2a.eldritch_blast.purple", targeted: true, fallbacks: ["jb2a.eldritch_blast.dark_purple"] } });
spell("Encode Thoughts", "enc", "utility", { range: "self", duration: { units: "hour", value: "8" }, properties: ["somatic"], source: "GGR", description: "Extrai uma memória ou ideia da mente e a transforma em um filamento psíquico temporário.", animation: { file: "jb2a.detect_magic.circle.purple", fallbacks: ["jb2a.magic_signs.rune.enchantment.intro.purple"] } });
spell("Fire Bolt", "evo", "attack", { range: 120, attack: "ranged", damage: [1, 10, "fire"], source: "PHB/SRD", description: "Lança uma centelha de fogo que causa dano e pode incendiar objetos desprotegidos.", animation: { file: "jb2a.fire_bolt.orange", targeted: true } });
spell("Friends", "enc", "utility", { range: "self", target: "self", duration: { units: "minute", value: "1" }, concentration: true, properties: ["somatic", "material"], source: "PHB", description: "Concede vantagem temporária em testes sociais contra uma criatura, que percebe a influência ao final.", animation: { file: "jb2a.markers.heart.pink", fallbacks: ["jb2a.magic_signs.rune.enchantment.intro.pink"] }, status: { id: "friends", label: "Friends", target: "self", changes: [{ key: "flags.midi-qol.advantage.skill.cha", mode: 5, value: "1", priority: 20 }], specialDuration: ["turnEndSource"] } });
spell("Frostbite", "evo", "save", { save: "con", damage: [1, 6, "cold"], source: "EE/XGE", description: "Congela momentaneamente o alvo e prejudica o próximo ataque com arma que ele realizar.", animation: { file: "jb2a.ray_of_frost.blue", targeted: true, fallbacks: ["jb2a.impact.frost.blue"] }, status: { id: "frostbite", label: "Frostbite", changes: [{ key: "flags.midi-qol.disadvantage.attack.mwak", mode: 5, value: "1", priority: 20 }, { key: "flags.midi-qol.disadvantage.attack.rwak", mode: 5, value: "1", priority: 20 }], specialDuration: ["1Attack", "turnEndSource"] } });
spell("Green-Flame Blade", "evo", "utility", { range: 5, properties: ["somatic", "material"], source: "SCAG/TCE", description: "Um ataque com arma conduz fogo verde ao alvo e, em níveis maiores, a uma segunda criatura próxima.", animation: { file: "jb2a.melee_generic.slashing.one_handed", targeted: true, fallbacks: ["jb2a.fire_bolt.green"] } });
spell("Guidance", "div", "utility", { range: "touch", duration: { units: "minute", value: "1" }, concentration: true, source: "PHB/SRD", description: "O alvo pode adicionar 1d4 a um teste de habilidade realizado antes do fim da magia.", animation: { file: "jb2a.bless.400px.intro.yellow", targeted: true, fallbacks: ["jb2a.magic_signs.rune.divination.intro.yellow"] }, status: { id: "guidance", label: "Guidance", changes: [{ key: "system.bonuses.abilities.check", mode: 2, value: "1d4", priority: 20 }], specialDuration: ["isCheck", "turnEndSource"] } });
spell("Gust", "trs", "save", { save: "str", range: 30, source: "EE/XGE", description: "Produz uma rajada que empurra uma criatura ou movimenta um objeto leve e desprotegido.", animation: { file: "jb2a.gust_of_wind.veryfast", targeted: true, fallbacks: ["jb2a.wind_stream.white"] } });
spell("Infestation", "con", "save", { save: "con", damage: [1, 6, "poison"], range: 30, properties: ["vocal", "somatic", "material"], source: "XGE", description: "Invoca parasitas que causam dano venenoso e podem forçar um deslocamento curto e aleatório.", animation: { file: "jb2a.bats.loop.01", targeted: true, fallbacks: ["jb2a.bats.complete.01"] } });
spell("Light", "evo", "utility", { range: "touch", duration: { units: "hour", value: "1" }, properties: ["vocal", "material"], target: "object", source: "PHB/SRD", description: "Faz um objeto emitir luz por até uma hora.", animation: { file: "jb2a.markers.light_orb.complete.yellow", targeted: true }, status: { id: "light", label: "Luz", changes: [{ key: "ATL.light.dim", mode: 5, value: "40", priority: 20 }, { key: "ATL.light.bright", mode: 5, value: "20", priority: 20 }], specialDuration: [] } });
spell("Lightning Lure", "evo", "save", { save: "str", damage: [1, 8, "lightning"], range: 15, properties: ["vocal"], source: "SCAG/TCE", description: "Puxa uma criatura em sua direção e causa dano elétrico se ela terminar próxima de você.", animation: { file: "jb2a.chain_lightning.primary.blue", targeted: true, fallbacks: ["jb2a.lightning_ball.blue"] } });
spell("Mage Hand", "con", "utility", { range: 30, duration: { units: "minute", value: "1" }, source: "PHB/SRD", description: "Cria uma mão espectral capaz de manipular objetos leves à distância.", animation: { file: "jb2a.arcane_hand.blue", targeted: true, fallbacks: ["jb2a.markers.light.complete.blue"] } });
spell("Magic Stone", "trs", "attack", { activation: BA, range: 60, attack: "ranged", damage: [1, 6, "bludgeoning"], properties: ["vocal", "somatic"], source: "EE/XGE", description: "Imbui até três pedras; elas podem ser arremessadas ou disparadas para causar dano mágico.", animation: { file: "jb2a.boulder.toss.01", targeted: true, fallbacks: ["jb2a.boulder.toss.01"] } });
spell("Mending", "trs", "utility", { activation: "minute", range: "touch", properties: ["vocal", "somatic", "material"], target: "object", source: "PHB/SRD", description: "Repara uma única ruptura ou rasgo pequeno em um objeto tocado.", animation: { file: "jb2a.magic_signs.rune.transmutation.intro.yellow", targeted: true, fallbacks: ["jb2a.cure_wounds.400px.yellow"] } });
spell("Message", "trs", "utility", { range: 120, duration: { units: "round", value: "1" }, properties: ["somatic", "material"], source: "PHB/SRD", description: "Envia uma mensagem sussurrada a uma criatura, que pode responder de modo igualmente discreto.", animation: { file: "jb2a.energy_strands.range.standard.blue", targeted: true, fallbacks: ["jb2a.icon.music_note.blue"] } });
spell("Mind Sliver", "enc", "save", { save: "int", damage: [1, 6, "psychic"], properties: ["vocal"], source: "TCE", description: "Fere a mente do alvo e reduz em 1d4 o próximo teste de resistência que ele fizer.", animation: { file: "jb2a.lasershot.pink", targeted: true, fallbacks: ["jb2a.impact.004.dark_purple"] }, status: { id: "mind-sliver", label: "Mind Sliver", changes: [{ key: "system.bonuses.abilities.save", mode: 2, value: "-1d4", priority: 20 }], specialDuration: ["isSave", "turnEndSource"] } });
spell("Minor Illusion", "ill", "utility", { range: 30, duration: { units: "minute", value: "1" }, properties: ["somatic", "material"], target: "space", source: "PHB/SRD", description: "Cria um som ou uma imagem ilusória simples e imóvel por até um minuto.", animation: { file: "jb2a.magic_signs.rune.illusion.intro.purple", targeted: true, fallbacks: ["jb2a.markers.smoke.ring.loop"] } });
spell("Mold Earth", "trs", "utility", { range: 30, properties: ["somatic"], target: "space", source: "EE/XGE", description: "Escava, move ou altera visualmente uma pequena porção de terra ou pedra solta.", animation: { file: "jb2a.impact.ground_crack.orange.01", targeted: true, fallbacks: ["jb2a.eruption.orange.01"] } });
spell("Poison Spray", "con", "save", { save: "con", damage: [1, 12, "poison"], range: 10, source: "PHB/SRD", description: "Projeta uma nuvem tóxica de curto alcance contra uma criatura.", animation: { file: "jb2a.breath_weapons.poison.cone.green", targeted: true, fallbacks: ["jb2a.cloud_of_daggers.daggers.green"] } });
spell("Prestidigitation", "trs", "utility", { range: 10, duration: { units: "hour", value: "1" }, source: "PHB/SRD", description: "Produz pequenos truques mágicos sensoriais, limpa, suja, aquece, resfria ou marca objetos.", animation: { file: "jb2a.magic_signs.rune.transmutation.intro.purple", fallbacks: ["jb2a.swirling_sparkles.01.blue"] } });
spell("Primal Savagery", "trs", "attack", { range: "self", attack: "melee", damage: [1, 10, "acid"], properties: ["somatic"], source: "XGE", description: "Transforma dentes ou unhas para realizar um ataque mágico corpo a corpo que causa dano ácido.", animation: { file: "jb2a.claws.400px.bright_green", targeted: true, fallbacks: ["jb2a.liquid.splash.bright_green"] } });
spell("Produce Flame", "con", "attack", { range: 30, attack: "ranged", damage: [1, 8, "fire"], duration: { units: "minute", value: "10" }, source: "PHB/SRD", description: "Cria uma chama na mão que ilumina e pode ser arremessada contra uma criatura.", animation: { file: "jb2a.flames.01.orange", targeted: true, fallbacks: ["jb2a.fire_bolt.orange"] } });
spell("Ray of Frost", "evo", "attack", { range: 60, attack: "ranged", damage: [1, 8, "cold"], source: "PHB/SRD", description: "Um raio gelado causa dano e reduz o deslocamento do alvo até o próximo turno.", animation: { file: "jb2a.ray_of_frost.blue", targeted: true }, status: { id: "ray-of-frost", label: "Deslocamento reduzido", changes: [{ key: "system.attributes.movement.walk", mode: 2, value: "-10", priority: 20 }], specialDuration: ["turnStartSource"] } });
spell("Resistance", "abj", "utility", { range: "touch", duration: { units: "minute", value: "1" }, concentration: true, properties: ["vocal", "somatic", "material"], source: "PHB/SRD", description: "O alvo pode adicionar 1d4 a um teste de resistência realizado antes do fim da magia.", animation: { file: "jb2a.bless.400px.intro.blue", targeted: true, fallbacks: ["jb2a.shield.01.intro.blue"] }, status: { id: "resistance", label: "Resistance", changes: [{ key: "system.bonuses.abilities.save", mode: 2, value: "1d4", priority: 20 }], specialDuration: ["isSave", "turnEndSource"] } });
spell("Sacred Flame", "evo", "save", { save: "dex", damage: [1, 8, "radiant"], source: "PHB/SRD", description: "Uma chama radiante desce sobre o alvo e ignora benefícios de cobertura no teste de resistência.", animation: { file: "jb2a.sacred_flame.target.yellow", targeted: true, fallbacks: ["jb2a.impact.004.yellow"] } });
spell("Sapping Sting", "nec", "save", { save: "con", damage: [1, 4, "necrotic"], range: 30, source: "EGW", description: "Drena a vitalidade do alvo e o derruba quando ele falha no teste de resistência.", animation: { file: "jb2a.energy_strands.complete.dark_purple", targeted: true, fallbacks: ["jb2a.impact.004.dark_purple"] }, status: { id: "prone", label: "Caído", core: true, duration: {} } });
spell("Shape Water", "trs", "utility", { range: 30, properties: ["somatic"], target: "space", duration: { units: "hour", value: "1" }, source: "EE/XGE", description: "Move, congela, colore ou modela uma pequena quantidade de água não mágica.", animation: { file: "jb2a.liquid.splash.blue", targeted: true, fallbacks: ["jb2a.water_splash.circle.01.blue"] } });
spell("Shillelagh", "trs", "utility", { activation: BA, range: "touch", duration: { units: "minute", value: "1" }, properties: ["vocal", "somatic", "material"], target: "object", source: "PHB/SRD", description: "Imbui um bordão ou clava para usar a habilidade de conjuração e causar dano mágico.", animation: { file: "jb2a.swirling_sparkles.01.greenorange", targeted: true, fallbacks: ["jb2a.magic_signs.rune.transmutation.intro.green"] }, status: { id: "shillelagh", label: "Shillelagh", target: "self", specialDuration: [] } });
spell("Shocking Grasp", "evo", "attack", { range: "touch", attack: "melee", damage: [1, 8, "lightning"], source: "PHB/SRD", description: "Um toque elétrico causa dano e impede o alvo de realizar reações por uma rodada.", animation: { file: "jb2a.static_electricity.03.blue", targeted: true, fallbacks: ["jb2a.static_electricity.03.blue"] }, status: { id: "shocking-grasp", label: "Sem reações", changes: [{ key: "flags.midi-qol.fail.ability.check.reaction", mode: 5, value: "1", priority: 20 }], specialDuration: ["turnStartSource"] } });
spell("Spare the Dying", "nec", "utility", { range: "touch", properties: ["vocal", "somatic"], source: "PHB/SRD", description: "Estabiliza uma criatura viva que esteja morrendo.", animation: { file: "jb2a.cure_wounds.400px.blue", targeted: true, fallbacks: ["jb2a.healing_generic.200px.blue"] }, status: { id: "stable", label: "Estável", core: true, duration: {} } });
spell("Sword Burst", "con", "save", { save: "dex", damage: [1, 6, "force"], range: "self", rangeSpecial: "Emanação de 1,5 metro (1 quadrado)", target: "creature", count: "", properties: ["vocal"], source: "SCAG/TCE", description: "Lâminas espectrais atingem todas as criaturas próximas que falharem no teste de Destreza.", emanation: { radius: 5, radiusSquares: 1, excludeSelf: true }, animation: { file: "jb2a.explosion.01.blue", fallbacks: ["jb2a.explosion.shrapnel.bomb.01.blue"] } });
spell("Thaumaturgy", "trs", "utility", { range: 30, duration: { units: "minute", value: "1" }, properties: ["vocal"], source: "PHB/SRD", description: "Manifesta um pequeno prodígio, alterando voz, chamas, portas ou sinais sensoriais.", animation: { file: "jb2a.magic_signs.rune.transmutation.intro.red", fallbacks: ["jb2a.divine_smite.caster.standard"] } });
spell("Thorn Whip", "trs", "attack", { range: 30, attack: "melee", damage: [1, 6, "piercing"], properties: ["vocal", "somatic", "material"], source: "PHB/SRD", description: "Um chicote espinhoso causa dano e pode puxar uma criatura grande ou menor em sua direção.", animation: { file: "jb2a.energy_strands.range.standard.dark_green", targeted: true, fallbacks: ["jb2a.vine.loop.nature.group.01.green"] } });
spell("Thunderclap", "evo", "save", {
  save: "con",
  damage: [1, 6, "thunder"],
  range: "self",
  rangeSpecial: "Emanação de 1,5 metro (1 quadrado)",
  target: "creature",
  count: "",
  properties: ["somatic"],
  source: "EE/XGE",
  description: "Uma explosão sonora atinge todas as criaturas próximas e pode ser ouvida à distância.",
  emanation: { radius: 5, radiusSquares: 1, excludeSelf: true },
  animation: {
    file: "jb2a.thunderwave.center.blue",
    scale: 0.5,
    layers: [
      { file: "jb2a.impact.boulder.01", scale: 1, belowTokens: true, duration: 2000 },
      { file: "jb2a.thunderwave.center.blue", scale: 0.5, duration: 1043 }
    ],
    sound: "modules/meu-modulo-feiticos/sounds/thunderclap.wav",
    volume: 0.5,
    audibleRadiusMeters: 30,
    audibleRadiusFeet: 100,
    restrictVisualToVision: true
  }
});
spell("Toll the Dead", "nec", "save", { save: "wis", damage: [1, 8, "necrotic"], source: "XGE", description: "Um sino fúnebre causa dano necrótico, usando d12 se o alvo já tiver perdido pontos de vida.", animation: { file: "jb2a.toll_the_dead.yellow.shockwave", targeted: true, fallbacks: ["jb2a.impact.004.dark_purple"] } });
spell("True Strike", "div", "utility", { range: 30, duration: { units: "round", value: "1" }, concentration: true, properties: ["somatic"], source: "PHB/SRD", description: "Concede vantagem no primeiro ataque do conjurador contra o alvo no turno seguinte.", animation: { file: "jb2a.markers.light.complete.blue", targeted: true, fallbacks: ["jb2a.magic_signs.rune.divination.intro.blue"] }, status: { id: "true-strike", label: "True Strike", target: "self", changes: [{ key: "flags.midi-qol.advantage.attack.all", mode: 5, value: "1", priority: 20 }], specialDuration: ["1Attack", "turnEndSource"] } });
spell("Vicious Mockery", "enc", "save", { save: "wis", damage: [1, 4, "psychic"], range: 60, properties: ["vocal"], source: "PHB/SRD", description: "Um insulto encantado causa dano psíquico e prejudica o próximo ataque do alvo.", animation: { file: "jb2a.icon.music_note.blue", targeted: true, fallbacks: ["jb2a.impact.004.dark_purple"] }, status: { id: "vicious-mockery", label: "Vicious Mockery", changes: [{ key: "flags.midi-qol.disadvantage.attack.all", mode: 5, value: "1", priority: 20 }], specialDuration: ["1Attack", "turnEndSource"] } });
spell("Word of Radiance", "evo", "save", { save: "con", damage: [1, 6, "radiant"], range: "self", rangeSpecial: "Emanação de 1,5 metro (1 quadrado)", target: "enemy", targetChoice: true, count: "", properties: ["vocal", "material"], source: "XGE", description: "Uma palavra divina fere criaturas escolhidas ao redor do conjurador com energia radiante.", emanation: { radius: 5, radiusSquares: 1, excludeSelf: true, disposition: "enemy", requireVision: true }, animation: { file: "jb2a.divine_smite.caster.yellowwhite", fallbacks: ["jb2a.toll_the_dead.yellow.shockwave"] } });

const normalize = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = { wordofradiance: "Word of Radience.png", thunderclap: "Thunder Clap.png", resistance: "Resistence.png", guidance: "Guidence.png", prestidigitation: "Pretidigitation.png", minorillusion: "Minor Ilusion.png", message: "Mensage.png", primalsavagery: "Primal.png" };
const icons = await readdir(iconDir);
const iconMap = new Map(icons.map(file => [normalize(path.parse(file).name), file]));
const id = name => crypto.createHash("sha256").update(name).digest("base64url").slice(0, 16);

function damagePart([number, denomination, type]) {
  return { custom: { enabled: false, formula: "" }, number, denomination, bonus: "", types: [type], scaling: { mode: "whole", number: 1 } };
}

function targetTemplate(def, { emptyType = false } = {}) {
  return {
    contiguous: false,
    units: "ft",
    ...(def.template?.type ? { type: def.template.type } : emptyType ? { type: "" } : {}),
    ...(def.template?.size ? { size: def.template.size } : {})
  };
}

function activity(def, activityId) {
  const common = {
    type: def.mode,
    activation: { type: def.activation, value: def.activation === "minute" ? 1 : null, override: false, condition: "" },
    consumption: { scaling: { allowed: false }, spellSlot: false, targets: [] },
    description: { chatFlavor: "" },
    duration: { units: def.duration.units, value: def.duration.value ?? "", concentration: !!def.concentration, override: false },
    effects: [], range: { override: false },
    target: {
      template: targetTemplate(def),
      affects: {
        choice: !!def.targetChoice,
        count: def.count,
        type: def.target,
        special: def.targetSpecial ?? ""
      },
      override: false,
      prompt: !def.emanation
    },
    uses: { spent: 0, recovery: [], max: "" }, midiProperties: {},
    overTimeProperties: { saveRemoves: true, preRemoveConditionText: "", postRemoveConditionText: "" }
  };
  if (def.damage) common.damage = { parts: [damagePart(def.damage)], critical: { allow: def.mode === "attack" }, onSave: def.mode === "save" ? "none" : "full" };
  if (def.mode === "save") common.save = { ability: [def.save], dc: { calculation: "spellcasting", formula: "" } };
  if (def.mode === "attack") common.attack = { ability: "", bonus: "", critical: { threshold: null }, flat: false, type: { value: def.attack, classification: "spell" } };
  const requiresTargetChoice = ["creature", "enemy", "creatureOrObject", "object"].includes(def.target);
  if (requiresTargetChoice && !def.emanation) common.forcedTargetConfirmation = "always";
  return { [activityId]: common };
}

function item(def) {
  const activityId = id(`${def.name}:activity`);
  const iconFile = aliases[normalize(def.name)] ?? iconMap.get(normalize(def.name));
  const img = iconFile ? `${moduleIconRoot}/${encodeURIComponent(iconFile)}` : "icons/svg/mystery-man.svg";
  const srd = srdDescriptions[def.name];
  const reviewed = reviewedDescriptions[def.name];
  const translated = translatedDescriptions[def.name];
  const description = reviewed ?? translated ?? `<p>${def.description}</p><p><strong>Fonte:</strong> ${def.source}. <strong>Escalonamento:</strong> os dados de dano aumentam nos níveis 5, 11 e 17 quando aplicável.</p>${srd ? `<hr><section class="foundry-spell-pack-srd"><h3>Descrição integral — SRD 5.1 (inglês)</h3>${markdownToHtml(srd)}<p><small>Conteúdo SRD 5.1 licenciado sob CC BY 4.0; consulte ATTRIBUTION.md.</small></p></section>` : ""}`;
  return {
    _id: id(def.name), name: def.name, type: "spell", img,
    system: {
      description: { value: description, chat: "" },
      source: { custom: def.source }, level: 0, school: def.school,
      activation: { type: def.activation, value: def.activation === "minute" ? 1 : null, condition: "" },
      duration: def.duration,
      range: typeof def.range === "number" ? { value: def.range, units: "ft", special: def.rangeSpecial ?? "" } : { value: null, units: def.range, special: def.rangeSpecial ?? "" },
      target: { template: targetTemplate(def, { emptyType: true }), affects: { choice: false, count: def.count, type: def.target, special: "" } },
      properties: [...def.properties, ...(def.concentration ? ["concentration"] : [])],
      materials: { value: "Consulte a fonte indicada.", consumed: false, cost: 0, supply: 0 },
      preparation: { mode: "prepared", prepared: false }, activities: activity(def, activityId)
    },
    effects: [],
    flags: {
      ["foundry-spell-pack"]: {
        animation: def.animation,
        description: { quality: reviewed ? "reviewed-pt-br" : translated ? "technical-reviewed-pt-br" : srd ? "srd-full+summary-pt-br" : "summary-pt-br", needsReview: !reviewed && !translated && !srd },
        ...(def.emanation ? { automation: { areaReviewed: true, area: { type: "emanation", ...def.emanation } } } : {}),
        ...(def.status ? { status: def.status } : {})
      },
      itemacro: { macro: {
        command: def.emanation
          ? `const context = typeof args !== "undefined" ? args[0] : null;
const module = game.modules.get("meu-modulo-feiticos");
const workflow = globalThis.MidiQOL?.Workflow?.getWorkflow?.(context?.uuid) ?? context?.workflow ?? context;
await module?.api?.runCantrip({ item, token, workflow, context });`
          : `const workflow = typeof args !== "undefined" ? (args[0]?.workflow ?? args[0]) : null;\nawait game.modules.get("meu-modulo-feiticos")?.api?.runCantrip({ item, token, workflow });`,
        name: def.name, img, type: "script", scope: "global", ownership: { default: 3 }, flags: {}
      } },
      "midi-qol": {
        onUseMacroName: def.emanation
          ? "[preSave]ItemMacro"
          : "[postActiveEffects]ItemMacro"
      }
    }
  };
}

await mkdir(outputDir, { recursive: true });
for (const def of defs) Object.assign(def, workflowOverrides[def.name]?.definition ?? {});
const generated = defs.map(def => finalizeItem(deepMerge(item(def), workflowOverrides[def.name]?.item ?? {})));
for (const generatedItem of generated) await writeFile(path.join(outputDir, `${generatedItem.name}.json`), `${JSON.stringify(generatedItem, null, 2)}\n`);
console.log(`Gerados ${defs.length} truques em ${outputDir}`);
