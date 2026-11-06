# ADR-0026: The win condition 2 Reihen is no longer offered

- Status: Accepted
- Date: 2026-11-06

## Context

The organiser does not want 2 Reihen as a win condition any more. The rule is stored in events,
prize catalogues, audit logs and backups as `TWO_LINES`, and those must keep loading.

## Decision

- The forms offer 1 Reihe, Volle Karte and Eigene Regel (`conditionChoices`).
- The default template uses 1 Reihe for prize 3, and so does the shipped example event.
- A CSV row with 2 Reihen, also in the earlier wording 2 Linien, is reported as a row error with a
  clear message. It does not silently become another rule or an Eigene Regel.
- `TWO_LINES` stays in the types, the schemas and the labels. The data format does not change
  (schema version 1).
- A stored prize or template that has `TWO_LINES` keeps it, and its form still shows the value, until
  someone changes it. Nothing is rewritten on its own.

## Consequences

- Results and audit logs of earlier events still read 2 Reihen, which is what was played.
- An event prepared before this decision still plays 2 Reihen where it was entered. It changes with
  Einstellungen → Gewinnregeln and Preise → "Gewinnregeln überall anwenden".
- Exporting such a prize to CSV writes 2 Reihen, so importing that file again reports the row until
  the rule is changed in the file.
