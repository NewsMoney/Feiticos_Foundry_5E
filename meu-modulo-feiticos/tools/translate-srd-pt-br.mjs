import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToHtml } from "./description-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const outputFile = path.join(dataDir, "descriptions-reviewed-srd-pt-br.json");
const temporaryFile = `${outputFile}.tmp`;
const source = JSON.parse(await readFile(path.join(dataDir, "descriptions-srd-5.1.json"), "utf8"));
const reviewed = {};
for (const file of (await readdir(dataDir)).filter(name => name.startsWith("descriptions-reviewed") && name.endsWith(".json") && name !== path.basename(outputFile))) {
  Object.assign(reviewed, JSON.parse(await readFile(path.join(dataDir, file), "utf8")));
}
let translated = {};
try { translated = JSON.parse(await readFile(outputFile, "utf8")); } catch {}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const chunks = html => {
  const blocks = html.match(/<(?:p|pre)>[\s\S]*?<\/(?:p|pre)>/g) ?? [html];
  const result = [];
  for (const block of blocks) {
    if (!result.length || result.at(-1).length + block.length > 3200) result.push(block);
    else result[result.length - 1] += block;
  }
  return result;
};

function normalizeTerms(html) {
  const replacements = [
    [/teste de salvamento/gi, "teste de resistência"],
    [/jogada de salvamento/gi, "teste de resistência"],
    [/falha no salvamento/gi, "falha no teste de resistência"],
    [/salvamento bem-sucedido/gi, "teste de resistência bem-sucedido"],
    [/CD de salvamento de magia/gi, "CD para resistir às suas magias"],
    [/pontos de acerto/gi, "pontos de vida"],
    [/slot de feitiço/gi, "espaço de magia"],
    [/slot de magia/gi, "espaço de magia"],
    [/nível de slot/gi, "nível do espaço"],
    [/\bslots\b/gi, "espaços de magia"],
    [/\bslot\b/gi, "espaço de magia"],
    [/ação de bônus/gi, "ação bônus"],
    [/rolagem de ataque/gi, "jogada de ataque"],
    [/ataque de feitiço/gi, "ataque mágico"],
    [/lançador de feitiços/gi, "conjurador"],
    [/feitiço/gi, "magia"],
    [/feet\b/gi, "pés"],
    [/foot\b/gi, "pé"]
  ];
  return replacements.reduce((text, [pattern, value]) => text.replace(pattern, value), html)
    .replace(/<em>\s*([^<]*?)\s*<\/em>\[([^\]]+)\]\([^)]*\)\*/g, "* $1<em>$2</em>")
    .replace(/<em>\s*<\/em>([^<*]+)\*/g, "* $1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "<em>$1</em>")
    .replace(/<em><em>([^<]+)<\/em><\/em>/g, "<em>$1</em>")
    .replace(/<p><em>\s*Você desfaz/g, "<p>* Você desfaz")
    .replace(/uma magia Wish\*/g, "uma magia <em>Desejo</em>")
    .replace(/<br><em>\s*Coloque\s*<\/em><em>Nuvem Fedorenta<\/em><em> em dois locais\. ([\s\S]*?)<\/em>Guardas e Proteções\* durarem\./g, "<br>* Coloque <em>Nuvem Fedorenta</em> em dois locais. $1Guardas e Proteções durarem.")
    .replace(/\b(um|o|do|no|pelo|este|esse|aquele) magia\b/gi, match => ({
      um: "uma", o: "a", do: "da", no: "na", pelo: "pela", este: "esta", esse: "essa", aquele: "aquela"
    })[match.split(" ")[0].toLowerCase()] + " magia")
    .replace(/\b(seu|teu|meu) magia\b/gi, match => ({ seu: "sua", teu: "tua", meu: "minha" })[match.split(" ")[0].toLowerCase()] + " magia")
    .replace(/\b(outro|algum|nenhum) magia\b/gi, match => ({ outro: "outra", algum: "alguma", nenhum: "nenhuma" })[match.split(" ")[0].toLowerCase()] + " magia")
    .replace(/\b(magia) (poderoso|preparado|armazenado|lançado|ativado)\b/gi, (_, noun, adjective) => `${noun} ${{ poderoso: "poderosa", preparado: "preparada", armazenado: "armazenada", lançado: "lançada", ativado: "ativada" }[adjective.toLowerCase()]}`)
    .replace(/\bmagia mais poderoso\b/gi, "magia mais poderosa")
    .replace(/\bmagia (seja|é|foi|será|tenha sido) (ativado|lançado|dissipado|armazenado|preparado|suprimido|desperdiçado)\b/gi, (_, verb, adjective) => `${verb} ${{ ativado: "ativada", lançado: "lançada", dissipado: "dissipada", armazenado: "armazenada", preparado: "preparada", suprimido: "suprimida", desperdiçado: "desperdiçada" }[adjective.toLowerCase()]}`)
    .replace(/\bmagia armazenada é lançado\b/gi, "magia armazenada é lançada")
    .replace(/\bmagias não podem ser lançados\b/gi, "magias não podem ser lançadas")
    .replace(/\bconcentração nos magias\b/gi, "concentração nas magias")
    .replace(/\bconjurá-lo\b/gi, "conjurá-la")
    .replace(/\bSe a magia exigir concentração, ele durará\b/gi, "Se a magia exigir concentração, ela durará")
    .replace(/\b(magias) (lançados|ativos|suprimidos)\b/gi, (_, noun, adjective) => `${noun} ${{ lançados: "lançadas", ativos: "ativas", suprimidos: "suprimidas" }[adjective.toLowerCase()]}`)
    .replace(/\bum único magia\b/gi, "uma única magia")
    .replace(/\b(neste|desse|daquele) magia\b/gi, match => ({ neste: "nesta", desse: "dessa", daquele: "daquela" })[match.split(" ")[0].toLowerCase()] + " magia")
    .replace(/\b(a|uma|esta|essa|aquela|da|na|pela) mágica\b/gi, (_, article) => `${article} magia`)
    .replace(/\bum código de (\d+) metros\b/gi, "um cone de $1 metros")
    .replace(/<strong>Indigo\.<\/strong>/g, "<strong>Índigo.</strong>")
    .replace(/<strong>Violet\.<\/strong>/g, "<strong>Violeta.</strong>")
    .replace(/\bnível de magia (\d+)\b/gi, "magia de $1º nível")
    .replace(/(<p>|[.!?]\s+)a magia\b/g, "$1A magia")
    .replace(/(<p>|[.!?]\s+)esta magia\b/g, "$1Esta magia")
    .replace(/<p>magias\b/g, "<p>Magias")
    .replace(/\boutro salvamento de ([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)/g, "outro teste de resistência de $1")
    .replace(/\bfalhar no salvamento\b/gi, "falhar no teste de resistência")
    .replace(/\bCD para salvar magias\b/gi, "CD para resistir às suas magias")
    .replace(/\btestes de resistência de CA e Destreza\b/gi, "CA e nos testes de resistência de Destreza")
    .replace(/\bno área\b/gi, "na área")
    .replace(/\batingiu a meta\b/gi, "encontrou pessoalmente o alvo")
    .replace(/\brerrolagem\b/gi, "nova rolagem")
    .replace(/\bguardas e guerras\b/gi, "Guardas e Proteções")
    .replace(/\bguardas e enfermarias\b/gi, "Guardas e Proteções")
    .replace(/\b360\s*​​?pés\b/gi, "108 metros")
    .replace(/\b3 milhas\b/gi, "4,5 quilômetros")
    .replace(/\b40\.000 pés quadrados\b/gi, "3.600 metros quadrados")
    .replace(/\b30 pés acima\b/gi, "9 metros acima")
    .replace(/\b2\.500 pés quadrados\b/gi, "225 metros quadrados")
    .replace(/\b150 pés de alcance\b/gi, "45 metros de lado")
    .replace(/\b300 pés\b/gi, "90 metros")
    .replace(/\b1 milha quadrada\b/gi, "2,5 quilômetros quadrados")
    .replace(/\b3 pés por 5 pés\b/gi, "0,9 metro por 1,5 metro")
    .replace(/dano de força igual ao dobro do número de pés que você moveu/gi, "6 pontos de dano de força para cada metro pelo qual foi deslocado")
    .replace(/Modificador de Salvamento/gi, "Modificador do teste de resistência")
    .replace(/Salvar modificador/gi, "Modificador do teste de resistência")
    .replace(/Coloque<em>/g, "Coloque <em>")
    .replace(/magia<em>/g, "magia <em>")
    .replace(/<p>\s*<\/p>/g, "")
    .trim();
}

async function translateChunk(html) {
  const parameters = new URLSearchParams({ client: "gtx", sl: "en", tl: "pt", dt: "t", q: html });
  const url = `https://translate.googleapis.com/translate_a/single?${parameters}`;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "FoundrySpellPack/1.0" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return payload[0].map(part => part[0]).join("");
    } catch (error) {
      lastError = error;
      await sleep(500 * attempt * attempt);
    }
  }
  throw lastError;
}

async function checkpoint() {
  const ordered = Object.fromEntries(Object.entries(translated).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(temporaryFile, `${JSON.stringify(ordered, null, 2)}\n`);
  await rename(temporaryFile, outputFile);
}

const pending = Object.keys(source).filter(name => !reviewed[name] && !translated[name]).sort();
console.log(`${pending.length} descrições SRD aguardando tradução; ${Object.keys(translated).length} recuperadas do cache.`);
for (let index = 0; index < pending.length; index += 1) {
  const name = pending[index];
  const html = markdownToHtml(source[name]);
  const translatedChunks = [];
  for (const chunk of chunks(html)) {
    translatedChunks.push(await translateChunk(chunk));
    await sleep(120);
  }
  translated[name] = normalizeTerms(translatedChunks.join(""));
  await checkpoint();
  if ((index + 1) % 10 === 0 || index + 1 === pending.length) console.log(`${index + 1}/${pending.length}: ${name}`);
}
translated = Object.fromEntries(Object.entries(translated).map(([name, html]) => [name, normalizeTerms(html)]));
await checkpoint();
console.log(`Traduções SRD gravadas em ${outputFile}.`);
