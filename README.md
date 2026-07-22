# Feiticos_Foundry_5E

Módulo de feitiços para Foundry VTT 14 com D&D5e 5.3+, animações opcionais e efeitos de status.

## Compatibilidade

- Foundry Virtual Tabletop 14.
- Sistema D&D Fifth Edition 5.3.0 ou posterior da série 5.3.
- O manifesto usa o schema moderno (`id`, `type`, `compatibility`, `relationships` e `esmodules`).
- O compêndio distribuído usa LevelDB em `packs/feiticos-5e`; o arquivo NeDB legado não é usado pelo manifesto. As magias são organizadas internamente nas pastas `Truques` e `1º Círculo` a `9º Círculo`.
- Sequencer, JB2A Free, Midi-QOL, DAE e Item Macro são dependências declaradas no manifesto. O Foundry oferece sua instalação e ativação junto ao módulo; `socketlib` e `lib-wrapper` são instalados transitivamente por Midi-QOL/DAE.
- O Item Macro 3.0.1 declara Foundry 13 como versão verificada, sem limite máximo no manifesto. Ele pode apresentar um aviso de compatibilidade na V14 enquanto o projeto upstream não atualizar essa marcação.

Para reconstruir e validar a distribuição destinada ao Foundry 14:

```bash
cd meu-modulo-feiticos
npm install
npm run generate:all
npm run validate:all
```

Depois de ativar o módulo em um mundo, um GM pode executar no console do navegador:

```js
await game.modules.get("meu-modulo-feiticos").api.runCompatibilityCheck()
```

O diagnóstico confirma a geração 14 do núcleo, D&D5e 5.3+, ativação do módulo, presença do compêndio e suas 517 atividades.

## Truques

O módulo contém os 46 truques oficiais do catálogo D&D 5e de 2014. Os JSONs individuais ficam em `meu-modulo-feiticos/Spells/level 0` e são gerados por uma única fonte de dados para impedir divergências entre arquivos.

```bash
cd meu-modulo-feiticos
npm run generate:cantrips
npm run validate:cantrips
```

O comando de geração também reconstrói o compêndio LevelDB `packs/feiticos-5e`. `Virtue (UA)` permanece fora desse compêndio por ser conteúdo experimental.

## Magias de 1º e 2º círculos

O gerador adicional cobre 77 magias de 1º círculo e 86 magias de 2º círculo. O catálogo mecânico fica em `meu-modulo-feiticos/data/spells-levels-1-2.json`; ele não redistribui os textos comerciais das fontes.

```bash
cd meu-modulo-feiticos
npm run generate:levels12
npm run validate:levels12
```

Para reconstruir truques, níveis 1–2 e o compêndio completo de uma vez:

```bash
npm run generate:all
```

As entradas geradas de níveis 1–2 carregam `flags.foundry-spell-pack.automation.needsReview`, permitindo localizar rapidamente casos que precisam de ajuste após testes reais no Foundry.

## Magias de 3º e 4º círculos

O segundo lote acrescenta 71 magias de 3º círculo e 53 magias de 4º círculo. O catálogo mecânico correspondente fica em `meu-modulo-feiticos/data/spells-levels-3-4.json`.

```bash
cd meu-modulo-feiticos
npm run generate:levels34
npm run validate:levels34
```

O subtotal dos níveis 0–4 é de 333 magias. O gerador compartilhado aceita os níveis desejados como argumentos, mantendo IDs, atividades, animações e flags consistentes entre todos os lotes.

## Magias de 5º e 6º círculos

O terceiro lote acrescenta 62 magias de 5º círculo e 48 magias de 6º círculo. Seu catálogo mecânico fica em `meu-modulo-feiticos/data/spells-levels-5-6.json`.

```bash
cd meu-modulo-feiticos
npm run generate:levels56
npm run validate:levels56
```

O subtotal dos níveis 0–6 é de 443 magias.

## Magias de 7º, 8º e 9º círculos

A leva final acrescenta 28 magias de 7º círculo, 24 magias de 8º círculo e 22 magias de 9º círculo. Seu catálogo mecânico fica em `meu-modulo-feiticos/data/spells-levels-7-9.json`.

```bash
cd meu-modulo-feiticos
npm run generate:levels79
npm run validate:levels79
```

O catálogo completo possui 517 magias oficiais das regras de 2014, do nível 0 ao 9. Para reconstruir e validar todos os lotes:

```bash
npm run generate:all
npm run validate:cantrips
npm run validate:levels12
npm run validate:levels34
npm run validate:levels56
npm run validate:levels79
```

## Qualidade das descrições

As descrições usam uma estratégia compatível com as fontes disponíveis:

- 215 magias não-SRD possuem descrição detalhada, original e revisada em português; o texto comercial integral não é redistribuído.
- 25 magias SRD possuem descrição detalhada revisada manualmente em português.
- As outras 277 magias SRD possuem agora descrição integral em português, traduzida da fonte SRD 5.1 e submetida a validações automáticas de dados, terminologia crítica e integridade do HTML.
- Assim, todas as 517 entradas têm descrição detalhada em português. As 240 revisadas manualmente usam a qualidade `reviewed-pt-br`; as 277 traduzidas e submetidas à revisão técnica usam `technical-reviewed-pt-br` para manter a procedência explícita.
- Descrições manuais revisadas devem ser adicionadas em `data/descriptions-reviewed-pt-br.json`. Elas têm precedência sobre qualquer texto gerado e sobrevivem a `npm run generate:all`.
- A qualidade de cada entrada fica registrada em `flags.foundry-spell-pack.description.quality`.

A atribuição do SRD encontra-se em `ATTRIBUTION.md`.

## Integrações opcionais

- Sequencer e JB2A: animações. Na ausência deles, a conjuração continua funcionando sem efeitos visuais.
- Item Macro e Midi-QOL: execução automática das animações e aplicação dos Active Effects após ataques acertados ou resistências fracassadas.
- DAE/Midi-QOL: remoção automática de efeitos com durações especiais, como “próximo ataque” e “próximo teste de resistência”.

## Automações especiais

- `Lightning Lure`, `Thorn Whip`, `Gust` e `Infestation` movimentam tokens automaticamente.
- `Create Bonfire`, `Mage Hand`, `Minor Illusion`, `Mold Earth`, `Shape Water` e `Control Flames` criam marcadores de cena.
- `Dancing Lights`, `Light` e `Produce Flame` criam ou alteram iluminação.
- `Magic Stone`, `Shillelagh` e `Encode Thoughts` criam itens temporários no ator.
- `Booming Blade` e `Green-Flame Blade` acionam a arma corpo a corpo equipada.
- `Message` abre uma mensagem privada para mestre e proprietários do alvo.
- Truques sensoriais mostram um lembrete para a escolha narrativa que não pode ser inferida pelo sistema.

Essas rotinas têm como alvo Foundry 14 e D&D5e 5.3.x. Todas possuem tratamento de erro: se permissões ou estrutura da cena impedirem uma alteração, o efeito mecânico principal continua e o jogador recebe um aviso para concluir aquela parte manualmente.
