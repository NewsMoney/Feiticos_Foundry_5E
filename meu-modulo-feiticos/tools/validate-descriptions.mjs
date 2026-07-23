import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPackSources } from "./pack-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pack = await readPackSources(root);
const actual = {};
const errors = [];
let srdTotal = 0;
let nonSrdTotal = 0;
let nonSrdPending = 0;

for (const item of pack) {
  const quality = item.flags?.["foundry-spell-pack"]?.description?.quality;
  actual[quality] = (actual[quality] ?? 0) + 1;
  const isSrd = item.system?.source?.custom?.split("/").includes("SRD");
  if (isSrd) srdTotal += 1;
  else {
    nonSrdTotal += 1;
    if (!["reviewed-pt-br", "reviewed-deep-pt-br"].includes(quality)) nonSrdPending += 1;
  }
  const html = item.system?.description?.value ?? "";
  if (html.includes("Implementação automatizada de")) errors.push(`${item.name}: descrição genérica antiga`);
  if (html.replace(/<[^>]+>/g, "").length < 80) errors.push(`${item.name}: descrição curta demais`);
}
const reviewedCount = actual["reviewed-pt-br"] ?? 0;
const deepReviewedCount = actual["reviewed-deep-pt-br"] ?? 0;
const translatedCount = actual["technical-reviewed-pt-br"] ?? 0;
const summaryCount = (actual["operational-summary"] ?? 0) + (actual["summary-pt-br"] ?? 0);
if (srdTotal !== 302) errors.push(`entradas SRD: esperado 302, encontrado ${srdTotal}`);
if (nonSrdTotal !== 215) errors.push(`entradas não-SRD: esperado 215, encontrado ${nonSrdTotal}`);
if (nonSrdPending !== 0) errors.push(`ainda existem ${nonSrdPending} descrições não-SRD sem revisão detalhada`);
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(`517 descrições em português: ${deepReviewedCount} aprofundadas, ${reviewedCount} revisadas manualmente e ${translatedCount} com revisão técnica.`);
