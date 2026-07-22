import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function readPackSources(root) {
  const directory = path.join(root, "packs", "_source", "feiticos-5e");
  return Promise.all((await readdir(directory))
    .filter(file => file.endsWith(".json"))
    .sort()
    .map(async file => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
}
