import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spellRoot = path.join(root, "Spells");
const findings = [];
const areaWords = /\b(raio de|cone de|cubo de|linha de|esfera de|cilindro de|radius|cone|cube|line|sphere|cylinder)\b/i;

function textFromHtml(html) {
  return String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function add(severity, code, item, detail) {
  findings.push({ severity, code, level: item.system?.level, spell: item.name, detail });
}

const levelDirs = (await readdir(spellRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory() && entry.name.startsWith("level "));

for (const levelDir of levelDirs) {
  const directory = path.join(spellRoot, levelDir.name);
  for (const filename of (await readdir(directory)).filter(name => name.endsWith(".json"))) {
    const item = JSON.parse(await readFile(path.join(directory, filename), "utf8"));
    if (item.name === "Virtue (UA)") continue;
    const activities = Object.values(item.system?.activities ?? {});
    const description = textFromHtml(item.system?.description?.value);
    const itemTemplate = item.system?.target?.template ?? {};

    if (!activities.length) add("error", "activity-count", item, "nenhuma atividade encontrada");
    for (const activity of activities) {
      const activityTemplate = activity.target?.template ?? {};
      if (activity.type === "save" && !activity.save?.ability?.length) {
        add("error", "save-without-ability", item, "atividade de salvaguarda sem habilidade");
      }
      if (activity.type === "attack" && !activity.attack?.type?.value) {
        add("error", "attack-without-type", item, "atividade de ataque sem tipo corpo a corpo/à distância");
      }
      if (activities.length === 1
        && (itemTemplate.type !== (activityTemplate.type ?? "")
          || Number(itemTemplate.size ?? 0) !== Number(activityTemplate.size ?? 0))) {
        add("error", "template-mismatch", item, "área do item e da atividade são diferentes");
      }
      if (activity.type === "save" && activity.damage?.parts?.length && !["none", "half", "full"].includes(activity.damage.onSave)) {
        add("error", "invalid-save-damage", item, "comportamento do dano em sucesso não definido");
      }
      if (activityTemplate.type && activity.type !== "utility" && activity.target?.prompt !== true) {
        add("review", "area-without-target-prompt", item, "atividade em área não solicita/res resolve alvos");
      }
    }

    const hasActivityArea = activities.some(activity => activity.target?.template?.type);
    const areaReviewed = item.flags?.["foundry-spell-pack"]?.automation?.areaReviewed === true;
    if (!itemTemplate.type && !hasActivityArea && !areaReviewed && areaWords.test(description)) {
      add("review", "possible-missing-area", item, "descrição menciona uma forma de área, mas o item não possui template");
    }
    if (/<article\b|data-testid=|data-message-id=|class="text-token-text-primary/i.test(item.system?.description?.value ?? "")) {
      add("error", "polluted-description-html", item, "descrição contém HTML copiado de uma interface externa");
    }
  }
}

const order = { error: 0, review: 1 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.level - b.level || a.spell.localeCompare(b.spell));
const counts = findings.reduce((result, finding) => {
  result[finding.severity] = (result[finding.severity] ?? 0) + 1;
  return result;
}, {});

console.log(JSON.stringify({ spells: 517, counts, findings }, null, 2));
if (findings.some(finding => finding.severity === "error")) process.exitCode = 1;
