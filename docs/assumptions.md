# Assumptions

Each assumption serves a live Swiss club Lottomatch. Where an assumption shapes the
architecture it has an ADR.

1. **One laptop, one browser profile.** Host console and display are two windows of the same
   origin in the same browser. No cross-device sync in v1 (the `SyncTransport` port is the seam).
2. **Physical cards are not known to the app.** The claim check verifies the numbers the
   Kontrolle reads out; it cannot know a card's layout beyond the configured line length.
3. **Card layout** defaults to 3 lines × 5 numbers; configurable 3–9 numbers per line and
   2–6 lines, with `numbers per line × lines ≤ N`. Expected claim counts: 1 Linie = one line,
   2 Linien = two lines, Volle Karte = all lines; Eigene Regel = any count ≥ 1.
4. **Ziehung n** is the 1-based position of a draw within its round (ADR-0015). After an undo
   the next draw reuses the freed position.
5. **Stechen** draws one number per claimant from 1–N with replacement, so ties are possible
   and are re-drawn among the tied claimants only (ADR-0006).
6. **Board reset mode, N and card layout** are frozen when a round starts and recorded in the
   `ROUND_STARTED` event (ADR-0004, invariant I6).
7. **Revocation in per-prize board mode** requires that no draw followed the award, because the
   physical drum was refilled for the next prize (ADR-0009).
8. **Aborting a round** keeps its awards; unresolved prizes stay open. A round aborted before
   any draw or award returns to "upcoming". Aborted rounds are resumed only through
   "Zu Runde springen" (ADR-0008).
9. **"Runde starten"** starts the lowest upcoming round after the last played round, falling
   back to the lowest upcoming round overall.
10. **Event completion** is an explicit host action after the last round ("Anlass
    abschliessen"); until then the latest award stays revocable.
11. **Presentation settings are device-level** (projector specific); the display theme defaults to
    Dunkler Saal, the console theme to System (ADR-0011).
12. **Winner names are hidden on the display by default**; the display shows the card number.
    Showing names is an explicit, per-event opt-in (ADR-0012).
13. **The PIN is per device** and guards Preise and Einstellungen against accidental changes only.
14. **Export format schema version is 1** for v1.0.0. The migration pipeline exists and is tested
    with synthetic steps; files from newer versions are refused with a clear message (ADR-0007).
15. **Totals for the payout indicator** (Could) use the prize values entered in CHF against the
    stakes entered by the organiser; off by default because cantonal conditions vary.
16. **Time zone** for all displayed times is Europe/Zurich; stored timestamps are UTC ISO strings
    and never used for ordering (I7).
17. **Browsers**: latest two Chrome, Edge, Firefox; Safari ≥ 16.4. Window Management, Wake Lock,
    Web Speech and `linear()` easing are progressive enhancements with fallbacks.
18. **"Latest number ≥ 35 vh"** (§7, §8) is met by the latest-number badge: it is at least 35 % of
    the window height in every display layout (4:3 to 16:9, 1024×768 to 3840×2160), and its numeral
    scales with it. Board numerals are at least 4.5 vh. Both are asserted in the visual E2E.
