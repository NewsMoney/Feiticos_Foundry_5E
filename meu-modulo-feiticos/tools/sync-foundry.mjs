import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulesDir = process.env.FOUNDRY_MODULES ?? "/mnt/c/Users/milto/AppData/Local/FoundryVTT/Data/modules";
const target = path.join(modulesDir, "meu-modulo-feiticos");
const dryRun = process.argv.includes("--dry-run");

// Só o que o Foundry precisa em runtime: as fontes do pipeline (Spells, data, tools) ficam fora.
const excludes = [
  "node_modules/",
  "tools/",
  "data/",
  "Spells/",
  "packs/_source/",
  "package.json",
  "package-lock.json",
  ".gitignore",
  ".github/"
];

// O pack vai em uma passada separada porque o Foundry aberto mantém o LevelDB travado:
// assim uma falha ali nunca deixa os demais arquivos do módulo pela metade.
function sync(label, extraArgs) {
  const args = [
    "-rt",
    "--delete",
    "--no-perms",
    "--no-owner",
    "--no-group",
    "--modify-window=2",
    "--itemize-changes",
    ...excludes.flatMap(pattern => ["--exclude", pattern]),
    ...extraArgs,
    ...(dryRun ? ["--dry-run"] : []),
    `${root}/`,
    `${target}/`
  ];
  const result = spawnSync("rsync", args, { stdio: "inherit" });
  if (result.status !== 0) console.error(`\n${label}: rsync falhou (código ${result.status}).`);
  return result.status === 0;
}

const filesOk = sync("arquivos do módulo", ["--exclude", "packs/"]);
const packOk = sync("compêndio", ["--include", "packs/", "--include", "packs/**", "--exclude", "*"]);

if (filesOk && packOk) {
  console.log(`\nMódulo sincronizado em ${target}. Reinicie o mundo no Foundry para recarregar o compêndio.`);
  process.exit(0);
}
if (filesOk && !packOk) {
  console.error(`\nOs arquivos do módulo foram atualizados, mas o compêndio não: o LevelDB em`
    + ` ${path.join(target, "packs")} está travado. Feche o Foundry por completo e rode novamente.`);
} else {
  console.error(`\nSincronização incompleta. Feche o Foundry por completo e rode novamente; confira ${target}.`);
}
process.exit(1);
