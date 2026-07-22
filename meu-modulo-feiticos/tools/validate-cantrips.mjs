import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPackSources } from "./pack-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spellDir = path.join(root, "Spells", "level 0");
const expected = 46;
const allFiles = (await readdir(spellDir)).filter(file => file.endsWith(".json"));
const errors = [];
const names = new Set();
let officialCount = 0;

for (const file of allFiles) {
  let item;
  try { item = JSON.parse(await readFile(path.join(spellDir, file), "utf8")); }
  catch (error) { errors.push(`${file}: JSON inválido (${error.message})`); continue; }
  if (item.name === "Virtue (UA)") continue;
  officialCount += 1;
  if (!item._id || !item.name || item.type !== "spell" || item.system?.level !== 0) errors.push(`${file}: estrutura básica inválida`);
  if (names.has(item.name)) errors.push(`${file}: nome duplicado (${item.name})`);
  names.add(item.name);
  if (!Object.keys(item.system?.activities ?? {}).length) errors.push(`${file}: sem atividade`);
  if (!item.flags?.["foundry-spell-pack"]?.animation?.file) errors.push(`${file}: sem animação`);
  if (!item.flags?.itemacro?.macro?.command) errors.push(`${file}: sem macro de integração`);
  if (!item.img?.startsWith("modules/meu-modulo-feiticos/icons/") || item.img.endsWith("mystery-man.svg")) errors.push(`${file}: caminho de ícone inválido ou ausente`);
}

if (officialCount !== expected) errors.push(`esperados ${expected} JSONs oficiais, encontrados ${officialCount}`);
try {
  const pack = await readPackSources(root);
  const packedCantrips = pack.filter(item => item.system?.level === 0);
  if (packedCantrips.length !== expected) errors.push(`compêndio deveria conter ${expected} truques, contém ${packedCantrips.length}`);
  if (new Set(pack.map(item => item._id)).size !== pack.length) errors.push("compêndio possui IDs duplicados");
} catch (error) { errors.push(`compêndio inválido (${error.message})`); }
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(`${officialCount} truques oficiais válidos, únicos, animados e com atividade.`);
