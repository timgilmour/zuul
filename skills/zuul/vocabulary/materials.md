# Vocabulary — Materials

How to prompt each material type for matte rendering. Specular highlights and reflections are the #1 cause of warped geometry in mesh reconstruction — every entry here keeps surfaces matte.

> **Rule:** `#1A8A9B` renders as visible text in the image. "Deep teal" works.

## Metal

| Type | Prompt as |
|------|-----------|
| Plate armour | `brushed matte iron plate, no specular shine` |
| Chainmail | `interlocked iron rings, matte dark iron, no individual ring shine` |
| Ancient / worn metal | `oxidized matte metal, verdigris patina, no shine` |
| Decorative metalwork | `matte hammered bronze, hand-worked surface` |
| Brass / bronze | `matte hammered brass, golden-ochre, no mirror finish` |
| Gold | `matte burnished gold over substrate, no mirror finish` |
| Silver | `matte brushed silver, no chrome effect` |
| Riveted boilerplate | `riveted iron sheet, matte charcoal, industrial scale` |
| Futuristic alloy | `matte composite alloy, micro-textured surface` |
| Corroded / rusted | `heavy rust patina, flaking iron oxide, surface pitting, matte degraded metal` |

## Organic

| Type | Prompt as |
|------|-----------|
| Human skin | `matte skin, natural diffuse, no oily highlight` |
| Dark / exotic skin | `matte [descriptor] skin, flat diffuse` |
| Alien / smooth skin | `matte [colour] alien skin, pore-free, flat diffuse` |
| Bark-textured skin | `dry bark-textured skin, matte grey-brown, no sheen` |
| Scales | `dry matte scales, no iridescence, no wet sheen` |
| Dragon scales | `dry matte scale plates, overlapping, no iridescence` |
| Fur / hair | `soft matte fur, dry fibres, no gloss` |
| Feathers | `matte feathers, dry, no oily sheen` |
| Hide / chitin | `dry matte hide`, `dull chitinous plates` |
| Carapace / exoskeleton | `dry matte chitinous carapace, segmented plates, no sheen` |

## Fabric & Leather

| Type | Prompt as |
|------|-----------|
| Cloth / linen / canvas | `woven cloth, matte fibres` — naturally matte, no adjustment needed |
| Quilted padding / gambeson | `quilted linen padding, matte stitched surface, compressed at seams` |
| Velvet | `matte velvet, pile surface, no sheen` |
| Fur trim | `dry matte fur trim, no gloss` |
| Worn leather | `dry cracked leather, matte surface` |
| Fine leather | `smooth matte leather, brushed finish` |
| Waxed / oiled leather | `matte waxed leather, dull surface sheen suppressed, flat finish` |

## Stone & Ceramic

| Type | Prompt as |
|------|-----------|
| Rough-hewn stone | `matte rough-hewn stone, dry surface` — naturally matte |
| Carved / worked stone | `matte carved stone, chisel marks visible, dry` |
| Obsidian | `matte volcanic glass, dark grey-black, no reflections` |
| Terracotta / unglazed ceramic | `matte terracotta, unglazed fired clay, dry surface` |
| Brick / masonry | `matte fired brick, mortar-jointed, dry surface` |

## Wood

| Type | Prompt as |
|------|-----------|
| Rough / raw timber | `rough-sawn timber, matte wood grain` — naturally matte |
| Polished hardwood | `smooth hardwood, matte oil finish, grain visible` |
| Weathered / driftwood | `bleached grey driftwood, dry and cracked, matte` |
| Carved wood | `hand-carved wood, matte tooled surface, tool marks visible` |
| Bamboo | `dry matte bamboo, segmented culm, no gloss` |
| Charred / scorched wood | `matte char deposit, fire-blackened timber, cracked surface` |

## Bone, Horn & Ivory

| Type | Prompt as |
|------|-----------|
| Bone | `matte aged bone, dry yellowed surface, no wet sheen` |
| Horn / antler | `dry matte horn, natural taper, surface grain, no polish` |
| Tusk / ivory | `matte yellowed ivory, no shine, surface grain` |

## Synthetic & Sci-Fi

| Type | Prompt as |
|------|-----------|
| Polymer / plastic | `matte polymer, injection-moulded surface texture, no gloss` |
| Carbon fibre | `matte carbon fibre weave, hexagonal pattern visible, flat finish` |
| Composite armour panel | `matte composite panel, micro-textured surface, no specular` |
| Rubber / neoprene | `matte rubber, dry surface, slight texture` |
| Circuit board | `matte PCB substrate, component profile only — no metal pad shine` |
| Void / corrupted material | `matte void-black surface, light absorption, no highlights at all` |

## Fantasy & Exotic

| Type | Prompt as |
|------|-----------|
| Living wood / bark armour | `matte bark surface, dry grain, lichen patches acceptable` |
| Enchanted metal | `matte metal base, runes inlaid — any glow contained and dim` |
| Petrified / stone-organic | `matte stone-grain over organic form, dry, fused texture` |
| Warpstone / cursed ore | `matte sickly-green suffused metal, dull corruption, no shine` |

## Weathering States

Cross-cutting — combine with any base material.

| State | Prompt as |
|-------|-----------|
| Rust | `heavy rust patina, flaking iron oxide, matte degraded surface` |
| Verdigris / patina | `green copper verdigris, matte patina, surface corrosion eating into metal` |
| Mud-caked | `dried mud crust on surface, matte earth, edge-cracking visible` |
| Sun-bleached | `UV-faded colour, chalky matte surface, original colour barely legible` |
| Soot / char | `matte soot deposit, grey-black powder, no sheen` |
| Dried blood | `dried blood, dark rust-brown, matte — not fresh, no wet sheen` |
| Dust-coated | `fine dust settled on surface, matte powder layer, detail softened` |
| Wax drip | `matte tallow wax drip, opaque, no gloss, cooled solid` |
| Salt-spray corrosion | `salt-crystalline surface deposit, matte grey-white, pitting beneath` |
| Tar / pitch | `matte tar coating, flat black, brushed-on texture` |

## Problematic (handle with care)

| Type | Problem | Solution |
|------|---------|----------|
| Glass | Transparency + specular | Prompt `opaque, matte` — expect cleanup |
| Gems / faceted stone | Facets + reflection | `matte gemstone, opaque` — loses gem look but saves geometry |
| Marble | Polished surface reads as wet | `matte stone, no polished marble, veined but dry` |
| Silk / satin | High specular sheen | `matte silk, flat-draped, no satin sheen, no highlight` |
| Crystal formations | Translucent + faceted | `opaque crystal, matte faces, no internal light` |
| Energy fields / shields | Glow | Acceptable if contained; avoid extensive glow surfaces |
| Wet surfaces | Specular | `dry`, `weathered`, `dust-coated` to suppress |
| Biopunk flesh-tech | Wet organic membrane | Use sparingly; prompt `dry membrane, matte organic, no wet sheen` |
| Lacquer | High-gloss finish | `matte lacquer, flat finish, colour preserved` |
| Oil-slick / iridescent | Rainbow specular | Avoid entirely or `matte surface, single-colour, no iridescence` |
