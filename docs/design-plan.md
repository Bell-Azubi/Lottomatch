# Design plan

Derived from the FC Laufenburg-Kaisten badge: concentric rings, a split field (solid gold half,
striped half) and a lettered graphite band. The badge itself appears only as the supplied file.

## Principles

1. **Boldness is spent once: on the draw.** The drum, the rolling ball and the ring-by-ring
   badge reveal are the only orchestrated motion. Everything else is calm.
2. **Every circle is a badge.** Balls, the Drehen button, the round ring, the drum and the
   prize-progress discs are built from one primitive (`BadgeRing`): rim, hairline, band, field.
3. **Glass floats, plates hold.** Translucent glass only for floating layers (header, prize bar,
   overlays, dialogs). Tactile controls sit on an opaque plate with soft neumorphic relief.
4. **Rings are information, text is truth.** Ring lettering and segment rings are `aria-hidden`;
   the same information always exists as real text next to them.
5. **Never colour alone.** States differ by fill, ring, outline and text, not hue only.
6. **Legible from 30 m.** Display sizes in `vh`/`vmin`/`clamp()`; key information ≥ 9:1 contrast.

## Tokens (CSS custom properties, `src/ui/design-system/tokens.css`)

| Group | Tokens |
| --- | --- |
| Badge palette | `--c-gold #F8B708`, `--c-red #C3071B`, `--c-graphite #6D6D6F`, `--c-graphite-deep #45474D`, `--c-cream #FFFBE6`, `--c-white #FFFFFF` |
| Neutrals | `--c-night #1E1E21`, `--c-mist #ECECEE`, `--c-ash #8E8E93` |
| Semantic (themed) | `--surface`, `--plate`, `--text-strong`, `--text`, `--text-muted`, `--accent-fill`, `--on-accent`, `--danger-fill`, `--on-danger`, `--danger-text`, `--hairline`, `--column-band`, `--open-ring`, `--open-numeral` |
| Focus | double ring: 2 px `--c-cream` outside 2 px `--c-night` |
| Radii | `--radius-panel 28px`, `--radius-image 20px`, `--radius-control 16px`, `--radius-capsule 999px`, circles `50%` |
| Space | `--space-1 … --space-8`: 4, 8, 12, 16, 24, 32, 48, 64 px |
| Glass | `--glass-tint` Night 62 %, `--glass-blur 24px`, `--glass-saturate 160%`, `--glass-edge` Cream 12 % |
| Relief | `--relief-raised`, `--relief-pressed` (dual shadows), `--relief-edge` Graphite (≥ 3:1 on Night) |
| Motion | `--dur-fast 120ms`, `--dur-base 180ms`, `--dur-slow 240ms`, `--ease-spring` (`linear()` with cubic-bezier fallback), reveal ≤ 450 ms |

Dark (Dunkler Saal, display default): Night surface, Gold fills with Night numerals, open
numerals Ash in a Graphite outline, Cream hairlines, column bands Cream 5 %.
Light (Heller Saal): Mist surface, Gold fills with Night numerals, open numerals Graphite Deep,
column bands Graphite 5 %, Gold never used as text.

## Type roles

| Role | Face | Use |
| --- | --- | --- |
| `numeral` | Barlow Condensed 800, tabular | latest number (≥ 35 vh), board (≥ 4.5 vh), balls |
| `ring` | Barlow Condensed 700, uppercase, +6 % tracking | ring lettering only |
| `title` | system stack 650 | page and prize titles, sentence case |
| `body` | system stack 400 | copy |
| `label` | system stack 550 | controls, captions |
| `counter` | system stack, `tabular-nums` | counters, times, CHF |

## Layout

Display 16:9 (split field: solid stage left ~40 %, striped board right ~60 %):

```
+----------------------------------------------------------------+
| [Logo]                                  Runde 7 von 24  (ring) |
|                                                                |
|     .--RUNDE 7 VON 24--.       1  2  3  4  5  6  7  8  9 10    |
|    /   .------------.   \     11 12 13 14 15 16 17 18 19 20    |
|   |   |      42      |   |      ...  (ten columns, Cream bands)|
|    \   '------------'   /     81 82 83 84 85 86 87 88 89 90    |
|     '----ZIEHUNG 37----'                                       |
|        o  o  o  o  o           23 von 90 gezogen               |
| [Bild]  Präsentkorb   1 Linie      Preis 2 von 4  [x][>][ ][ ] |  <- glass prize bar
+----------------------------------------------------------------+
```

Display 4:3 (split turns horizontal):

```
+--------------------------------------------+
| [Logo]                Runde 7 von 24 (ring)|
|   board 1-90, ten columns, Cream bands     |
|                                            |
|  ( 42 badge )   o o o o o   23 von 90      |
| [Bild] Präsentkorb  1 Linie  [x][>][ ][ ]  |
+--------------------------------------------+
```

Host console (opaque control plate left, banded board right):

```
+----------------------------------------------------------------+
| [Logo]  Start  Spiel  Preise  Auswertung  Einstellungen   (i)  |  <- glass header
+------------------------+---------------------------------------+
| Runde 7 von 24  (ring) |                                       |
| Preis 2 von 4, 1 Linie |   board 1-90, column bands,           |
| Präsentkorb            |   compact, clickable                  |
|   ( 42 ) result well   |                                       |
|       ( Drehen )       |                                       |
|   [ 4 ][ 2 ]  Enter    |                                       |
|   Rückgängig           |                                       |
|   Gewinn prüfen        |                                       |
+------------------------+---------------------------------------+
| Anzeige verbunden       Anzeige öffnen   Pause   Runde starten |
+----------------------------------------------------------------+
```

## Review against the brief (what changed and why)

The first draft was reviewed for anything that would look the same in any other app.

1. **Connection and success states were green.** Replaced by a Gold ring plus text
   ("Anzeige verbunden"); the brief forbids hues outside the badge palette.
2. **Prize progress was a generic stepper of dots.** Replaced by four miniature badge discs:
   awarded Gold, active Cream ring, upcoming Graphite outline, skipped Graphite with a diagonal
   rule plus the word "übersprungen".
3. **The prize matrix was a card grid.** Replaced by one row per round with four mini prize
   badges and a completeness ring segment, echoing the round ring.
4. **The host control plate was glass.** Changed to an opaque plate: neumorphic controls never
   sit on glass, and blur behind constantly-used controls costs frames.
5. **Board cells were rounded squares.** Changed to discs (badge anatomy); drawn discs carry a
   Cream hairline so Gold never stands alone on Night.
6. **Loading used a spinner.** Replaced by a sweeping Gold arc on the BadgeRing primitive, the
   same arc the Drehen button uses as spin progress.
7. **Confetti used the library's rainbow default.** Restricted to Gold, Cream and Red, larger
   for the Hauptpreis, replaced by a static overlay under reduced motion.
8. **4:3 was a scaled 16:9.** Changed to a horizontal split so the board keeps ≥ 4.5 vh numerals.
9. **Dialogs were plain centred boxes.** Changed to glass dialogs with a Cream edge highlight and
   a Gold hairline above the title, so they read as part of the badge family.
