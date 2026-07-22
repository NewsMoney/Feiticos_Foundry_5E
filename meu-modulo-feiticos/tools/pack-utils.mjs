import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const spellFolders = Array.from({ length: 10 }, (_, level) => ({
  _id: `spellLevel${String(level).padStart(2, "0")}Fldr`,
  level,
  name: level === 0 ? "Truques" : `${level}º Círculo`,
  sort: (level + 1) * 100000
}));

export async function readPackSources(root) {
  const directory = path.join(root, "packs", "_source", "feiticos-5e");
  const documents = await Promise.all((await readdir(directory))
    .filter(file => file.endsWith(".json"))
    .sort()
    .map(async file => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
  return documents.filter(document => document._key?.startsWith("!items!"));
}
