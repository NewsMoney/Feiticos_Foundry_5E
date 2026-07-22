const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function markdownToHtml(markdown) {
  if (!markdown) return "";
  return markdown.split(/\n\s*\n/).map(block => {
    const escaped = escapeHtml(block.trim())
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
    return block.includes("|") ? `<pre>${escaped}</pre>` : `<p>${escaped}</p>`;
  }).join("");
}

const abilityNames = { str: "Força", dex: "Destreza", con: "Constituição", int: "Inteligência", wis: "Sabedoria", cha: "Carisma" };
const damageNames = { acid: "ácido", bludgeoning: "concussão", cold: "frio", fire: "fogo", force: "energia", lightning: "elétrico", necrotic: "necrótico", piercing: "perfurante", poison: "veneno", psychic: "psíquico", radiant: "radiante", slashing: "cortante", thunder: "trovejante" };
const conditionNames = { blinded: "cego", charmed: "enfeitiçado", deafened: "surdo", frightened: "amedrontado", incapacitated: "incapacitado", invisible: "invisível", paralyzed: "paralisado", poisoned: "envenenado", prone: "caído", restrained: "impedido", stunned: "atordoado", unconscious: "inconsciente" };

export function operationalDescription(def) {
  const details = [];
  if (def.mode === "save") {
    const result = def.damage.length
      ? `Em uma falha, sofre ${def.damage.map(([n, d, type]) => `${n}d${d} de dano ${damageNames[type] ?? type}`).join(" e ")}; em um sucesso, ${def.onSave === "half" ? "sofre metade do dano" : "não sofre esse dano"}.`
      : "O efeito principal ocorre quando a resistência falha.";
    details.push(`O alvo realiza um teste de resistência de ${abilityNames[def.save] ?? def.save}. ${result}`);
  } else if (def.mode === "attack") {
    details.push(`Realize um ataque mágico ${def.attack === "melee" ? "corpo a corpo" : "à distância"}.${def.damage.length ? ` Em um acerto, causa ${def.damage.map(([n, d, type]) => `${n}d${d} de dano ${damageNames[type] ?? type}`).join(" e ")}.` : ""}`);
  } else if (def.mode === "heal" && def.heal) {
    details.push(`O alvo recupera ${def.heal[0]}d${def.heal[1]} pontos de vida, além do modificador aplicável quando indicado pela fonte.`);
  } else {
    details.push("Esta é uma magia de utilidade, proteção, invocação ou controle; suas escolhas específicas estão descritas na fonte indicada.");
  }
  if (def.conditions.length) details.push(`Condições automatizadas reconhecidas: ${def.conditions.map(value => conditionNames[value] ?? value).join(", ")}.`);
  const components = def.properties.map(value => ({ vocal: "V", somatic: "S", material: "M" })[value]).filter(Boolean).join(", ") || "nenhum componente reconhecido";
  return `<section class="foundry-spell-pack-summary"><h3>Resumo operacional</h3><p>${details.join(" ")}</p><ul><li><strong>Fonte:</strong> ${escapeHtml(def.source)}</li><li><strong>Componentes:</strong> ${components}${def.materials ? ` — ${escapeHtml(def.materials)}` : ""}</li><li><strong>Duração:</strong> ${escapeHtml(def.duration)}${def.concentration ? " (concentração)" : ""}</li></ul></section>`;
}

export function composeDescription(def, { reviewed, translated, srd }) {
  if (reviewed) return { html: reviewed, quality: "reviewed-pt-br" };
  if (translated) return { html: translated, quality: "technical-reviewed-pt-br" };
  const summary = operationalDescription(def);
  if (!srd) return { html: `${summary}<p><em>Resumo próprio: consulte ${escapeHtml(def.source)} para o funcionamento integral, escolhas e exceções.</em></p>`, quality: "operational-summary" };
  return {
    html: `${summary}<hr><section class="foundry-spell-pack-srd"><h3>Descrição integral — SRD 5.1 (inglês)</h3>${markdownToHtml(srd)}<p><small>Conteúdo SRD 5.1 licenciado sob CC BY 4.0; consulte ATTRIBUTION.md.</small></p></section>`,
    quality: "srd-full+operational"
  };
}
