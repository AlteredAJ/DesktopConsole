# PS5 Mode — Design Specification

## Visual thesis

Apple TV glass with PlayStation muscle. The system is one dark cinematic world:
content supplies chroma, chrome is clear achromatic glass, and focus arrives as
white light rather than a coloured outline.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--ps-ground` | `#090b10` | cool-black ground |
| `--ps-bg` | `#0b0d12` | base background |
| `--ps-tile` | `#161a22` | restrained icon backing |
| `--ps-text` | `#eef1f6` | primary text / white focus rim |
| `--ps-muted` | `#8a93a6` | secondary text |
| `--ps-accent` | `#6ea8ff` | tiny selected-state dot only |
| `--ps-content-bloom` | per focused tile | hero atmosphere and dock refraction |

The surface glass itself never receives a brand tint. Brand colour appears only
behind or through it.

## Glass

`glass` is a single layer over content, never nested inside another glass pane.

| Surface | Blur / saturation | Corner radius | Weight |
| --- | --- | --- | --- |
| Dock | `blur(32px) saturate(190%)` | `2.55cqh` | deep shadow, strong specular edge |
| Standard panel | `blur(28px) saturate(180%)` | `2.0cqh` | floating content surface |
| Chip / hint | `blur(16px) saturate(160%)` | `1.1–1.5cqh` | light, quick-touch surface |

Every glass surface uses the same achromatic top-to-bottom gradient, hairline
edge, and optional upper-left radial sheen from `tokens.css`.

## Type

System stack: `system-ui, -apple-system, "Segoe UI", sans-serif`.

| Role | Size | Weight | Tracking |
| --- | --- | --- | --- |
| Hero title | `6.7cqh` | 800 | `-0.055em` |
| Panel title | `4.5cqh` | 800 | `-0.04em` |
| Hero tagline | `2.1cqh` | 560 | `-0.01em` |
| Tab | `1.42cqh` | 700 | normal |
| Uppercase eyebrow / wordmark | `1.02–1.10cqh` | 750–800 | `0.18em` |
| Chips / hints | `1.08–1.5cqh` | 650–750 | normal |

## Spacing and radii

Base spacing rhythm: `0.65cqw`, `1.1cqw`, `2.55cqh`, `5.1cqw`, `8.1cqw`.
The dock sits `12.1cqh` from the bottom; the hero sits `29.4cqh` from the
bottom. Tile labels are one line only and ellipsize at the shelf edge.

## Focus and motion intent

- Focus: slight upward lift, pure-white specular rim, white/brand mixed glow.
- Shelf: centred focused tile; drag tracks finger 1:1 with edge rubber-band;
  release settles critically damped without overshoot.
- Hero and bloom: content cross-fade / short upward settle as focus changes.
- Startup / restore: materialize from very small scale and blur.
- Ambient scene: extremely slow background drift only.
- Respect `prefers-reduced-motion`: no autonomous drift, no kinetic transitions.

Claude may retune physics; preserve state classes and avoid substituting fixed,
decorative animation for the input-driven motion model.
