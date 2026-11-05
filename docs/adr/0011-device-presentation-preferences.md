# ADR-0011: Presentation preferences are device-level

- Status: Accepted
- Date: 2026-11-05

## Context

FR-9 lists presentation settings (theme, animation duration, performance mode, sound, voice). They
depend on the projector, the hall and the laptop rather than on the event: the same event file may
be played on a different device next year.

## Decision

- Preferences live in the IndexedDB `meta` store under `preferences`, not in the event:
  language, console theme (default System), display theme (default Dunkler Saal), animation
  (default Normal, 1.8 s), performance mode, sound (off), mute, voice (off) and digit repeat (on).
- The display theme travels to the display in every snapshot, so the console can stay light while
  the projector shows Dunkler Saal.

## Consequences

- Exports and prepared event files contain no presentation settings.
- Duplicating or importing an event keeps the device's presentation.
