import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spellFolders } from "./pack-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = [];
for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const dir = path.join(root, "Spells", `level ${level}`);
  for (const file of (await readdir(dir)).filter(name => name.endsWith(".json")).sort()) {
    const item = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    if (item.name === "Virtue (UA)") continue;
    entries.push(item);
  }
}

const sourceDir = path.join(root, "packs", "_source", "feiticos-5e");
const packDir = path.join(root, "packs", "feiticos-5e");
await rm(sourceDir, { recursive: true, force: true });
await rm(packDir, { recursive: true, force: true });
await mkdir(sourceDir, { recursive: true });
for (const folder of spellFolders) {
  const source = {
    _key: `!folders!${folder._id}`,
    _id: folder._id,
    name: folder.name,
    type: "Item",
    folder: null,
    sorting: "a",
    sort: folder.sort,
    color: null,
    description: `Magias de ${folder.name.toLocaleLowerCase("pt-BR")}.`,
    flags: {}
  };
  await writeFile(path.join(sourceDir, `${folder._id}.json`), `${JSON.stringify(source, null, 2)}\n`);
}
const folderByLevel = new Map(spellFolders.map(folder => [folder.level, folder._id]));
for (const item of entries) {
  const source = { _key: `!items!${item._id}`, ...item, folder: folderByLevel.get(item.system.level) };
  await writeFile(path.join(sourceDir, `${item._id}.json`), `${JSON.stringify(source, null, 2)}\n`);
}
await compilePack(sourceDir, packDir, { log: false });
console.log(`Compêndio LevelDB para Foundry 14 construído com ${entries.length} magias em ${spellFolders.length} pastas.`);
