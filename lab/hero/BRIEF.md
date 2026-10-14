# Hero scene brief (read fully before changing the scene)

The hero is one persistent world: a desk at night. It is **black by default** (unlit, empty). Each project is a **shot**: it brings its own **dressing** (material colours from its reference) and its own **mood** (lights + grade). The intro's `sun` channel brings the world from black to alive. Shot 01 is Flable; its reference is `Showcasing/Flable AI/sample 1.jpg` (a reference only, never shipped).

**Bar:** a still from a AAA game, not a WebGL demo. A score of 8/10 or better on every element from two blind judges (the lower score counts). This bar must hold at **DPR 1** (Abbas's screen, Intel HD 4000) as well as at retina.

## Files

```
lab/hero/index.html       the lab: the real engine outside Next (port 4192, `hero-lab` launch config)
lab/hero/palette.json     world (black default), dressings per shot, moods per shot (lights + grade)
lab/hero/hud.json         the live site's HUD boxes (scripts/shot.mjs --hud)
src/hero/engine/          the scene (plain three.js, shared by the lab and the site)
scripts/serve-lab.mjs     static server     scripts/shot.mjs   headless captures + bench
```

Lab params: `?shot=flable ?mood=base|flable ?dressing=none|flable ?q=low|medium|high ?hud=0`, held frames `?intro= ?t= ?exit=`, `&bench=180`.

## Verification (do this yourself, every round)

- `node scripts/shot.mjs --url "http://localhost:4192/lab/hero/index.html?hud=0" --frames "intro:0.4,intro:2.2,t:0,t:7.8,t:10.6,exit:1" --sizes "1440x900@1,1440x900@2,390x844@2" --out <scratch>`. The console must be clean.
- Look at every capture. Crop into materials. Check DPR 1 first.
- `--bench` on `q=low`: the frame median must stay well under 16 ms on the HD 4000 (13 Oct: 5.2 ms low, 6.0 ms high).
- Judges: two fresh subagents, reference + captures, never the code. Lower score wins. Fix the lowest item first.

## Taste rules (a broken rule caps that element at 6)

**Composition and medium**
1. Medium per element: code for regular geometry (desk, laptop rig, cups, pencils, lamp, notebook, phone); generated plates for the out-of-focus room (wall, shelf, bed, plant, curtain); the real UI images on the screen; DOM for any text. No people in code. No HTML drawings of objects.
2. No text inside the 3D unless it is a physical object.
3. Specific, not generic: every object reads as that object at full size. Clichés to avoid: floating devices in a void; neon glow on everything; colour painted onto surfaces instead of coming from light.

**World, dressing, mood**
4. The default world is black. A shot dresses it from its reference and lights it with its mood. Hue comes from motivated sources: lamp, window, practicals, screen.
5. Everything a shot adds (light, environment, plates, grade lift) scales with `sun`, so the unlit world is truly black.
6. Shadows keep depth. Flable's shadows are deep violet (as in the reference), never a uniform haze that lifts everything.

**Materials**
7. Real at DPR 1 and 2: bevels on every box, roughness that varies, contact shadows. Nothing floats or sinks into the desk.
8. No faceted normals, no tiled repeats, no uniform grunge.
9. Metal reflects bright things: the environment is built from emissive cards in the mood's colours.
10. Fine detail fades with screen footprint, or it shimmers.

**Light and post**
11. One motivated key (the lamp), the screen spill, the practicals; ambient stays low.
12. HalfFloat target; tone-map once (ACES) in post.js. Bloom only on genuinely bright things.
13. No decorative shines: no sweeps, streaks or sheen wipes. Post never hides weak materials.
14. Dither after encoding (dark gradients band).

**Screen and UI**
15. The screen shows the real UI images. It is excluded from tone mapping and grade (alpha 0 in the HDR target), so it stays crisp and exact. It is never warped.
16. Legible at DPR 1.

**Motion**
17. The timeline is the old flable.ts, verbatim. Nothing decorative is added. Ambient motion stays subtle.

**Learned in review (Gate B)**
18. Sample the screen with a mip bias, never at a fixed LOD 0: LOD 0 kills the mips and the UI blurs and aliases at once.
19. Environment cards sit at the real lights' positions. A card with no source in the frame shows up as a phantom glint on the metal.
20. Grain goes after sRGB encoding, luma only, and fades out in the blacks; before encoding it turns coarse and lifts the black.
21. The intro is staged: the screen wakes, then the lamp ignites (bulb and pool together), then the room. The grade's lift scales with the room's light, so the unlit world stays black.
22. A lamp hood shows its diffuser as a crescent under the rim (about 16° toward the camera). A full disc reads as a plate.
23. Floors seen at a grazing angle: cut the specular and bake the falloff (map + aoMap), or the practical's sheen flattens them into one bright sheet.
24. A feature that is not built yet never leaves a hole: the breakout socket stays closed until its tiles exist.
25. Props keep real proportions and stay fully in frame at every loop pose: pencils stand about 0.6× the cup height above the rim; the lamp's arm never leaves the top of the frame.
26. Put the key where the reference puts it. The lamp's arm reaches forward, so the pool lands on the desk's front and lights the cups' faces. A key behind the props leaves every camera-facing face dead.
27. Room bounce comes through the environment (a dim card for the room behind the viewer), never a flat hemisphere fill. A directional fill lifts the faces turned to the camera and keeps the shadows deep.
28. Screen spill is an area light the size of the display, riding on the lid. A point light leaves a hot glint on the hinge.
29. The bloom threshold sits above every lit surface; only emitters (the diffuser) cross it.
30. Each prop carries its one telling detail: the phone lies face down with its camera island; the notebook has its spine, board edges and elastic band; pencils have faceted barrels, a wood cone and a graphite point.
31. Judge the intro on every stage (0.4, 0.75, 1.1, 1.6, 2.2 s), not just its ends.
32. Shader budget: every distinct material feature set compiles its own program, and on a weak GPU that dominates the time to first frame. Props use MeshStandardMaterial and share programs, and only the desk keeps a clearcoat. Programs compile with `compileAsync` against the HDR target before the first frame. Check `lab.timing` after any material change (14 Oct: 23 programs, about 10 s to first frame headless on the HD 4000).
33. The grade's lift must stay a hint (0.0016 at most in a channel): 0.012 lifted every black to 25/255 blue, and the judges read that as violet painted onto the shadows.
34. Bloom sums every level (the up pass adds onto each finer one), so emitters keep a tight core; the widest blur alone wraps whole objects in haze.
35. Ground every object with a soft contact shadow; the lamp's shadow map is too coarse to seat them.
36. A light whose source isn't visible in the frame reads as "a rim from nowhere". Keep a practical faint until its source (the shelf's plate) is in the shot, and never at a grazing angle to a glossy surface: the desk mirrors it as a glint.
37. The room's bounce is muted (a desaturated mauve, not the window's violet). A saturated bounce turns every face toward the camera electric indigo.
38. Keep long props across the frame, not toward the camera: an arm reaching straight at the lens foreshortens into a stub.
39. Any texture an emitter multiplies into HDR (the diffuser) is half-float; 8-bit steps × 28 show as rings.
40. **The intro starts from black (Abbas, 14 Oct).** The Drawn to Real paper is the world's void, not a shot colour; the shot's colour arrives with its ink, its lit things and then its real image. No dull purple before the shot comes in.
41. **The vignette falls off to dark (Abbas, 14 Oct):** a lens falloff to near black at the corners, not a light tint over a bright plate.
42. Ink draws geometry silhouettes only: an edge must hold at 1 px and at 3 px (flecks, leather and legends don't), and the screen and the plate take a graphite wash, never scribbles. Light sources glow through the drawing.
43. Transitions are soft and low-frequency: the fill sweep wobbles like a hand; it never shows block noise or grain.
44. A shot's room plate is graded to its reference by measurement (wall, LED band, under the desk), dithered with an unstructured hash, and never padded by copying or mirroring its edges into view.

## Review log

- **13 Oct, Gate A:** composition approved with a bigger laptop (42% of the frame). Black is the default; shots bring their own world from their reference.
- **13 Oct, Gate B round 1** (lower of two judges): laptop 6, screen 5, desk 5, lamp 4, cups and pencils 5, notebook and phone 5, lighting 5, grade 5, composition 6, intro 6.
  - Fixed: screen mip bias (rule 18); env cards moved to the lights (19); grain after encoding (20); bloom threshold 2.4 on four levels; staged intro and lift × room (21); thinner desk with a clearcoat and bevelled edge; thin leather notebook; phone glass top; warm practical rim on the lid.
  - Rebuilt: the architect lamp (foot right of the small cup, post, curved arm, dome hood with a recessed diffuser, rule 22); pencils (hex barrels, wood cones, graphite points, rule 25); floor falloff (rule 23); breakout socket held closed (rule 24).
  - Bench, 14 Oct, headless, 1440×900 at DPR 1: low 4.3 ms median (p95 7.2), high 5.6 ms (p95 12.1).
- **14 Oct, Gate B round 2** (lower of two new judges): laptop 6, screen 5, desk 5, lamp 5, cups and pencils 5, notebook and phone 4, lighting 4, grade 5, composition 5, intro 4. Both judges independently named one root cause: a flat violet lift with no room bounce, so faces turned to the camera went dead while the shadows sat on a violet floor.
  - Fixed: room bounce through the environment and ambient at 0.015 (rule 27); the screen's area light (28); bulb ×4 and the bloom threshold at 7 (29); the window down to 0.9, so the desk falls off from the lamp; vignette 0.45; the screen spotlight dims without blurring (rule 15).
  - Rebuilt: hollow cups; the lamp with a straight post, elbow and hinge barrel, its arm reaching forward over the near cup (26), a deep diffuser with a hot core and a lit reflector band; the hardcover notebook and the face-down phone (30); faceted pencil barrels.
  - Intro: the lamp is lit by 0.75 s, the screen wakes at 0.9–1.3 s, the room comes up from 1.05 s (31).
  - Bench: low 3.8 ms median (p95 5.1), high 4.6 ms (p95 8.2).
- **14 Oct, Gate B round 3** (lower of two new judges): laptop 5, screen 6, desk 4, lamp 4, cups and pencils 5, notebook and phone 5, lighting 5, grade 5, composition 5, intro 5. A plateau around 5: every pair of judges confirms the last fixes and finds the next layer.
  - Fixed: lift to a hint (rule 33); additive bloom (34); contact shadows (35); the desk at 2 cm with a rounder edge, more clearcoat and grain repeated to its proportions (it had streaked); the lamp's arm finger-thick, the hood mounted at its back (not hung from the top like a pendant) and tipped to about 14°; graphite points and varied pencils; speckle in three sizes with clusters; the spine without stretched grain; a deeper, crisper screen spotlight; a steadier screen spill; vignette 0.6; a darker placeholder room with falloff; the laptop's stray self-glow removed; programs 47 → 23 (rule 32).
  - Open (still, after round 4): a sub-pixel highlight on the lid's top edge breaks into dashes. It is the aluminium shell's own edge seen almost exactly edge-on. It survives every light, environment, depth, normal and culling test, so it is geometric aliasing; it needs that edge thickened or a different angle.
- **14 Oct, Gate B round 4** (lower of two new judges): laptop 5, screen 6, desk 5, lamp 4, cups and pencils 6, notebook and phone 5, lighting 5, grade 5, composition 6, intro 5. Small gains; the plateau holds around 5.
  - Fixed after round 4 (not yet re-judged): the orange glint in the intro (rule 36); the warm rim lowered to a hint (36); a muted room bounce (37); the lamp's foot moved behind the small cup so its arm crosses the frame (38), with a matte enamel hood and softer shadows; a half-float diffuser (39); cup walls unwrapped as one strip (no corner seam) with rounder corners; pencils fanning out in mixed colours; cream page lines on the notebook; faint key legends; the screen at its shipped brightness; the lamp pool calmer; the chair placeholder and floor lifted slightly for the text zone.
  - Bench, headless, 1440×900 at DPR 1: low 4.1 ms median (p95 6.0), 19 programs, first frame in about 10 s; high 4.8 ms (p95 7.9), 23 programs, about 10.7 s.
  - Most of what still holds the scores down is the room (a flat graybox), depth of field and bokeh, all in the full build.
- **14 Oct, Gate B approved by Abbas.** Brightness: **match the reference's bright pink-violet glow** (not the moodier slice). The headline then needs a scrim or a stronger text treatment on the site (check with `npm run qa:hero`: HUD contrast ≥ 4.5:1). Next: the full build, starting with the room plates.
- **14 Oct, full build: room plate.** One Figma generation (`gpt-image-2.5-sunburst`, on Diana's team plan with Abbas's approval; 1 of the 8 allowed) gave Flable's whole out-of-focus room: the shelf with plants and candles, the peach-pink LED wash, the backlit bed, a plant at the left, violet curtains at the right. Source: `assets/hero/plates/flable-room-v1.png`. Built by `scripts/build-plates.mjs` (placed in the canonical frame, padded with soft edge colours, never mirrored; the band under the desk lifted) into `public/media/hero/flable/room-{2048,1024}.webp`.
  - The plate is the Flable dressing's own world (`roomPlate`); the default world keeps its achromatic graybox. It bypasses tone mapping and the grade (alpha 0, like the screen), so it shows at its own colours, scaled by the room's light. The graybox floor hides under a plate; the arc runs down to −30.
  - Brightness matched to the reference by measurement (desk 162,120,169 against 159,92,185; lit desk and cups within about 10%): exposure 1.5, saturation 1.35, gain toward magenta-violet, a pinker lamp, a stronger violet window. The chair is a soft, dark navy silhouette.
  - `scripts/shot.mjs` now retries headless Chrome's intermittent tiled-frame glitch (the top-left quarter repeated 2×2).
- **14 Oct, full build: motion pieces ported.** The Drawn to Real intro (post.js: Sobel on the HDR frame's compressed luminance, lilac ink on plum night paper, diagonal sweep with a hand-drawn jitter, then filled to the real image, on the verbatim `ink`/`real` tracks; the edge threshold raised so speckle and legends don't ink). The KPI breakout (engine/breakout.js: tiles copy the Insights texture's pixels and write into the screen's untone-mapped path; lilac halos, plum shadow; the screen's socket opens only while tiles exist). The Return keycap (light, breathing, rises on hover). Mobile reframed (compact anchor 0.4 / 0.28, laptop at 56% of the width) so the cups and lamp sit in the upper right and the room reads at a natural scale. 27 programs; a held frame is ready in about 14 s headless.
- **14 Oct, full scene, round F1** (lower of two judges, 15 rows): laptop 6, screen 7, breakout 4, Return key 4, desk 6, notebook and phone 6, cups and pencils 5, lamp 5, room 5, chair 2, lighting 5, grade 5, composition 6, intro 4, exit 5.
  - Fixed: the chair is now a dark, defocused back with a lit rim, cutting across the desk's front-left edge; the breakout has per-tile shadows on the glass, wider depth and fan with ROAS forward, top-lit tiles, the strip held at the bezel, and the socket as a soft cavity; the Return key is a bevelled keycap with a ↵ legend; the ink pass draws geometry only (the screen and plate take a wash) and emitters glow through it, so the lamp lights first; the plate is regraded toward rose-magenta, dithered (unstructured hash), webp q94, extended to y 2.2 with heavily softened padding (no streaks on phones or in the exit), and its dark band keeps a quieter colour; an environment card for the lit desk (the chassis edges reflect it); the screen spotlight dims toward plum, and the backlight dims as power squared (the exit reads as dark glass); a calmer bulb with more bloom; smaller, sparser speckle; mobile reframed (anchor 0.36, 60%).
