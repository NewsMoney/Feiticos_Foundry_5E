import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToHtml } from "./description-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const source = JSON.parse(await readFile(path.join(dataDir, "descriptions-srd-5.1.json"), "utf8"));
const reviewed = JSON.parse(await readFile(path.join(dataDir, "descriptions-reviewed-srd-pt-br.json"), "utf8"));
const errors = [];
const dicePattern = /\b\d+d\d+\b/gi;
const englishRules = /saving throw|at higher levels|spell slot|hit points|\bfeet\b|\bfoot\b|\bdamage\b|\bcreature\b/i;
const abilities = { Strength: "Força", Dexterity: "Destreza", Constitution: "Constituição", Intelligence: "Inteligência", Wisdom: "Sabedoria", Charisma: "Carisma" };
const damageTypes = { acid: "ácido", bludgeoning: "concussão", cold: "frio", fire: "fogo", force: "força|energia", lightning: "elétrico|elétrica|raio", necrotic: "necrótico|necrótica", piercing: "perfurante", poison: "veneno|venenoso|venenosa", psychic: "psíquico|psíquica", radiant: "radiante", slashing: "cortante", thunder: "trovejante|trovão" };
const conditions = { blinded: "ceg", charmed: "enfeitiç|encant", deafened: "surd|ensurdec", frightened: "amedront|assust|medo", incapacitated: "incapacit", invisible: "invisíve", paralyzed: "paralis", poisoned: "envenen", prone: "caíd|derrub|cair|cai ", restrained: "impedid|contid|restringid", stunned: "atordoad", unconscious: "inconsciente", petrified: "petrific|pedra" };
const count = (text, pattern) => (text.match(pattern) ?? []).length;
for (const [name, target] of Object.entries(reviewed)) {
  const markdown = source[name];
  if (!markdown) { errors.push(`${name}: tradução sem fonte SRD`); continue; }
  const sourceDice = (markdownToHtml(markdown).match(dicePattern) ?? []).map(value => value.toLowerCase()).sort().join(",");
  const targetDice = (target.match(dicePattern) ?? []).map(value => value.toLowerCase()).sort().join(",");
  if (sourceDice !== targetDice) errors.push(`${name}: dados divergentes (${sourceDice} != ${targetDice})`);
  if (target.length < 80) errors.push(`${name}: tradução curta demais`);
  if (englishRules.test(target)) errors.push(`${name}: termos importantes ainda em inglês`);
  if (/\bsalvamento\b|\bslots?\b|\brerrolagem\b|\bCD para salvar magias\b|\btestes de resistência de CA\b/i.test(target)) errors.push(`${name}: tradução literal de termo mecânico`);
  if (/\b(?:pés?|milhas?)\b/i.test(target)) errors.push(`${name}: unidade imperial não convertida`);
  if (/\[[^\]]+\]\([^)]*\)|<em>\s*<\/em>|\]\([^)]*\)\*/.test(target)) errors.push(`${name}: marcação residual ou deformada`);
  if (/\b(?:um|o|do|no|pelo|este|esse|aquele|seu|teu|meu|outro|algum|nenhum) magia\b/i.test(target)) errors.push(`${name}: concordância nominal incorreta`);
  if (!/^<(?:p|pre)>/.test(target) || !/<\/(?:p|pre)>$/.test(target)) errors.push(`${name}: HTML incompleto`);
  const sourceBullets = (markdown.match(/^\s*\* /gm) ?? []).length;
  const targetBullets = (target.match(/(?:<p>|<br>)\s*\* /g) ?? []).length;
  if (sourceBullets !== targetBullets) errors.push(`${name}: itens de lista divergentes (${sourceBullets} != ${targetBullets})`);
  const sourceHeadings = (markdown.match(/\*\*[^*]+\*\*/g) ?? []).length;
  const targetHeadings = (target.match(/<strong>/g) ?? []).length;
  if (sourceHeadings !== targetHeadings) errors.push(`${name}: subtítulos divergentes (${sourceHeadings} != ${targetHeadings})`);
  const sourceTables = (markdown.match(/^\|.+\|$/gm) ?? []).length;
  const targetTableRows = [...target.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].reduce((count, match) => count + (match[1].match(/\|(?:<br>|$)/g) ?? []).length, 0);
  if (sourceTables !== targetTableRows) errors.push(`${name}: linhas de tabela divergentes (${sourceTables} != ${targetTableRows})`);
  for (const [ability, translatedAbility] of Object.entries(abilities)) {
    const expected = count(markdown, new RegExp(`${ability} saving throw`, "gi"));
    const found = count(target, new RegExp(`(?:teste de )?resistência (?:bem-sucedido )?de ${translatedAbility}`, "gi"));
    if (expected > 0 && found === 0 && !(new RegExp("testes? de resistência", "i").test(target) && new RegExp(translatedAbility, "i").test(target))) errors.push(`${name}: teste de ${translatedAbility} ausente`);
  }
  for (const [type, translatedType] of Object.entries(damageTypes)) {
    if (new RegExp(`\\b${type} damage\\b`, "i").test(markdown) && !new RegExp(`(?:${translatedType})`, "i").test(target)) errors.push(`${name}: tipo de dano ${type} ausente`);
  }
  for (const [condition, translatedCondition] of Object.entries(conditions)) {
    if (new RegExp(`\\b${condition}\\b`, "i").test(markdown) && !new RegExp(`(?:${translatedCondition})`, "i").test(target)) errors.push(`${name}: condição ${condition} ausente`);
  }
  const sourcePercentages = [...markdown.matchAll(/\b(\d+)\s*percent\b/gi)].map(match => match[1]).sort().join(",");
  const targetPercentages = [...target.matchAll(/\b(\d+)\s*(?:%|por cento)/gi)].map(match => match[1]).sort().join(",");
  if (sourcePercentages !== targetPercentages) errors.push(`${name}: percentuais divergentes (${sourcePercentages} != ${targetPercentages})`);
  const stack = [];
  for (const match of target.matchAll(/<\/?(p|pre|strong|em)>/g)) {
    const closing = match[0][1] === "/";
    if (!closing) stack.push(match[1]);
    else if (stack.pop() !== match[1]) { errors.push(`${name}: aninhamento HTML inválido`); break; }
  }
  if (stack.length) errors.push(`${name}: tags HTML não fechadas`);
}
if (Object.keys(reviewed).length !== 277) errors.unshift(`esperadas 277 traduções automáticas, encontradas ${Object.keys(reviewed).length}`);
if (errors.length) {
  console.error(errors.slice(0, 100).join("\n"));
  if (errors.length > 100) console.error(`... e mais ${errors.length - 100} erros.`);
  process.exitCode = 1;
} else console.log("277 descrições SRD traduzidas para pt-BR, com dados, terminologia crítica e HTML validados.");
