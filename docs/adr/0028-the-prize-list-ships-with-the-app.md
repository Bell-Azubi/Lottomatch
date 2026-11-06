# ADR-0028: The prize list of the event ships with the app

- Status: Accepted
- Date: 2026-11-06

## Context

The app serves one club and one event. The organiser wants the prizes of the Excel sheet to be there
in the Preise tab without importing anything first, also in an event already being played that has
no prizes. Prize catalogues are stored per event and have no migration, and a catalogue that already
holds prizes must not change.

## Decision

- The list lies in `src/application/event-prize-list.ts`: 24 rounds, four prizes each, and a Superlotto
  in rounds 4, 9, 14, 19 and 24. The four prizes need one row, the Superlotto a full card.
- The composition root hands it to the application as `Platform.initialPrizes`. Tests have an empty
  list by default, so they keep starting from an empty event.
- `AppStore.open` fills an event with the list when three things hold: this window has control, the
  event has no prizes at all, and the event is not completed. Only rounds the event has are taken.
  This one rule covers new events, the default event and events being played without prizes.
- In an event being played, the list goes through `updateCatalogue` like any change, so the audit
  log records it as `PRIZE_LIST_ADDED`. A round that already started without a Superlotto does not
  get one, because its rules are frozen (ADR-0027).
- An award keeps what it recorded. A prize won before the list arrived shows its title in the Preise
  tab, while the results still name it by its slot.
- An event with at least one prize keeps what it has. The CSV import stays and overwrites the
  positions it names, so a changed Excel sheet can still be brought in.

## Consequences

- Changing the list for another year means changing this file, or importing a CSV.
- An event whose prizes have all been removed by hand gets the list again the next time it opens,
  unless it is completed.
- Events created by "Als Vorlage kopieren" and practice events copy their source and only reach the
  list if that source is empty.
- The prize titles become part of the public repository once this is pushed. They hold no personal
  data.
