# Vocabulary — Materials

How to prompt each material type for matte rendering. Specular highlights and reflections are the #1 cause of warped geometry in mesh reconstruction — every entry here keeps surfaces matte.

> **Status:** Stub — needs expansion.

## Metal

| Type | Prompt as |
|------|-----------|
| Plate armour | `brushed matte iron plate, no specular shine` |
| Ancient/worn metal | `oxidized matte metal, verdigris patina, no shine` |
| Decorative metalwork | `matte hammered bronze, hand-worked surface` |
| Futuristic alloy | `matte composite alloy, micro-textured surface` |

## Organic

| Type | Prompt as |
|------|-----------|
| Human skin | `matte skin, natural diffuse, no oily highlight` |
| Dark/exotic skin | `matte [descriptor] skin, flat diffuse` |
| Scales | `dry matte scales, no iridescence, no wet sheen` |
| Fur / hair | `soft matte fur, dry fibres, no gloss` |
| Feathers | `matte feathers, dry, no oily sheen` |
| Hide / chitin | `dry matte hide`, `dull chitinous plates` |

## Fabric & Leather

| Type | Prompt as |
|------|-----------|
| Cloth | `woven cloth, matte fibres` — naturally matte, no adjustment needed |
| Worn leather | `dry cracked leather, matte surface` |
| Fine leather | `smooth matte leather, brushed finish` |

## Problematic (handle with care)

| Type | Problem | Solution |
|------|---------|----------|
| Glass | Transparency + specular | Prompt `opaque, matte` — expect cleanup |
| Gems | Facets + reflection | `matte gemstone, opaque` — loses gem look but saves geometry |
| Energy fields | Glow | Acceptable if contained; avoid extensive glow surfaces |
| Wet surfaces | Specular | `dry`, `weathered`, `dust-coated` to suppress |
