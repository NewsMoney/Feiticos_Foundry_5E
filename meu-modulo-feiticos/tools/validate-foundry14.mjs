import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const errors = [];
if (manifest.id !== "meu-modulo-feiticos" || manifest.type !== "module") errors.push("manifesto sem id/type válidos");
if (manifest.compatibility?.minimum !== "14" || manifest.compatibility?.verified !== "14") errors.push("compatibilidade do Foundry não está fixada em V14");
const dnd5e = manifest.relationships?.systems?.find(entry => entry.id === "dnd5e");
if (!dnd5e || dnd5e.compatibility?.minimum !== "5.3.0") errors.push("dependência do D&D5e 5.3+ ausente");
const pack = manifest.packs?.find(entry => entry.name === "feiticos-5e");
if (!pack || pack.path !== "packs/feiticos-5e" || pack.type !== "Item" || pack.system !== "dnd5e") errors.push("definição do compêndio V14 inválida");
if (manifest.scripts?.length || manifest.minimumCoreVersion || manifest.compatibleCoreVersion || manifest.name) errors.push("manifesto contém chaves legadas");
for (const script of manifest.esmodules ?? []) await access(path.join(root, script));

const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "foundry-spells-v14-"));
try {
  await extractPack(path.join(root, pack.path), temporaryDir);
  const files = (await readdir(temporaryDir)).filter(file => file.endsWith(".json"));
  if (files.length !== 517) errors.push(`LevelDB contém ${files.length} entradas em vez de 517`);
  const ids = new Set();
  for (const file of files) {
    const item = JSON.parse(await readFile(path.join(temporaryDir, file), "utf8"));
    if (item.type !== "spell" || !item.system?.activities || !item.system?.description?.value) errors.push(`${item.name ?? file}: estrutura de Item incompleta`);
    if (ids.has(item._id)) errors.push(`${item.name ?? file}: ID duplicado`);
    ids.add(item._id);
  }
} finally {
  await rm(temporaryDir, { recursive: true, force: true });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Foundry 14: manifesto moderno, D&D5e 5.3+ e LevelDB com 517 itens válidos.");
}
