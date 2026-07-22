import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spellFolders } from "./pack-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const errors = [];
if (manifest.id !== "meu-modulo-feiticos" || manifest.type !== "module") errors.push("manifesto sem id/type válidos");
if (manifest.compatibility?.minimum !== "14" || manifest.compatibility?.verified !== "14") errors.push("compatibilidade do Foundry não está fixada em V14");
const dnd5e = manifest.relationships?.systems?.find(entry => entry.id === "dnd5e");
if (!dnd5e || dnd5e.compatibility?.minimum !== "5.3.0") errors.push("dependência do D&D5e 5.3+ ausente");
const requiredModules = new Map((manifest.relationships?.requires ?? []).map(entry => [entry.id, entry]));
for (const id of ["sequencer", "JB2A_DnD5e", "midi-qol", "dae", "itemacro"]) {
  const dependency = requiredModules.get(id);
  if (!dependency || dependency.type !== "module" || !dependency.manifest || !dependency.compatibility?.minimum) {
    errors.push(`dependência obrigatória ${id} ausente ou incompleta`);
  }
}
const pack = manifest.packs?.find(entry => entry.name === "feiticos-5e");
if (!pack || pack.path !== "packs/feiticos-5e" || pack.type !== "Item" || pack.system !== "dnd5e") errors.push("definição do compêndio V14 inválida");
if (manifest.scripts?.length || manifest.minimumCoreVersion || manifest.compatibleCoreVersion || manifest.name) errors.push("manifesto contém chaves legadas");
for (const script of manifest.esmodules ?? []) await access(path.join(root, script));

const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "foundry-spells-v14-"));
try {
  const temporaryPack = path.join(temporaryDir, "pack");
  const extractedPack = path.join(temporaryDir, "extracted");
  await cp(path.join(root, pack.path), temporaryPack, { recursive: true });
  await mkdir(extractedPack);
  await extractPack(temporaryPack, extractedPack);
  const files = (await readdir(extractedPack)).filter(file => file.endsWith(".json"));
  const documents = await Promise.all(files.map(async file => JSON.parse(await readFile(path.join(extractedPack, file), "utf8"))));
  const items = documents.filter(document => document._key?.startsWith("!items!"));
  const folders = documents.filter(document => document._key?.startsWith("!folders!"));
  if (items.length !== 517) errors.push(`LevelDB contém ${items.length} itens em vez de 517`);
  if (folders.length !== spellFolders.length) errors.push(`LevelDB contém ${folders.length} pastas em vez de ${spellFolders.length}`);
  const expectedFolders = new Map(spellFolders.map(folder => [folder._id, folder]));
  for (const folder of folders) {
    const expected = expectedFolders.get(folder._id);
    if (!expected) errors.push(`${folder.name ?? folder._id}: pasta inesperada`);
    else if (folder.name !== expected.name || folder.type !== "Item" || folder.folder !== null || folder.sorting !== "a") {
      errors.push(`${folder.name ?? folder._id}: estrutura de pasta inválida`);
    }
  }
  const ids = new Set();
  for (const item of items) {
    if (item.type !== "spell" || !item.system?.activities || !item.system?.description?.value) errors.push(`${item.name ?? item._id}: estrutura de Item incompleta`);
    if (ids.has(item._id)) errors.push(`${item.name ?? item._id}: ID duplicado`);
    const expectedFolder = spellFolders.find(folder => folder.level === item.system?.level);
    if (!expectedFolder || item.folder !== expectedFolder._id) errors.push(`${item.name ?? item._id}: pasta incompatível com o nível ${item.system?.level}`);
    ids.add(item._id);
  }
} finally {
  await rm(temporaryDir, { recursive: true, force: true });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Foundry 14: manifesto moderno, D&D5e 5.3+ e LevelDB com 517 itens organizados em 10 pastas válidas.");
}
