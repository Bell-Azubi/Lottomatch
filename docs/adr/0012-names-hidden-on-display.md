# ADR-0012: Winner names are hidden on the display by default

- Status: Accepted
- Date: 2026-11-05

## Context

FR-10 lets the Gewinn overlay show the prize with the card number or a name. Showing names on a
projector to up to 400 people is a disclosure that data minimisation (C6) discourages.

## Decision

The event setting `showNamesOnDisplay` defaults to off. The Gewinn overlay shows the card number;
names are sent to the display only when the organiser enables the setting for that event. The host
console, results and the printed winner list always show the names that were entered.

## Consequences

- Names stay on the console unless the club decides otherwise per event.
- Without a card number and with names hidden, the overlay shows the prize alone.
