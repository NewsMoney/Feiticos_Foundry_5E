# Plano de implementação de feitiços — D&D 5e (2014)

> Documento de planejamento do módulo `meu-modulo-feiticos` para Foundry VTT.

## 1. Escopo

Este backlog cobre o catálogo de magias publicadas para as regras de D&D 5e de 2014, de truques (nível 0) ao 9º círculo. A lista principal não mistura revisões de 2024, conteúdo de parceiros, Unearthed Arcana ou homebrew.

O catálogo foi consolidado a partir do índice oficial de magias do D&D Beyond, das Basic Rules 2014/SRD 5.1 e de um catálogo comunitário estruturado para as fontes de 2014. Como nem todo conteúdo comercial pode ser redistribuído, este arquivo registra apenas nomes, níveis, fontes e estado de implementação. Textos integrais, imagens e demais recursos só devem entrar no módulo quando houver licença ou autorização apropriada.

### Fontes incluídas no catálogo

- `PHB`: Player's Handbook
- `SRD`: System Reference Document 5.1
- `EE`: Elemental Evil Player's Companion
- `SCAG`: Sword Coast Adventurer's Guide
- `XGE`: Xanathar's Guide to Everything
- `GGR`: Guildmasters' Guide to Ravnica
- `AI`: Acquisitions Incorporated
- `LLK`: Lost Laboratory of Kwalish
- `EGW`: Explorer's Guide to Wildemount
- `IDRF`: Icewind Dale: Rime of the Frostmaiden
- `TCE`: Tasha's Cauldron of Everything
- `FTD`: Fizban's Treasury of Dragons
- `SCC`: Strixhaven: A Curriculum of Chaos
- `AAG`: Astral Adventurer's Guide
- `BMT`: The Book of Many Things
- `SATO`: Sigil and the Outlands
- Outras publicações oficiais identificadas individualmente no catálogo

### Fora do núcleo

- Revisões das regras de 2024 e entradas marcadas como `Legacy` no catálogo atual do D&D Beyond.
- Unearthed Arcana, conteúdo de playtest e magias abandonadas.
- Conteúdo de parceiros e terceiros.
- Homebrew, inclusive `Boon of Recovery` do documento antigo.
- Magias exclusivas de criaturas ou aventuras que não possuam uma definição publicável confirmada devem passar por triagem antes de entrar no compêndio principal.

## 2. Estado atual

- [x] Catálogo principal com 517 magias, do nível 0 ao 9, gerado e validado estruturalmente.
- [x] Compêndio LevelDB funcional com 517 entradas únicas em `packs/feiticos-5e`.
- [x] Organizar o compêndio em dez pastas internas, separando truques e cada círculo de magia.
- [x] Todas as 517 entradas possuem descrição detalhada em português: 240 revisadas manualmente e 277 com revisão técnica.
- [x] Os 46 truques possuem atividade, animação configurada e automações especiais quando aplicáveis.
- [x] Alinhar `module.json` com Foundry 14 e D&D5e 5.3.x, usando o schema moderno do manifesto.
- [x] Migrar o compêndio NeDB legado para LevelDB e validar sua extração com a CLI oficial do Foundry.
- [ ] Revisar tecnicamente as automações das 471 magias de 1º a 9º nível; hoje são geradas por modelos e permanecem marcadas com `automation.needsReview`.
- [ ] Substituir os ícones genéricos de 471 magias por recursos com caminho e licença conhecidos.
- [ ] Validar instalação limpa e comportamento dentro do Foundry com e sem módulos opcionais.
- [ ] Separar `Virtue (UA)` em um compêndio experimental; ele não faz parte das 517 entradas principais.

Legenda do catálogo:

- `[x]`: existe um JSON no repositório, mas ainda pode precisar de revisão e empacotamento.
- `[ ]`: ainda não existe um JSON individual.
- `⚠`: exige decisão de escopo, licença, fonte ou comportamento manual.

## 3. Definição de pronto por feitiço

Um feitiço só pode ser marcado como concluído quando:

- [ ] Possuir nome canônico, nível, escola e fonte.
- [ ] Possuir ativação, alcance, alvo/template, duração e componentes corretos.
- [ ] Possuir descrição em português revisada e legalmente utilizável.
- [ ] Configurar ataque, resistência, dano, cura, condições e consumo corretamente.
- [ ] Configurar concentração, ritual, materiais consumidos e custo, quando aplicável.
- [ ] Configurar escalonamento por nível de personagem ou espaço de magia.
- [ ] Funcionar sem módulos opcionais de animação.
- [ ] Possuir macro somente quando o modelo nativo não representar a mecânica.
- [ ] Possuir ícone com caminho válido e licença conhecida.
- [ ] Passar por validação estrutural e teste no Foundry.
- [ ] Estar incluído no compêndio distribuído pelo módulo.

## 4. Estratégia técnica

### Fase A — Fundação

- [ ] Escolher e documentar a matriz de versões Foundry/D&D5e.
- [x] Criar geradores e validadores comuns para os JSONs.
- [x] Criar modelos para ataque, resistência, cura, utilidade, reação e área.
- [x] Separar mecânica obrigatória de animações opcionais (Sequencer/JB2A).
- [x] Automatizar construção e validação do compêndio.
- [x] Criar teste de unicidade de nome, nível e identificador.

### Fase B — Implementação incremental

Implementar em lotes pequenos dentro de cada nível: primeiro efeitos nativos simples; depois áreas, efeitos ativos, invocações, escolhas múltiplas e macros especiais. Cada lote deve ser validado e empacotado antes do próximo.

### Fase C — Qualidade e publicação

- [ ] Testar com e sem Midi-QOL, Item Macro, Sequencer e JB2A.
- [ ] Validar escalonamento, concentração e remoção de efeitos.
- [ ] Validar caminhos e licenças de todos os recursos.
- [ ] Gerar relatório de cobertura por nível e fonte.
- [ ] Publicar versão somente quando o compêndio puder ser importado do zero.

## 5. Catálogo de implementação

As fontes entre parênteses são referências de triagem, não autorização para redistribuir o texto da magia.

### Truques (nível 0) — 46 magias

- [x] Acid Splash (PHB, SRD)
- [x] Blade Ward (PHB)
- [x] Booming Blade (SCAG, TCE)
- [x] Chill Touch (PHB, SRD)
- [x] Control Flames (EE, XGE)
- [x] Create Bonfire (EE, XGE)
- [x] Dancing Lights (PHB, SRD)
- [x] Druidcraft (PHB, SRD)
- [x] Eldritch Blast (PHB, SRD)
- [x] Encode Thoughts (GGR)
- [x] Fire Bolt (PHB, SRD)
- [x] Friends (PHB)
- [x] Frostbite (EE, XGE)
- [x] Green-Flame Blade (SCAG, TCE)
- [x] Guidance (PHB, SRD)
- [x] Gust (EE, XGE)
- [x] Infestation (XGE)
- [x] Light (PHB, SRD)
- [x] Lightning Lure (SCAG, TCE)
- [x] Mage Hand (PHB, SRD)
- [x] Magic Stone (EE, XGE)
- [x] Mending (PHB, SRD)
- [x] Message (PHB, SRD)
- [x] Mind Sliver (TCE)
- [x] Minor Illusion (PHB, SRD)
- [x] Mold Earth (EE, XGE)
- [x] Poison Spray (PHB, SRD)
- [x] Prestidigitation (PHB, SRD)
- [x] Primal Savagery (XGE)
- [x] Produce Flame (PHB, SRD)
- [x] Ray of Frost (PHB, SRD)
- [x] Resistance (PHB, SRD)
- [x] Sacred Flame (PHB, SRD)
- [x] Sapping Sting (EGW)
- [x] Shape Water (EE, XGE)
- [x] Shillelagh (PHB, SRD)
- [x] Shocking Grasp (PHB, SRD)
- [x] Spare the Dying (PHB, SRD)
- [x] Sword Burst (SCAG, TCE)
- [x] Thaumaturgy (PHB, SRD)
- [x] Thorn Whip (PHB)
- [x] Thunderclap (EE, XGE)
- [x] Toll the Dead (XGE)
- [x] True Strike (PHB, SRD)
- [x] Vicious Mockery (PHB, SRD)
- [x] Word of Radiance (XGE)

### 1º círculo — 77 magias

- [x] Absorb Elements (EE, XGE)
- [x] Alarm (PHB, SRD)
- [x] Animal Friendship (PHB, SRD)
- [x] Armor of Agathys (PHB)
- [x] Arms of Hadar (PHB)
- [x] Bane (PHB, SRD)
- [x] Beast Bond (EE, XGE)
- [x] Bless (PHB, SRD)
- [x] Burning Hands (PHB, SRD)
- [x] Catapult (EE, XGE)
- [x] Cause Fear (XGE)
- [x] Ceremony (XGE)
- [x] Chaos Bolt (XGE)
- [x] Charm Person (PHB, SRD)
- [x] Chromatic Orb (PHB)
- [x] Color Spray (PHB, SRD)
- [x] Command (PHB, SRD)
- [x] Compelled Duel (PHB)
- [x] Comprehend Languages (PHB, SRD)
- [x] Create or Destroy Water (PHB, SRD)
- [x] Cure Wounds (PHB, SRD)
- [x] Detect Evil and Good (PHB, SRD)
- [x] Detect Magic (PHB, SRD)
- [x] Detect Poison and Disease (PHB, SRD)
- [x] Disguise Self (PHB, SRD)
- [x] Dissonant Whispers (PHB)
- [x] Divine Favor (PHB, SRD)
- [x] Earth Tremor (EE, XGE)
- [x] Ensnaring Strike (PHB)
- [x] Entangle (PHB, SRD)
- [x] Expeditious Retreat (PHB, SRD)
- [x] Faerie Fire (PHB, SRD)
- [x] False Life (PHB, SRD)
- [x] Feather Fall (PHB, SRD)
- [x] Find Familiar (PHB, SRD)
- [x] Fog Cloud (PHB, SRD)
- [x] Frost Fingers (IDRF)
- [x] Gift of Alacrity (EGW)
- [x] Goodberry (PHB, SRD)
- [x] Grease (PHB, SRD)
- [x] Guiding Bolt (PHB, SRD)
- [x] Hail of Thorns (PHB)
- [x] Healing Word (PHB, SRD)
- [x] Hellish Rebuke (PHB, SRD)
- [x] Heroism (PHB, SRD)
- [x] Hex (PHB)
- [x] Hunter’s Mark (PHB, SRD)
- [x] Ice Knife (EE, XGE)
- [x] Identify (PHB, SRD)
- [x] Illusory Script (PHB, SRD)
- [x] Inflict Wounds (PHB, SRD)
- [x] Jump (PHB, SRD)
- [x] Longstrider (PHB, SRD)
- [x] Mage Armor (PHB, SRD)
- [x] Magic Missile (PHB, SRD)
- [x] Magnify Gravity (EGW)
- [x] Protection from Evil and Good (PHB, SRD)
- [x] Purify Food and Drink (PHB, SRD)
- [x] Ray of Sickness (PHB)
- [x] Sanctuary (PHB, SRD)
- [x] Searing Smite (PHB)
- [x] Shield (PHB, SRD)
- [x] Shield of Faith (PHB, SRD)
- [x] Silent Image (PHB, SRD)
- [x] Silvery Barbs (SCC)
- [x] Sleep (PHB, SRD)
- [x] Snare (XGE)
- [x] Speak with Animals (PHB, SRD)
- [x] Tasha’s Caustic Brew (TCE)
- [x] Tasha’s Hideous Laughter (PHB)
- [x] Tenser’s Floating Disk (PHB)
- [x] Thunderous Smite (PHB)
- [x] Thunderwave (PHB, SRD)
- [x] Unseen Servant (PHB, SRD)
- [x] Witch Bolt (PHB)
- [x] Wrathful Smite (PHB)
- [x] Zephyr Strike (XGE)

### 2º círculo — 86 magias

- [x] Aganazzar’s Scorcher (EE, XGE)
- [x] Aid (PHB, SRD)
- [x] Air Bubble (AAG)
- [x] Alter Self (PHB, SRD)
- [x] Animal Messenger (PHB, SRD)
- [x] Arcane Lock (PHB, SRD)
- [x] Augury (PHB, SRD)
- [x] Barkskin (PHB, SRD)
- [x] Beast Sense (PHB)
- [x] Blindness/Deafness (PHB)
- [x] Blur (PHB, SRD)
- [x] Borrowed Knowledge (SCC)
- [x] Branding Smite (PHB, SRD)
- [x] Calm Emotions (PHB, SRD)
- [x] Cloud of Daggers (PHB)
- [x] Continual Flame (PHB, SRD)
- [x] Cordon Of Arrows (PHB)
- [x] Crown of Madness (PHB)
- [x] Darkness (PHB, SRD)
- [x] Darkvision (PHB, SRD)
- [x] Detect Thoughts (PHB, SRD)
- [x] Dragon’s Breath (XGE)
- [x] Dust Devil (EE, XGE)
- [x] Earthbind (EE, XGE)
- [x] Enhance Ability (PHB, SRD)
- [x] Enlarge/Reduce (PHB, SRD)
- [x] Enthrall (PHB, SRD)
- [x] Find Steed (PHB, SRD)
- [x] Find Traps (PHB, SRD)
- [x] Flame Blade (PHB, SRD)
- [x] Flaming Sphere (PHB, SRD)
- [x] Flock of Familiars (LLK)
- [x] Fortune’s Favor (EGW)
- [x] Gentle Repose (PHB, SRD)
- [x] Gust of Wind (PHB, SRD)
- [x] Healing Spirit (XGE)
- [x] Heat Metal (PHB, SRD)
- [x] Hold Person (PHB, SRD)
- [x] Immovable Object (EGW)
- [x] Invisibility (PHB, SRD)
- [x] Kinetic Jaunt (SCC)
- [x] Knock (PHB, SRD)
- [x] Lesser Restoration (PHB, SRD)
- [x] Levitate (PHB, SRD)
- [x] Locate Animals or Plants (PHB, SRD)
- [x] Locate Object (PHB, SRD)
- [x] Magic Mouth (PHB, SRD)
- [x] Magic Weapon (PHB, SRD)
- [x] Maximilian’s Earthen Grasp (EE, XGE)
- [x] Melf’s Acid Arrow (PHB)
- [x] Mind Spike (XGE)
- [x] Mirror Image (PHB, SRD)
- [x] Misty Step (PHB, SRD)
- [x] Moonbeam (PHB, SRD)
- [x] Nathair’s Mischief (FTD)
- [x] Nystul’s Magic Aura (PHB)
- [x] Pass Without Trace (PHB, SRD)
- [x] Phantasmal Force (PHB)
- [x] Prayer of Healing (PHB, SRD)
- [x] Protection from Poison (PHB, SRD)
- [x] Pyrotechnics (EE, XGE)
- [x] Ray of Enfeeblement (PHB, SRD)
- [x] Rime’s Binding Ice (FTD)
- [x] Rope Trick (PHB, SRD)
- [x] Scorching Ray (PHB, SRD)
- [x] See Invisibility (PHB, SRD)
- [x] Shadow Blade (XGE)
- [x] Shatter (PHB, SRD)
- [x] Silence (PHB, SRD)
- [x] Skywrite (EE, XGE)
- [x] Snilloc’s Snowball Swarm (EE, XGE)
- [x] Spider Climb (PHB, SRD)
- [x] Spike Growth (PHB, SRD)
- [x] Spiritual Weapon (PHB, SRD)
- [x] Spray of Cards (BMT)
- [x] Suggestion (PHB, SRD)
- [x] Summon Beast (TCE)
- [x] Tasha’s Mind Whip (TCE)
- [x] Vortex Warp (SCC)
- [x] Warding Bond (PHB, SRD)
- [x] Warding Wind (EE, XGE)
- [x] Warp Sense (SATO)
- [x] Web (PHB, SRD)
- [x] Wither and Bloom (SCC)
- [x] Wristpocket (EGW)
- [x] Zone of Truth (PHB, SRD)

### 3º círculo — 71 magias

- [x] Animate Dead (PHB, SRD)
- [x] Antagonize (BMT)
- [x] Ashardalon’s Stride (FTD)
- [x] Aura Of Vitality (PHB)
- [x] Beacon of Hope (PHB, SRD)
- [x] Bestow Curse (PHB, SRD)
- [x] Blinding Smite (PHB)
- [x] Blink (PHB, SRD)
- [x] Call Lightning (PHB, SRD)
- [x] Catnap (XGE)
- [x] Clairvoyance (PHB, SRD)
- [x] Conjure Animals (PHB, SRD)
- [x] Conjure Barrage (PHB)
- [x] Counterspell (PHB, SRD)
- [x] Create Food and Water (PHB, SRD)
- [x] Crusader’s Mantle (PHB)
- [x] Daylight (PHB, SRD)
- [x] Dispel Magic (PHB, SRD)
- [x] Elemental Weapon (PHB)
- [x] Enemies Abound (XGE)
- [x] Erupting Earth (EE, XGE)
- [x] Fear (PHB, SRD)
- [x] Feign Death (PHB)
- [x] Fireball (PHB, SRD)
- [x] Flame Arrows (EE, XGE)
- [x] Fly (PHB, SRD)
- [x] Galder’s Tower (LLK)
- [x] Gaseous Form (PHB, SRD)
- [x] Glyph of Warding (PHB, SRD)
- [x] Haste (PHB, SRD)
- [x] Hunger of Hadar (PHB)
- [x] Hypnotic Pattern (PHB, SRD)
- [x] Intellect Fortress (TCE)
- [x] Leomund’s Tiny Hut (PHB)
- [x] Life Transference (XGE)
- [x] Lightning Arrow (PHB)
- [x] Lightning Bolt (PHB, SRD)
- [x] Magic Circle (PHB, SRD)
- [x] Major Image (PHB, SRD)
- [x] Mass Healing Word (PHB, SRD)
- [x] Meld Into Stone (PHB, SRD)
- [x] Melf’s Minute Meteors (EE, XGE)
- [x] Nondetection (PHB, SRD)
- [x] Phantom Steed (PHB, SRD)
- [x] Plant Growth (PHB, SRD)
- [x] Protection from Energy (PHB, SRD)
- [x] Pulse Wave (EGW)
- [x] Remove Curse (PHB, SRD)
- [x] Revivify (PHB, SRD)
- [x] Sending (PHB, SRD)
- [x] Sleet Storm (PHB, SRD)
- [x] Slow (PHB, SRD)
- [x] Speak with Dead (PHB, SRD)
- [x] Speak with Plants (PHB, SRD)
- [x] Spirit Guardians (PHB, SRD)
- [x] Spirit Shroud (TCE)
- [x] Stinking Cloud (PHB, SRD)
- [x] Summon Fey (TCE)
- [x] Summon Lesser Demons (XGE)
- [x] Summon Shadowspawn (TCE)
- [x] Summon Undead (TCE)
- [x] Thunder Step (XGE)
- [x] Tidal Wave (EE, XGE)
- [x] Tiny Servant (XGE)
- [x] Tongues (PHB, SRD)
- [x] Vampiric Touch (PHB, SRD)
- [x] Wall of Sand (EE, XGE)
- [x] Wall of Water (EE, XGE)
- [x] Water Breathing (PHB, SRD)
- [x] Water Walk (PHB, SRD)
- [x] Wind Wall (PHB, SRD)

### 4º círculo — 53 magias

- [x] Arcane Eye (PHB, SRD)
- [x] Aura of Life (PHB)
- [x] Aura of Purity (PHB)
- [x] Banishment (PHB, SRD)
- [x] Blight (PHB, SRD)
- [x] Charm Monster (XGE)
- [x] Compulsion (PHB, SRD)
- [x] Confusion (PHB, SRD)
- [x] Conjure Minor Elementals (PHB, SRD)
- [x] Conjure Woodland Beings (PHB, SRD)
- [x] Control Water (PHB, SRD)
- [x] Death Ward (PHB, SRD)
- [x] Dimension Door (PHB, SRD)
- [x] Divination (PHB, SRD)
- [x] Dominate Beast (PHB, SRD)
- [x] Elemental Bane (EE, XGE)
- [x] Evard’s Black Tentacles (PHB)
- [x] Fabricate (PHB, SRD)
- [x] Find Greater Steed (XGE)
- [x] Fire Shield (PHB, SRD)
- [x] Freedom of Movement (PHB, SRD)
- [x] Galder’s Speedy Courier (LLK)
- [x] Gate Seal (SATO)
- [x] Giant Insect (PHB, SRD)
- [x] Grasping Vine (PHB)
- [x] Gravity Sinkhole (EGW)
- [x] Greater Invisibility (PHB, SRD)
- [x] Guardian of Faith (PHB, SRD)
- [x] Guardian of Nature (XGE)
- [x] Hallucinatory Terrain (PHB, SRD)
- [x] Ice Storm (PHB, SRD)
- [x] Leomund’s Secret Chest (PHB)
- [x] Locate Creature (PHB, SRD)
- [x] Mordenkainen’s Faithful Hound (PHB)
- [x] Mordenkainen’s Private Sanctum (PHB)
- [x] Otiluke’s Resilient Sphere (PHB)
- [x] Phantasmal Killer (PHB, SRD)
- [x] Polymorph (PHB, SRD)
- [x] Raulothim’s Psychic Lance (FTD)
- [x] Shadow of Moil (XGE)
- [x] Sickening Radiance (XGE)
- [x] Spirit of Death (BMT)
- [x] Staggering Smite (PHB)
- [x] Stone Shape (PHB, SRD)
- [x] Stoneskin (PHB, SRD)
- [x] Storm Sphere (EE, XGE)
- [x] Summon Aberration (TCE)
- [x] Summon Construct (TCE)
- [x] Summon Elemental (TCE)
- [x] Summon Greater Demon (XGE)
- [x] Vitriolic Sphere (EE, XGE)
- [x] Wall of Fire (PHB, SRD)
- [x] Watery Sphere (EE, XGE)

### 5º círculo — 62 magias

- [x] Animate Objects (PHB, SRD)
- [x] Antilife Shell (PHB, SRD)
- [x] Awaken (PHB, SRD)
- [x] Banishing Smite (PHB)
- [x] Bigby’s Hand (PHB)
- [x] Circle of Power (PHB)
- [x] Cloudkill (PHB, SRD)
- [x] Commune (PHB, SRD)
- [x] Commune with Nature (PHB, SRD)
- [x] Cone of Cold (PHB, SRD)
- [x] Conjure Elemental (PHB, SRD)
- [x] Conjure Volley (PHB)
- [x] Contact Other Plane (PHB, SRD)
- [x] Contagion (PHB, SRD)
- [x] Control Winds (EE, XGE)
- [x] Create Spelljamming Helm (AAG)
- [x] Creation (PHB, SRD)
- [x] Danse Macabre (XGE)
- [x] Dawn (XGE)
- [x] Destructive Wave (PHB)
- [x] Dispel Evil and Good (PHB, SRD)
- [x] Dominate Person (PHB, SRD)
- [x] Dream (PHB, SRD)
- [x] Enervation (XGE)
- [x] Far Step (XGE)
- [x] Flame Strike (PHB, SRD)
- [x] Geas (PHB, SRD)
- [x] Greater Restoration (PHB, SRD)
- [x] Hallow (PHB, SRD)
- [x] Hold Monster (PHB, SRD)
- [x] Holy Weapon (XGE)
- [x] Immolation (EE, XGE)
- [x] Infernal Calling (XGE)
- [x] Insect Plague (PHB, SRD)
- [x] Legend Lore (PHB, SRD)
- [x] Maelstrom (EE, XGE)
- [x] Mass Cure Wounds (PHB, SRD)
- [x] Mislead (PHB, SRD)
- [x] Modify Memory (PHB, SRD)
- [x] Negative Energy Flood (XGE)
- [x] Passwall (PHB, SRD)
- [x] Planar Binding (PHB, SRD)
- [x] Raise Dead (PHB, SRD)
- [x] Rary’s Telepathic Bond (PHB)
- [x] Reincarnate (PHB, SRD)
- [x] Scrying (PHB, SRD)
- [x] Seeming (PHB, SRD)
- [x] Skill Empowerment (XGE)
- [x] Steel Wind Strike (XGE)
- [x] Summon Celestial (TCE)
- [x] Summon Draconic Spirit (FTD)
- [x] Swift Quiver (PHB)
- [x] Synaptic Static (XGE)
- [x] Telekinesis (PHB, SRD)
- [x] Teleportation Circle (PHB, SRD)
- [x] Temporal Shunt (EGW)
- [x] Transmute Rock (EE, XGE)
- [x] Tree Stride (PHB, SRD)
- [x] Wall of Force (PHB, SRD)
- [x] Wall of Light (XGE)
- [x] Wall of Stone (PHB, SRD)
- [x] Wrath of Nature (XGE)

### 6º círculo — 48 magias

- [x] Arcane Gate (PHB)
- [x] Blade Barrier (PHB, SRD)
- [x] Bones of the Earth (EE, XGE)
- [x] Chain Lightning (PHB, SRD)
- [x] Circle of Death (PHB, SRD)
- [x] Conjure Fey (PHB, SRD)
- [x] Contingency (PHB, SRD)
- [x] Create Homunculus (XGE)
- [x] Create Undead (PHB, SRD)
- [x] Disintegrate (PHB, SRD)
- [x] Drawmij’s Instant Summons (PHB)
- [x] Druid Grove (XGE)
- [x] Eyebite (PHB, SRD)
- [x] Find the Path (PHB, SRD)
- [x] Fizban’s Platinum Shield (FTD)
- [x] Flesh to Stone (PHB, SRD)
- [x] Forbiddance (PHB, SRD)
- [x] Globe of Invulnerability (PHB, SRD)
- [x] Gravity Fissure (EGW)
- [x] Guards and Wards (PHB, SRD)
- [x] Harm (PHB, SRD)
- [x] Heal (PHB, SRD)
- [x] Heroes’ Feast (PHB, SRD)
- [x] Investiture of Flame (EE, XGE)
- [x] Investiture of Ice (EE, XGE)
- [x] Investiture of Stone (EE, XGE)
- [x] Investiture of Wind (EE, XGE)
- [x] Magic Jar (PHB, SRD)
- [x] Mass Suggestion (PHB, SRD)
- [x] Mental Prison (XGE)
- [x] Move Earth (PHB, SRD)
- [x] Otiluke’s Freezing Sphere (PHB)
- [x] Otto’s Irresistible Dance (PHB)
- [x] Planar Ally (PHB, SRD)
- [x] Primordial Ward (EE, XGE)
- [x] Programmed Illusion (PHB, SRD)
- [x] Scatter (XGE)
- [x] Soul Cage (XGE)
- [x] Summon Fiend (TCE)
- [x] Sunbeam (PHB, SRD)
- [x] Tasha’s Otherworldly Guise (TCE)
- [x] Tenser’s Transformation (XGE)
- [x] Transport via Plants (PHB, SRD)
- [x] True Seeing (PHB, SRD)
- [x] Wall of Ice (PHB, SRD)
- [x] Wall of Thorns (PHB, SRD)
- [x] Wind Walk (PHB, SRD)
- [x] Word of Recall (PHB, SRD)

### 7º círculo — 28 magias

- [x] Conjure Celestial (PHB, SRD)
- [x] Create Magen (IDRF)
- [x] Crown of Stars (XGE)
- [x] Delayed Blast Fireball (PHB, SRD)
- [x] Divine Word (PHB, SRD)
- [x] Draconic Transformation (FTD)
- [x] Dream of the Blue Veil (TCE)
- [x] Etherealness (PHB, SRD)
- [x] Finger of Death (PHB, SRD)
- [x] Fire Storm (PHB, SRD)
- [x] Forcecage (PHB, SRD)
- [x] Mirage Arcane (PHB, SRD)
- [x] Mordenkainen’s Magnificent Mansion (PHB)
- [x] Mordenkainen’s Sword (PHB)
- [x] Plane Shift (PHB, SRD)
- [x] Power Word Pain (XGE)
- [x] Prismatic Spray (PHB, SRD)
- [x] Project Image (PHB, SRD)
- [x] Regenerate (PHB, SRD)
- [x] Resurrection (PHB, SRD)
- [x] Reverse Gravity (PHB, SRD)
- [x] Sequester (PHB, SRD)
- [x] Simulacrum (PHB, SRD)
- [x] Symbol (PHB, SRD)
- [x] Teleport (PHB, SRD)
- [x] Temple of the Gods (XGE)
- [x] Tether Essence (EGW)
- [x] Whirlwind (EE, XGE)

### 8º círculo — 24 magias

- [x] Abi-Dalzim’s Horrid Wilting (EE, XGE)
- [x] Animal Shapes (PHB, SRD)
- [x] Antimagic Field (PHB, SRD)
- [x] Antipathy/Sympathy (PHB, SRD)
- [x] Clone (PHB, SRD)
- [x] Control Weather (PHB, SRD)
- [x] Dark Star (EGW)
- [x] Demiplane (PHB, SRD)
- [x] Dominate Monster (PHB, SRD)
- [x] Earthquake (PHB, SRD)
- [x] Feeblemind (PHB, SRD)
- [x] Glibness (PHB, SRD)
- [x] Holy Aura (PHB, SRD)
- [x] Illusory Dragon (XGE)
- [x] Incendiary Cloud (PHB, SRD)
- [x] Maddening Darkness (XGE)
- [x] Maze (PHB, SRD)
- [x] Mighty Fortress (XGE)
- [x] Mind Blank (PHB, SRD)
- [x] Power Word Stun (PHB, SRD)
- [x] Reality Break (EGW)
- [x] Sunburst (PHB, SRD)
- [x] Telepathy (PHB)
- [x] Tsunami (PHB)

### 9º círculo — 22 magias

- [x] Astral Projection (PHB, SRD)
- [x] Blade of Disaster (TCE)
- [x] Foresight (PHB, SRD)
- [x] Gate (PHB, SRD)
- [x] Imprisonment (PHB, SRD)
- [x] Invulnerability (XGE)
- [x] Mass Heal (PHB, SRD)
- [x] Mass Polymorph (XGE)
- [x] Meteor Swarm (PHB, SRD)
- [x] Power Word Heal (PHB)
- [x] Power Word Kill (PHB, SRD)
- [x] Prismatic Wall (PHB, SRD)
- [x] Psychic Scream (XGE)
- [x] Ravenous Void (EGW)
- [x] Shapechange (PHB, SRD)
- [x] Storm of Vengeance (PHB, SRD)
- [x] Time Ravage (EGW)
- [x] Time Stop (PHB, SRD)
- [x] True Polymorph (PHB, SRD)
- [x] True Resurrection (PHB, SRD)
- [x] Weird (PHB, SRD)
- [x] Wish (PHB, SRD)

## 6. Fila experimental e homebrew

Estes itens não contam para a cobertura do catálogo oficial e devem ser publicados em compêndio separado:

- [x] Virtue (UA) — existe JSON; revisar e mover para o pacote experimental.
- [ ] Hand of Radiance (UA) — confirmar a versão exata antes de implementar.
- [ ] Decompose — conteúdo externo; confirmar autoria e permissão.
- [ ] Boon of Recovery — exemplo fictício/homebrew; definir regras antes de implementar.

## 7. Marcos de entrega

| Marco | Entrega | Critério de saída |
|---|---|---|
| M0 | Fundação e compatibilidade | Schema, modelos, validador e build do compêndio funcionando |
| M1 | Truques | 46/46 implementados, revisados e empacotados |
| M2 | 1º–2º círculos | 163/163 implementados e testados |
| M3 | 3º–4º círculos | 124/124 implementados e testados |
| M4 | 5º–6º círculos | 110/110 implementados e testados |
| M5 | 7º–9º círculos | 74/74 implementados e testados |
| M6 | Qualidade final | 517/517 no compêndio, relatório sem erros e instalação limpa validada |

## 8. Regras para manutenção do catálogo

- Não adicionar uma magia sem nível e fonte verificáveis.
- Não substituir silenciosamente a versão 2014 pela versão 2024.
- Quando houver reimpressão, manter uma implementação canônica e registrar todas as fontes.
- Quando duas versões tiverem regras diferentes, usar identificadores distintos e pacotes separados.
- Atualizar os totais deste documento por meio de validação automatizada, não por contagem manual.
- Tratar descrição traduzida, ícone, áudio e animação como recursos com licença própria.

## 9. Referências de conferência

- D&D Beyond — catálogo de magias: <https://www.dndbeyond.com/spells>
- D&D Beyond — Basic Rules 2014, capítulo de magias: <https://www.dndbeyond.com/sources/dnd/basic-rules-2014/spells>
- Wizards of the Coast — SRD 5.1 sob CC BY 4.0: <https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf>
- Catálogo estruturado comunitário usado para conferir níveis e fontes: <https://github.com/njlyon0/dnd_grimoire>

## 10. Próxima ação recomendada

Executar uma revisão mecânica das 471 magias de 1º a 9º nível. A ordem recomendada é: ataques e resistências simples; cura e dano escalável; concentração e condições; áreas persistentes; invocações e transformações; escolhas múltiplas e macros especiais. Cada lote deve atualizar `automation.needsReview`, receber testes de regressão e ser validado no Foundry antes de ser considerado pronto.

Depois da revisão mecânica, validar uma instalação limpa em uma instância licenciada do Foundry 14 e concluir a auditoria de ícones e licenças. O manifesto, o formato do compêndio, o catálogo e as descrições estão atualizados; as pendências restantes são principalmente automação, recursos visuais e testes de integração dentro do aplicativo.
