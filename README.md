# Padel Anzeige

Großer Padel-Spielstand fürs Handy am Zaun (PWA, Deutsch, offline-fähig).

- Punkte 0/15/30/40, Einstand/Vorteil oder Golden Point, Tiebreak bei 6:6 bis 7, Sätze (1/2 aus 3/3 aus 5), optional Match-Tiebreak bis 10
- Zählen: Antippen (linke/rechte Hälfte, lange drücken = rückgängig), Tastatur/Bluetooth-Fernbedienung (Tasten lernbar), Uhr über ntfy.sh
- Rückgängig ohne Grenze über Spiel/Satz/Match, Stand bleibt beim Neuladen
- Bildschirm bleibt an (Wake Lock), Vollbild, helle Anzeige für pralle Sonne

## Empfang von der Uhr
Die Anzeige abonniert `https://ntfy.sh/<Code>/sse`. Nachrichten:
`A`, `B`, `UNDO`, `RESET` oder JSON der Uhr `{"c":"A","m":"<match-id>","n":<seq>,"st":{...}}` (kompletter Stand, wird übernommen).

Test: `curl -d A ntfy.sh/<Code>`

## Tests
`node ../padel-test/score.test.js` (Zähl-Logik), `node ../padel-test/e2e.js` (Headless Chrome, braucht lokalen Server auf 8793).
