BB Scorekeeper DBV v6.1 - Local Live Prototype
================================================

Node.js / npm werden nicht benötigt.

Start:
  cd "C:\Users\Seokhyun.Choi\Desktop\개인\BB_Scorekeeper_DBV_v6_1"
  py -m http.server 8000

Scorer:
  http://localhost:8000/

Live:
  http://localhost:8000/live.html

Alternativ kann die Live-Seite über die Schaltfläche ● LIVE im Scorer
in einem neuen Tab geöffnet werden.

v6.1:
- Automatische Schlagstatistik aus v6 beibehalten
- Live-Ansicht
- Aktuelles Inning und TOP/BOTTOM
- Auszahl
- Aktuelle Läufer auf 1B, 2B und 3B
- Aktueller Schlagmann
- Guest-/Home-Spielstand
- Letzte zwölf Spielzüge
- Line Score
- Live-Aktualisierung über localStorage und Firebase Realtime Database
- Schnelleingabe für Plate-Appearance-Ergebnisse
- Automatisches Öffnen der Detailansicht, wenn Läuferbewegungen erforderlich sind
- Firebase Realtime Database und öffentliche Testregeln erforderlich
- 2026er Kader werden nach der Datensynchronisierung von BB_Baseball_Stats_DE
  automatisch erzeugt und für die Spielernamen-Autovervollständigung verwendet

Aktuelle Einschränkungen:
- Der Scoresheet basiert noch auf einer einzelnen Teamansicht und bildet den
  vollständigen Home-/Away-Spielzustand noch nicht ab
- Kein Video-Livebild
- Kein Online-Server/WebSocket; lokaler localhost-Prototyp
- Der aktuelle Pitcherstatus wird noch nicht automatisch verfolgt

Spielernamen-Autovervollständigung:
  Nach `sync_data.py` in BB_Baseball_Stats_DE wird
  `data/rosters-2026.json` in diesem Ordner aktualisiert. Beim erneuten Öffnen
  des Scorekeepers werden die Spielernamen der ausgewählten Mannschaft aus der
  Saison 2026 vorgeschlagen. Nicht vorhandene Spieler können weiterhin
  manuell eingegeben werden.
