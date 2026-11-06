# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Commits follow
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

### Added

- Welcome page on the display until the first round starts: greeting to the Lottomatch of the
  FC Laufenburg-Kaisten Senioren, club badge, the event's date and venue. A round start replaces it
  with the board.

### Changed

- The Gewinn overlay on the display stays for 60 seconds instead of 12. The next draw still ends it
  at once, and so does skipping a prize or aborting the round.

## [1.0.0] - 2026-11-05

First release of Lottomatch Live for the FC Laufenburg-Kaisten Lottomatch.

### Added

- Host console (Spiel): board 1–N (default 90) with drawn, latest and open states; Drehen with a
  result fixed at the press (`crypto.getRandomValues`, rejection sampling) and a cosmetic reveal
  (Aus, Kurz, Normal, Spannend); manual entry with keypad for a physical drum; Rückgängig;
  counter and the last five numbers.
- Rounds and prizes: 24 rounds × 4 prizes by default (1–50 rounds), win conditions 1 Linie,
  2 Linien, Volle Karte and Eigene Regel, optional board reset per prize, host overrides (Preis
  überspringen, Runde abbrechen, Zu Runde springen, Anlass abschliessen) with logged reasons.
- Gewinn prüfen with claimed-number chips, late-claim detection and policy, Fehlmeldung, Gewinn
  bestätigen with optional card number, name and note, revocation of the latest award, Stechen or
  Teilen for simultaneous winners.
- Audience display (Anzeige) in a second window: badge-style latest number with ring lettering,
  board, round ring, prize bar, overlays (Gewinn, Rundenende, Pause, Spielende), synced over
  BroadcastChannel with a `storage` fallback; one controlling window via Web Locks with takeover;
  Screen Wake Lock; Window Management placement on the second screen where available.
- Prize manager (Preise): rounds × 4 matrix, prize forms with CHF parsing and images (WebP or
  JPEG, ≤ 1280 px, ≤ 400 KB), bulk tools, CSV import and export for Excel de-CH, prepared event
  files from `public/events/`, printable A4 prize list.
- Settings (Einstellungen): events with duplicate-as-template, archive and practice mode (Übung),
  event rules, presentation, data export and import with SHA-256 checksum and preview, erasing all
  winner names, event reset, optional PIN, about and diagnostics export.
- Start page with readiness checklist; results (Auswertung) with winners per round, durations,
  totals, printable winner list, CSV and JSON export, audit log viewer, handout status and
  hash-chain verification.
- Event-sourced domain with invariants I1–I7 enforced by one validator and property-based tests;
  crash-safe IndexedDB persistence with strict durability, ordered write queue, hash chain and a
  recovery screen; memory fallback with a warning.
- Offline-first PWA with precache and an update prompt shown only between rounds; Web Speech
  announcements with digit repeat and synthesised sounds, both off by default.
- de-CH (default) and English catalogues with Swiss formatting (CHF, dd.MM.yyyy, Europe/Zurich).
- CI with lint, knip, typecheck, unit and property-based tests with coverage gates, size budgets,
  E2E on Chromium, Firefox and WebKit with axe (the offline check on Chromium) and display
  snapshots, checks of input latency, host → display latency, repeat visits and endurance, and
  Lighthouse CI against a GitHub Pages stand-in; deployment of the tested build to GitHub Pages
  from Actions; Dependabot and CodeQL; every action pinned by commit SHA.

[1.0.0]: https://github.com/Bell-Azubi/Lottomatch/releases/tag/v1.0.0
