import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPackSources } from "./pack-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const all = [];
for (const [level, expected] of [[1, 77], [2, 86]]) {
  const dir = path.join(root, "Spells", `level ${level}`);
  const files = (await readdir(dir)).filter(file => file.endsWith(".json"));
  if (files.length !== expected) errors.push(`nível ${level}: esperado ${expected}, encontrado ${files.length}`);
  for (const file of files) {
    try {
      const item = JSON.parse(await readFile(path.join(dir, file), "utf8"));
      all.push(item);
      if (!item._id || item.type !== "spell" || item.system?.level !== level) errors.push(`${file}: estrutura básica inválida`);
      if (!Object.keys(item.system?.activities ?? {}).length) errors.push(`${file}: sem atividade`);
      if (!item.flags?.["foundry-spell-pack"]?.animation?.file) errors.push(`${file}: sem animação`);
      if (!item.flags?.itemacro?.macro?.command) errors.push(`${file}: sem macro`);
    } catch (error) { errors.push(`${file}: ${error.message}`); }
  }
}
if (new Set(all.map(item => item.name)).size !== 163) errors.push("nomes ausentes ou duplicados");
const pack = await readPackSources(root);
const packed = pack.filter(item => [1, 2].includes(item.system?.level));
if (packed.length !== 163) errors.push(`compêndio deveria conter 163 magias de níveis 1–2, contém ${packed.length}`);
if (new Set(pack.map(item => item._id)).size !== pack.length) errors.push("IDs duplicados no compêndio");
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(`163 magias de níveis 1 e 2 válidas; compêndio com ${pack.length} entradas únicas.`);
