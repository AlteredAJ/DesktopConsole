# Art Generation Prompts — PS5 Mode Launcher
Submit these to Gemini / Imagen / Midjourney / Stable Diffusion.
Ordered by priority. One image per prompt.

---

## 1. Rivals hero art (Marvel Rivals — NEEDED)

**Prompt:**
Professional 4K 3840x2160 game keyart / hero banner in dark atmospheric style. Epic wide-angle cinematic shot of a team of superheroes and supervillains silhouetted against a glowing neon cityscape at dusk. Deep purple and blue color palette. Strong rim lighting on characters. Heavy atmosphere, volumetric fog at ground level. Wide empty space on the left 40% and bottom 25% for UI overlay. No text, no logos, no watermarks. Dark and moody but with vibrant neon color accents. Photorealistic digital painting style. Professional video game promotional keyart quality.

**Output:** 3840x2160 JPEG, < 4MB
**Save to:** `launcher/src/assets/logos/keyart/rivals/hero-01.jpg`

---

## 2. Rivals hero art variant 2

**Prompt:**
Professional 4K 3840x2160 game keyart. Close up of a superhero vs supervillain clash, energy blasts colliding in center frame. Vibrant cyan and magenta energy effects. Characters in dynamic action poses, low angle shot looking up. Purple and dark blue atmospheric background with soft volumetric light rays. Left 40% of frame kept darker and emptier for UI text overlay. No text, no logos, no watermarks. Photorealistic digital painting quality. Marvel-style superhero art.

**Output:** 3840x2160 JPEG, < 4MB
**Save to:** `launcher/src/assets/logos/keyart/rivals/hero-02.jpg`

---

## 3. Generic game tile fallback (background texture)

**Prompt:**
Abstract dark atmospheric 512x512 texture for a game launcher tile. Smooth gradient from deep navy (#061020) at edges to soft blue ambient glow at center with subtle radial light falloff. Very subtle diagonal light streak across the surface like a faint glass reflection. No harsh edges, soft and atmospheric. Should work as a background behind a game icon and label. Rectangular, tile-shaped (1:1). Dark, premium, console-feel.

**Output:** 512x512 JPEG, < 200KB
**Save to:** `launcher/src/assets/logos/tile-fallback.jpg`

---

## 4. Streaming app tile fallback

**Prompt:**
Abstract dark atmospheric 512x512 texture for a media streaming app tile. Smooth gradient from dark charcoal (#0a0d14) with a subtle warm glow at bottom-right suggesting a screen glow. Very faint horizontal banding like video scanlines, almost imperceptible. Premium feel, dark mode, cinematic. 1:1 square.

**Output:** 512x512 JPEG, < 200KB
**Save to:** `launcher/src/assets/logos/tile-fallback-media.jpg`

---

## 5. Screenshot gallery placeholder (for games without screenshots)

**Prompt:**
Abstract dark gaming-themed texture. A subtle grid of rounded rectangles in very dark tones, suggesting empty screenshot slots. Dark navy and charcoal palette. Premium UI placeholder aesthetic. Minimal, non-distracting. Good as a background for a "Screenshot Gallery" label. 16:9 aspect ratio. No text.

**Output:** 1280x720 JPEG, < 100KB
**Save to:** `launcher/src/assets/logos/screenshots-placeholder.jpg`

---

## 6. Box art placeholder (game detail card)

**Prompt:**
Abstract dark square texture with a subtle radial vignette and a faint glossy sheen across the top-left third like a plastic game case reflection. Dark blue-black palette with a very subtle diagonal light swoosh. No text, no logos. 1:1 square. Feels like an unprinted game case insert — premium, clean, understated.

**Output:** 1024x1024 JPEG, < 200KB
**Save to:** `launcher/src/assets/logos/boxart-placeholder.jpg`

---

## 7. Launcher background — idle ambient (optional, low priority)

**Prompt:**
Dark atmospheric abstract background 3840x2160. Deep space blue at edges transitioning to soft midnight teal at center. Ultra-subtle particle/dust motes floating, very faint. No sharp shapes, pure ambient gradient with depth. Suitable as an animated parallax background for a gaming console launcher idle screen. No text, no logos. Cinematic, premium, console feel.

**Output:** 3840x2160 JPEG, < 3MB
**Save to:** `launcher/src/assets/logos/ambient-idle.jpg`

---

## Image Spec Summary

| # | Name | Size | Use |
|---|------|------|-----|
| 1 | Rivals hero art | 3840x2160 | Game tile hero background |
| 2 | Rivals hero art v2 | 3840x2160 | Rotation variant |
| 3 | Game tile fallback | 512x512 | Tile bg for games without art |
| 4 | Media tile fallback | 512x512 | Tile bg for streaming apps |
| 5 | Screenshots placeholder | 1280x720 | Gallery area in game detail |
| 6 | Box art placeholder | 1024x1024 | Game detail card image |
| 7 | Idle ambient | 3840x2160 | Optional: idle screen bg |

**Minimum viable set:** #1 (Rivals is the only game with a single sub-1440p keyart entry — needs proper art to fill its rotation set). #3-#4 for tile polish. Everything else nice-to-have.
