# Spielleitung: Anleitung für den Lottomatch

Diese Anleitung richtet sich an die Spielleitung am Laptop. Die Konsole («Spiel») steuert das
Spiel, das zweite Fenster («Anzeige») läuft auf Projektor oder TV für das Publikum.

## Vor dem Anlass

1. **Anlass wählen.** Unter Einstellungen → Anlässe den Anlass auswählen, neu erstellen oder einen
   Vorjahresanlass als Vorlage duplizieren (Einstellungen und Preise, ohne Ziehungen und Gewinner).
2. **Anlass einstellen.** Name, Datum, Ort, Anzahl Gänge (Standard 24), höchste Zahl (Standard 90)
   und die Gewinnregel-Vorlage:
   Preis 1 bis Preis 4 je «1 Reihe». Das Superlotto gilt für die volle Karte.
   Die Vorlage mit dem Spielreglement des Vereins abgleichen.
3. **Regeln festlegen.** Mehrere Gewinnkarten (Stechen oder Teilen, beim Stechen gewinnt die höchste oder die tiefste
   Zahl) und ob das Brett nach jedem Preis geleert wird (Standard: nein, die Zahlen gelten für alle
   Preise des Gangs). Das Superlotto läuft immer auf dem Brett von Preis 4 weiter.
4. **Preise prüfen.** Die Preisliste des Anlasses ist im Programm hinterlegt: Ein Anlass ohne Preise
   bekommt alle 24 Gänge und das Superlotto in den Gängen 4, 9, 14, 19 und 24.
   Unter «Preise» lassen sich pro Gang Titel, Beschreibung, Wert in CHF, Sponsor, Bild und
   Gewinnregel ändern. Eine geänderte Excel-Liste bringt der CSV-Import herein. Fehlt ein Preis,
   zeigt die Anzeige «Preis 2» und die Gewinnregel.
   Steht in der Liste bei einem Gang ein Superlotto, kommt es als fünfter Preis dazu und lässt sich
   dort bearbeiten, auch wenn der Titel in der Liste noch leer ist. Gänge ohne Superlotto in der
   Liste haben keine Einstellung dafür. Es muss vor
   dem Start des Gangs importiert sein. Gespielt wird es nach Preis 4, ohne das Brett zu leeren, bis
   jemand die volle Karte hat. Die Spalte für den Gang darf «Gang» oder «Runde» heissen. In der Spalte «Preis» steht `1. Preis` bis `4. Preis` oder
   `Superlotto`. In Excel die Liste mit dem Dateityp «CSV UTF-8» speichern.
5. **Darstellung prüfen.** Anzeige-Thema «Dunkler Saal», Animationsdauer, Ton und Sprachansage
   (auf Wunsch mit Ziffernwiederholung: «zweiundvierzig – vier, zwei»).
6. **PIN (optional).** Eine 4- bis 8-stellige PIN schützt «Preise» und «Einstellungen» vor
   versehentlichen Änderungen. Sie ist kein Schutz gegen Absicht.
7. **Üben.** Unter Einstellungen → Anlässe eine Übung starten: Das ist ein eigener Anlass mit den
   gleichen Preisen, auf Konsole und Anzeige als «Übung» markiert. Echte Daten bleiben unberührt.
8. **Sichern.** Unter Einstellungen → Daten eine Sicherung exportieren und auf einem USB-Stick
   ablegen.

## Anzeige auf dem Projektor

1. Laptop mit dem Projektor verbinden und den Bildschirm erweitern (nicht spiegeln).
2. In der Konsole «Anzeige öffnen» wählen oder A drücken. Fragt Chrome oder Edge, ob Fenster auf
   anderen Bildschirmen platziert werden dürfen, mit «Zulassen» antworten: Die Anzeige öffnet sich
   dann direkt auf dem Projektor. Sonst das Fenster von Hand hinüberziehen.
3. Im Anzeigefenster einmal klicken oder F drücken: «Klicken oder F drücken für Vollbild».
4. Unten in der Konsole muss «Anzeige verbunden» stehen. Die Startseite zeigt zusätzlich die
   Checkliste «Bereit für den Anlass?».
5. Bis zum ersten Gang zeigt die Anzeige die Begrüssung mit dem Vereinslogo sowie Datum und Ort des
   Anlasses (Einstellungen → Anlass). Mit «Gang starten» wechselt sie auf das Spielbrett.

## Ablauf eines Gangs

1. **Gang starten.** In der Konsole «Gang starten». Fehlen beim ersten Start Preise, listet die
   App die Lücken auf und fragt nach.
2. **Zahl ziehen.**
   - «Drehen» oder Leertaste: Die Zahl steht im Moment des Drückens fest; die Trommel auf der
     Anzeige ist nur die Show. Nochmals Leertaste während der Animation zeigt die Zahl sofort und
     zieht nie eine zweite. Eine gedrückt gehaltene Taste zieht nur einmal.
   - Mit der eigenen Trommel: Ziffern tippen und Enter drücken oder das Tastenfeld auf dem
     Bildschirm benutzen («Zahl eintragen»). «07» wird zu 7. Die App übernimmt nie nach einer
     einzelnen Ziffer, weil aus «1» noch «12» werden kann.
   - Ein Klick auf ein Feld im Raster fragt «42 als gezogen markieren?».
3. **«Lotto!» – Gewinn prüfen.** «Gewinn prüfen» wählen oder G drücken. Solange der Dialog offen
   ist, kann nicht gezogen werden. Die Kontrolle prüft die Karte am Tisch; die App prüft die Zahlen
   nicht.
4. **Entscheiden.**
   - Gültig: «Gewinn bestätigen», optional mit Kartennummer, Name und Notiz. Die App weist darauf
     hin, wenn dieselbe Karte in diesem Gang schon gewonnen hat. Danach ist der nächste Preis aktiv.
   - Ungültig: «Abbrechen». Es wird nichts erfasst, das Spiel geht weiter.
5. **Mehrere Gewinnkarten.** Mit «Weitere Karte» jede gültige Karte erfassen. Je nach Einstellung
   folgt das Stechen («Stechen ziehen»: eine Zahl pro Karte, die höchste oder tiefste gewinnt; bei
   Gleichstand ziehen nur die gleichstehenden Karten nochmals), oder alle Karten teilen sich den
   Preis.
6. **Gewinnanzeige.** Nach jedem bestätigten Gewinn zeigt die Anzeige den Gewinn 60 Sekunden lang.
   Die nächste gezogene Zahl beendet die Gewinnanzeige sofort.
7. **Ende des Gangs.** Nach dem letzten Preis zeigt die Konsole eine Zusammenfassung und den
   nächsten Gang, die Anzeige die Preise des nächsten Gangs. Weiter mit «Gang starten».

## Tastenkürzel

| Taste               | Wirkung                                       |
| ------------------- | --------------------------------------------- |
| Leertaste           | Drehen (während der Animation: sofort zeigen) |
| Ziffern, dann Enter | Zahl eintragen                                |
| Ctrl/Cmd + Z        | Rückgängig                                    |
| G                   | Gewinn prüfen                                 |
| P                   | Pause ein/aus                                 |
| A                   | Anzeige öffnen                                |
| F                   | Vollbild                                      |
| Esc                 | Dialog schliessen, Eingabe leeren             |
| ?                   | Übersicht der Tastenkürzel                    |

Die Kürzel sind nur in der Konsole aktiv und nicht, solange ein Textfeld den Fokus hat.

## Rückgängig und Widerruf

- **Rückgängig** (Ctrl/Cmd + Z) nimmt nur die letzte Ziehung zurück und nur, wenn danach kein
  Gewinn bestätigt und kein Preis übersprungen wurde.
- **Letzten Gewinn widerrufen** (Menü «Spielleitung») geht nur für den letzten Gewinn der
  laufenden Gangs und braucht einen Grund; der Preis ist danach wieder aktiv. Wird das Brett nach
  jedem Preis geleert, zuerst die seither gezogenen Zahlen rückgängig machen.
- In früheren Gängen lassen sich nur die Angaben zur Gewinnkarte korrigieren (Kartennummer, Name,
  Notiz), nicht der Gewinn selbst.
- Jede Rücknahme, jeder Widerruf und jede Korrektur steht im Protokoll; nichts wird gelöscht.

## Eingriffe der Spielleitung

Im Menü «Spielleitung», jeweils mit Bestätigung und einem Grund, der protokolliert wird:

- **Preis überspringen:** Der aktive Preis wird nicht vergeben, der nächste ist aktiv.
- **Gang abbrechen:** Vergebene Preise bleiben vergeben, offene bleiben offen. Ein Gang, der
  vor der ersten Zahl abgebrochen wird, gilt wieder als ausstehend.
- **Zu Gang springen:** Startet einen anderen Gang; ein laufender Gang wird dabei abgebrochen.
  So lässt sich auch ein abgebrochener Gang später fertig spielen.
- **Anlass abschliessen:** Beendet den Anlass; danach sind nur noch Korrekturen möglich.

## Pause

P schaltet den Pausenbildschirm ein und aus. Über die Schaltfläche «Pause» lassen sich eine
Mitteilung und die Zeit für «Weiter um …» eingeben; die Sponsoren des Anlasses erscheinen dazu.

## Ende des Anlasses

1. Nach dem letzten Gang «Anlass abschliessen»: Die Anzeige zeigt den Schlussbildschirm.
2. Sofort eine Sicherung exportieren (Einstellungen → Daten).
3. Unter «Auswertung» die Gewinnerliste für den Gabentisch drucken und die Ausgabe als «abgeholt»
   markieren.
4. Nach dem Anlass die Gewinnernamen löschen (Einstellungen → Daten). Namen bleiben bis dahin nur
   auf diesem Gerät; auf der Anzeige erscheinen sie nur, wenn das für den Anlass eingeschaltet ist.

## Wenn etwas schiefgeht

- **«Nur Ansicht: Ein anderes Fenster steuert das Spiel.»** Es ist ein zweites Konsolenfenster
  offen. Im richtigen Fenster weiterspielen oder hier «Steuerung übernehmen» wählen.
- **Speicherwarnung.** Das Spiel läuft weiter, wird aber nicht gesichert. Sofort «Jetzt
  exportieren» wählen und danach Speicherplatz freigeben.
- **«Kein dauerhafter Speicher verfügbar».** Das Fenster ist vermutlich privat. In einem normalen
  Fenster weiterspielen oder regelmässig exportieren.
- **«Anzeige nicht verbunden».** Das Anzeigefenster neu laden oder mit A erneut öffnen; es übernimmt
  den aktuellen Stand sofort.
- **Absturz oder Stromausfall.** Browser neu öffnen: Jede bestätigte Aktion ist gespeichert.
  Danach die Anzeige wieder öffnen.
- **«Daten können nicht geladen werden».** Zuerst «Rohdaten exportieren», dann die letzte Sicherung
  importieren. «Alles zurücksetzen» löscht alle Daten auf diesem Gerät und verlangt eine
  Bestätigung durch Eintippen.
- **«Update bereit».** Erscheint nur zwischen den Gängen. «Jetzt aktualisieren» lädt Konsole und
  Anzeige neu; das Spiel bleibt erhalten.
