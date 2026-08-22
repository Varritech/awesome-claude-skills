# DESIGN.md — Frame-match replica of omarontape (6.3M) → Varritech Founder Community

Source: `~/Downloads/viral-mining/2026-06-27_software-digital-products/formats/C_buildinpublic_omar.mp4`
720×1280, 30fps, 29.5s (886 frames). Mobile 1080×1920 (scale source geometry ×1.5).

## The design DNA (build to THIS, not a loose theme)
A handheld talking-head "build-in-public" reel. Real footage throughout + two persistent text systems:
1. **HOOK CARD (scene 1 only):** giant ALL-CAPS **condensed bold** headline, **bright accent fill + THICK black stroke** (~6px), centered, upper-third, 3 stacked lines, tight leading. Source = red fill; ours = chartreuse #99FF32 fill, black stroke (brand accent in the source's red role).
2. **KARAOKE CAPTION (all talking-head scenes):** center-frame, ~52% height, **white bold + ONE keyword in yellow/chartreuse per line**, white stroke/outline, word-by-word snap (4-frame stagger), 2–4 words on screole at a time.
Plus a recurring **iOS push-notification card** overlay (bell + app name + one line + "now"), upper-mid.

## Scene map (timecodes from 4fps frames → seconds)
| # | t (s) | Source shot | Source text | OUR replica (footage = Veo3 stand-in, same framing) |
|---|---|---|---|---|
| 1 | 0.0–3.0 | rooftop wide, 2 guys standing | RED hook "YOUR / FRIEND GROUP / IS BORING" | Veo3: 2 founders on rooftop wide. Hook (chartreuse+black stroke) "YOUR / FOUNDER FRIENDS / ARE IMAGINARY" |
| 2 | 3.0–6.0 | dark, person on phone | iOS notif "VlogIt. Your turn to vlog today! now" | Veo3: founder alone at laptop, dim. iOS notif "Varritech. 3 founders want to connect now" |
| 3 | 6.0–9.0 | guy sitting ledge, talking | karaoke "you a..." | Veo3 talking-head rooftop ledge. karaoke "so i JOINED a..." |
| 4 | 9.0–15.0 | indoor desk talking + gestures | karaoke "IT ALLOWS USERS" | Veo3 talking-head at desk. karaoke "FOUNDERS who GET IT" |
| 5 | 15.0–21.0 | walking close-up, uno-card prop | karaoke "A PLATFORM WHICH" | Veo3 talking-head walking. karaoke "warm INTROS. demo DAYS." |
| 6 | 21.0–27.0 | talking-head | karaoke continues | Veo3 talking-head. karaoke "they put your STORY in front of THOUSANDS" |
| 7 | 27.0–29.5 | selfie two-shot | "FOLLOW US" yellow kw | Veo3 selfie two-shot OR brand end card. "JOIN FREE" + varritech.com + logo |

## Type system
- Hook: condensed heavy grotesk (e.g. Anton / Archivo Black; brand = Chakra Petch 700 condensed-feel), ~120px @1920h, fill chartreuse, stroke #000 ~8px, line-height 0.95, centered upper-third.
- Karaoke: Chakra Petch 700, ~70px, white, stroke white-on-black ~4px, ONE word per phrase in chartreuse/yellow, word-by-word pop (scale [0.3,1.18,1], 4-frame stagger, px gap).
- Notif card: white rounded rect, ~88% width, system look — bold app name + regular line + grey "now", bell glyph (Lucide bell).

## Footage
ALL live shots = Veo3 stand-ins, SAME framing/composition as source (rooftop wide, dim desk, talking-head, walking, selfie). Project varribrain, /tmp/adrep/veo_gen.py, 9:16, generateAudio:false, 8s each, loop to scene length via <OffthreadVideo>+<Loop>. Prompt founders as casual 20s-30s startup guys, handheld vlog energy, matching each scene's location.

## Audio
ElevenLabs Liam VO matching the source's casual male vlog cadence, reading the rewritten script (scene-aligned). Light music bed ~0.12.

## Brand
Chartreuse #99FF32 (the red→accent role + yellow keyword role), Persian Indigo #190336, Electric Indigo #8638EE, Chakra Petch, Lucide icons, NO emoji, real Varritech white logo on end card.

## Match bar
Frame-check each scene mid-point against the matching source frame: hook stroke weight + position, karaoke placement + keyword color, notif card position, talking-head framing, end card. Score composition/type/motion/color/transition.
