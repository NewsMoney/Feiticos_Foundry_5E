# Auditoria de fluxos — nível 0 (truques)

Data: 2026-07-23. Escopo: 46 itens de nível 0 em `packs/_source/feiticos-5e`.

## Critério

`Thunderclap` foi usado como padrão mínimo: descrição em pt-BR que preserve todos os gatilhos e exceções, alvo/área explícitos, atividade de ataque ou salvaguarda, dano correto em sucesso/falha, progressão nos níveis 5/11/17 e efeitos secundários representados por atividades/efeitos quando o Foundry/Midi-QOL puder executá-los. “Correto (rolagem)” significa que a atividade principal rola corretamente, não que todos os efeitos narrados estejam automatizados.

Fontes confrontadas:

- `data/descriptions-srd-5.1.json` (texto SRD 5.1 local) para os truques SRD.
- [dnd_grimoire (repositório e páginas individuais)](https://github.com/njlyon0/dnd_grimoire), cuja árvore contém os textos 2014 e suplementos.
- [Espelho navegável do dnd_grimoire](https://dnd5e.github.io/grimoire/) para consulta mecânica por magia (por exemplo, [Booming Blade](https://dnd5e.github.io/grimoire/spells/booming-blade)).
- [dndR](https://njlyon0.github.io/dndR/), que declara trabalhar com a versão 2014, como confirmação do conjunto de regras adotado.

Observação editorial global: com exceção de `Thunderclap`, as descrições atuais são sinopses de um parágrafo. Mesmo quando mecanicamente fiéis, não têm a mesma profundidade. A correção de cada linha deve preservar em parágrafos separados efeito, gatilhos/exceções e progressão; não basta conservar a sinopse.

## Resultado por magia

| Magia | Estado atual | Falha encontrada | Correção precisa recomendada |
|---|---|---|---|
| Acid Splash | Parcial | DEX, 1d6 ácido, sem dano no sucesso e progressão estão corretos. `count: 2` não impõe que os dois alvos estejam a 5 pés entre si; descrição é resumida. | Manter save/dano; validar proximidade de 5 pés entre os dois alvos (ou avisar no workflow) e expandir texto com escolha de um ou dois alvos e 2d6/3d6/4d6. |
| Blade Ward | Parcial | Ação e duração estão corretas, mas não há efeito; resistência a B/P/S de ataques com arma não é aplicada. | Criar Active Effect de resistência aos três tipos, condicionado a dano de ataque com arma, expiração no fim do próximo turno; expandir descrição. |
| Booming Blade | Crítico | Está como `utility`, sem ataque de arma, dano no acerto, marca, gatilho de movimento ou escalonamento executável. | Criar ataque com a arma usada; aplicar dano normal da arma; efeito até início do próximo turno que dispara dano trovejante em movimento voluntário de 5 pés; escalonar acerto 0/1d8/2d8/3d8 e movimento 1d8/2d8/3d8/4d8. |
| Chill Touch | Parcial | Ataque e dano escalam corretamente; bloqueio de cura e desvantagem de morto-vivo não têm efeitos. | Adicionar efeito que impede recuperação de PV até início do próximo turno do conjurador e, se alvo morto-vivo, desvantagem em ataques contra o conjurador; manter 1d8→4d8. |
| Control Flames | Correto (manual) | Alvo está como espaço genérico e não há modos separados; todas as opções dependem de escolha/manual. | Criar atividades utilitárias nomeadas (expandir, extinguir, luz/cor, forma), alvo cubo de 5 pés; registrar duração de 1 hora e limite de três efeitos não instantâneos; descrição integral. |
| Create Bonfire | Crítico | Save/dano inicial correto, mas alvo não é template cúbico e não há zona persistente nem saves ao entrar/terminar turno. | Template quadrado/cubo de 5 pés; região por concentração até 1 min; DEX save ao criar, entrar pela primeira vez no turno ou terminar turno; 1d8→4d8, zero no sucesso. |
| Dancing Lights | Parcial | Alcance/duração estão corretos; não cria quatro luzes nem fornece movimento por ação bônus. | Atividade de criação de até quatro luzes (ou forma humanoide), cada uma com luz fraca 10 pés; macro/atividade bônus para mover 60 pés e validar separação máxima de 20 pés. |
| Druidcraft | Correto (manual) | `target: creature` é incorreto para opções de ponto/planta/chama; modos estão condensados. | Trocar alvo para espaço/objeto conforme atividade e criar quatro atividades (clima, florescer, efeito sensorial, chama); texto deve manter limites de tamanho, duração e alcance. |
| Eldritch Blast | Crítico | Dano escala como mais dados num único acerto; a regra cria raios separados, cada qual com seu próprio ataque e alvo. | Escalonamento por quantidade de ataques (1/2/3/4), cada raio 1d10 força e selecionável para alvos distintos; remover scaling de dados do dano. |
| Encode Thoughts | Parcial | `target: creature` contradiz alcance pessoal; não cria/representa o filamento nem os dois modos de leitura. | Alvo self; efeito/item temporário por 8 h; atividades “extrair” e “ler”, preservando que leitura exige conhecer o truque ou Detect Thoughts. |
| Fire Bolt | Correto (rolagem) | Ataque, 1d10 fogo e progressão corretos; incêndio de objeto não automatizado e texto resumido. | Manter workflow; permitir alvo criatura ou objeto e documentar/automatizar ignição apenas de objeto inflamável não vestido nem carregado; explicitar 2d10/3d10/4d10. |
| Friends | Parcial | Não há efeito de vantagem, concentração/expiração nem hostilidade posterior. | Efeito de vantagem em testes de Carisma contra uma criatura não hostil escolhida; ao terminar, mensagem/efeito de que ela reconhece a influência e torna-se hostil conforme a regra. |
| Frostbite | Parcial | CON e 1d6→4d6 corretos; desvantagem no próximo ataque com arma ausente. | Em falha, Active Effect de desvantagem no próximo ataque com arma, consumido ao atacar ou expirando no fim do próximo turno do alvo. |
| Green-Flame Blade | Crítico | `utility`, sem ataque de arma, dano normal, salto, segundo alvo ou progressão. | Executar ataque com arma a 5 pés; no acerto aplicar arma e escolher segunda criatura a 5 pés do primeiro; dano secundário = modificador de conjuração, escalando ambos os componentes em 1d8 nos níveis 5/11/17. |
| Guidance | Parcial | Duração/concentração descritas, mas não há efeito nem consumo do d4. | Active Effect +1d4 em um teste de habilidade à escolha antes/depois da rolagem, consumido no uso e encerrado em 1 min; texto integral. |
| Gust | Parcial | STR save existe, mas empurrão não é aplicado e alvo não restringe tamanho; modos de objeto/vento não têm atividades. | Em falha, empurrar criatura Média ou menor 5 pés para longe; atividades separadas para objeto de até 5 lb e efeito de ar inofensivo. |
| Infestation | Parcial | CON e dano corretos; movimento aleatório ausente. | Em falha, rolar d4, mover 5 pés N/S/L/O se possível, sem provocar ataque de oportunidade; manter 1d6→4d6. |
| Light | Parcial | Alvo fixo em objeto omite resistência de DEX quando objeto é vestido/carregado por criatura hostil; luz não é criada. | Atividade normal em objeto e atividade hostil com DEX save negando; efeito de luz plena 20 pés + fraca 20 pés por 1 h, encerrando a conjuração anterior. |
| Lightning Lure | Parcial | STR, dano condicional e progressão estão nos dados, mas a atividade sempre oferece dano e não puxa. | Em falha puxar até 10 pés em direção ao conjurador; só rolar/aplicar 1d8→4d8 se terminar a até 5 pés; sucesso sem efeito. |
| Mage Hand | Correto (manual) | Alvo `creature` é incorreto; sem token/mão ou controle por ação. | Alvo ponto a 30 pés; criar mão por 1 min e atividade para mover/manipular, mantendo limite de 10 lb e proibições de atacar, ativar item mágico e afastar-se mais de 30 pés. |
| Magic Stone | Crítico | Modelado como um ataque imediato contra criatura, alcance 60 pés e só uma pedra; a conjuração encanta até três pedras tocadas e o ataque é posterior. | Alvo até 3 objetos, alcance toque, duração 1 min; criar ataque(s) de pedra/funda a 60 pés usando modificador de conjuração, dano 1d6 + modificador; encerrar ao reconjurar ou após acerto. Sem progressão de truque. |
| Mending | Correto (manual) | Conjuração de 1 min e alvo estão corretos; descrição curta pode perder que quebra/rasgo não excede 1 pé e propriedade mágica não volta. | Sem automação necessária; expandir descrição integral e manter alvo objeto tocado. |
| Message | Correto (manual) | Alvo/alcance básicos corretos; texto resumido deve preservar barreiras, caminho indireto e silêncio da resposta. | Sem rolagem; expandir descrição com passagem por sólidos, bloqueios e condição de o alvo reconhecer o conjurador; opcional integração de chat sussurrado. |
| Mind Sliver | Parcial | INT, 1d6→4d6 e falha corretos; penalidade de 1d4 não é aplicada. | Em falha, efeito -1d4 na próxima salvaguarda antes do fim do próximo turno do conjurador, consumido ao ocorrer. |
| Minor Illusion | Parcial | Alvo/prazo básicos corretos; investigação INT e CD, limites de som/imagem e revelação não têm atividades. | Atividades “som” e “imagem”; imagem em cubo de 5 pés; ação de Investigação contra CD da magia e efeito revelado/translúcido apenas a quem discerniu. |
| Mold Earth | Correto (manual) | Modos resumidos; alvo espaço aceitável, mas falta cubo de 5 pés e limite de dois efeitos não instantâneos. | Atividades para escavar/mover, formas/cores e terreno difícil/normal; template de 5 pés e duração/limite explícitos. |
| Poison Spray | Correto (rolagem) | CON, 1d12, zero no sucesso e progressão corretos; descrição resumida. | Manter workflow e explicitar 2d12/3d12/4d12 em seção própria. |
| Prestidigitation | Parcial | Alvo fixo em criatura não serve para ponto/objeto; seis modos e limite de três efeitos estão condensados. | Atividades separadas por modo, alvos apropriados, durações e limites de volume/tamanho; manter até três efeitos não instantâneos simultâneos. |
| Primal Savagery | Correto (rolagem) | Ataque corpo a corpo, ácido 1d10→4d10 corretos; alvo/range self pode dificultar seleção do oponente. | Preservar alcance pessoal na magia, mas atividade deve solicitar uma criatura adjacente; expandir progressão explícita. |
| Produce Flame | Crítico | Só existe ataque; desapareceu o modo principal de criar chama por 10 min e sua iluminação. | Duas atividades: criar chama (self, luz plena 10 pés + fraca 10 pés, 10 min) e arremessar (ataque 30 pés, encerra chama, 1d8→4d8). |
| Ray of Frost | Parcial | Ataque/dano/progressão corretos; redução de deslocamento não é aplicada. | Em acerto, efeito -10 pés em todos os deslocamentos até início do próximo turno do conjurador. |
| Resistance | Parcial | Duração/concentração descritas, mas não há efeito/consumo. | Active Effect +1d4 em uma salvaguarda à escolha antes/depois da rolagem, consumido no uso ou expirando em 1 min. |
| Sacred Flame | Correto (rolagem) | DEX, 1d8→4d8 e zero no sucesso corretos; “sem benefício de cobertura” só está no texto. | Manter rolagem e configurar save ignorando bônus de meia/três-quartos cobertura, se o Midi os computar; expandir progressão. |
| Sapping Sting | Parcial | CON e 1d4→4d4 corretos; condição caído ausente. | Em falha aplicar `prone` após o dano; sucesso sem dano/condição. |
| Shape Water | Correto (manual) | Modos condensados e sem cubo/template; duração e limites pouco profundos. | Quatro atividades, cubo de 5 pés, regras de corrente, animação, congelamento sem criatura e limite de dois efeitos não instantâneos. |
| Shillelagh | Crítico | Apenas utility; não modifica arma, atributo, dado, propriedade mágica nem expira corretamente. | Alvo uma clava/bordão segurado; efeito por 1 min que usa habilidade de conjuração para ataque/dano, d8 e dano mágico; termina ao soltar ou reconjurar. |
| Shocking Grasp | Parcial | Ataque/dano/progressão corretos; vantagem contra armadura metálica e bloqueio de reações ausentes. | Workflow deve detectar armadura de metal e conceder vantagem; em acerto, impedir reações até início do próximo turno do alvo. |
| Spare the Dying | Parcial | Ação/toque/alvo corretos; não estabiliza automaticamente e tipo de alvo não exclui construtos/mortos-vivos. | Atividade que define estável em criatura viva a 0 PV; validar/excluir morto-vivo e construto. |
| Sword Burst | Correto (rolagem) | Área 5 pés, DEX, 1d6 força, zero no sucesso e progressão corretos; seleção está como criaturas escolhidas embora a redação da versão usada deva ser mantida consistentemente. | Manter template centrado no conjurador, excluir o próprio conjurador e preservar integralmente a redação/fonte adotada; explicitar 2d6/3d6/4d6. |
| Thaumaturgy | Parcial | Alvo criatura é inadequado; seis modos e efeitos persistentes não estão estruturados. | Criar atividades por modo com ponto/chama/porta/self, duração de 1 min e limite de três efeitos simultâneos; portas apenas destrancadas. |
| Thorn Whip | Parcial | Ataque corpo a corpo a 30 pés e dano corretos; puxão e limite de tamanho ausentes. | Em acerto, opção de puxar criatura Grande ou menor até 10 pés em direção ao conjurador; 1d6→4d6. |
| Thunderclap | Referência / correto | Fluxo principal está correto: círculo 5 pés centrado no conjurador, exclui self, CON por criatura, 1d6 trovejante só na falha, progressão; descrição possui profundidade adequada. | Preservar como teste-regressão. Garantir que `affects: creature` + exclusão self alcance aliados e inimigos, e que ausência de JB2A nunca interrompa saves/dano. |
| Toll the Dead | Crítico | WIS e progressão existem, mas o dano está fixo em d8; não troca automaticamente para d12 quando o alvo perdeu PV. | Dano condicional por alvo: d8 se PV cheio, d12 se abaixo do máximo; quantidade 1/2/3/4 por nível; sucesso sem dano. |
| True Strike | Parcial | Nenhum efeito; não concede vantagem nem controla alvo/duração/concentração. | Aplicar efeito ligado ao alvo escolhido: vantagem no primeiro ataque do próximo turno contra ele, consumido no ataque ou ao fim do turno; exigir concentração e linha de visão conforme versão 2014. |
| Vicious Mockery | Parcial | WIS e 1d4→4d4 corretos; requisito de ouvir e desvantagem no próximo ataque estão ausentes. | Validar alvo que possa ouvir; em falha aplicar desvantagem ao próximo ataque antes do fim do próximo turno do alvo, consumindo o efeito. |
| Word of Radiance | Correto (rolagem) | Área/save/dano estão corretos, mas `affects: enemy` contradiz “criaturas que você possa ver e escolher” e impede escolher não inimigos quando necessário. | Usar `creature` com seleção/exclusão pelo usuário, círculo 5 pés centrado no conjurador, CON individual, 1d6→4d6 apenas na falha. |

## Prioridade de implementação

1. **Fluxo quebrado:** Booming Blade, Create Bonfire, Eldritch Blast, Green-Flame Blade, Magic Stone, Produce Flame, Shillelagh e Toll the Dead.
2. **Rolagem funciona, efeito mecânico falta:** Blade Ward, Chill Touch, Frostbite, Guidance, Gust, Infestation, Light, Lightning Lure, Mind Sliver, Ray of Frost, Resistance, Sapping Sting, Shocking Grasp, Thorn Whip, True Strike e Vicious Mockery.
3. **Estrutura/alvo ou modos manuais:** os demais casos marcados “Parcial” ou “Correto (manual)”.

## Proteções de regressão recomendadas

- Teste que todo truque ofensivo de salvaguarda tenha `onSave` coerente e que dano/efeito seja aplicado individualmente por alvo.
- Teste específico para área centrada no conjurador (`Thunderclap`, `Sword Burst`, `Word of Radiance`) com exclusão/inclusão correta.
- Teste que progressão de **raios/ataques** (`Eldritch Blast`) não seja convertida em dados adicionais de um único ataque.
- Testes condicionais de dado (`Toll the Dead`, `Lightning Lure`) e de dano tardio (`Booming Blade`, `Create Bonfire`).
- Validador editorial que rejeite sinopse como substituta da descrição: exigir todos os gatilhos, exceções, durações, limites e uma seção explícita de progressão quando houver.
