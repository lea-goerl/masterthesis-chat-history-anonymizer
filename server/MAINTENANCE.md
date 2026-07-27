# Wartung & Betrieb – Privacy-Guardrail (LMU-Server)

Kurzreferenz für den laufenden Betrieb: verbinden, neue Version ausrollen,
Service steuern, Ergebnisse abrufen.

Voraussetzung für alles: **eduVPN ins MWN** aktiv
(https://doku.lrz.de/vpn-ins-mwn-10333177.html). SSH geht nur aus dem Uni-Netz.

Der SSH-Alias `guardrail` ist in `~/.ssh/config` hinterlegt, deshalb reicht
überall `guardrail` statt der langen Adresse.

---

## 1. Auf den Server verbinden

```bash
ssh guardrail
```

(entspricht `ssh -p 22022 privacy-guardrail@privacy-guardrail.medien.ifi.lmu.de`)

## 2. Neue App-Version ausrollen (Frontend geändert)

Immer, wenn du am Code etwas geändert hast:

```bash
cd "/Users/leagoerl/Documents/MA/Implementation_PreStudy/chat-unpacker"
npm run build                                   # erzeugt dist/ neu

ssh guardrail "rm -rf ~/web/privacy-guardrail/dist"
scp -r dist guardrail:~/web/privacy-guardrail/
```

Reine `dist/`-Updates brauchen **keinen** Neustart. Nur wenn du `main.py`
(das Backend) geändert hast:

```bash
ssh guardrail "sudo systemctl restart privacy-guardrail"
```

Danach im Browser prüfen: https://privacy-guardrail.medien.ifi.lmu.de/?id_one=testrun

## 3. Service steuern

```bash
ssh guardrail "systemctl is-active privacy-guardrail"   # läuft er? -> active
ssh guardrail "sudo systemctl restart privacy-guardrail"
ssh guardrail "sudo systemctl stop privacy-guardrail"
ssh guardrail "sudo systemctl start privacy-guardrail"
```

Logs anschauen (z. B. bei Fehlern):

```bash
ssh guardrail "sudo journalctl -u privacy-guardrail -n 100"   # letzte 100 Zeilen
ssh guardrail "sudo journalctl -u privacy-guardrail -f"       # live mitlesen
```

## 4. Ergebnisse (Datenspenden) abrufen

Jede Einsendung liegt als eigene JSON-Datei in
`~/web/privacy-guardrail/data/submissions/` (Name: `<id_one>__<zeit>.json`).

Wie viele sind da / welche?

```bash
ssh guardrail "ls -la ~/web/privacy-guardrail/data/submissions/"
ssh guardrail "ls ~/web/privacy-guardrail/data/submissions/ | wc -l"   # Anzahl
```

Alle Dateien auf den Mac herunterladen (in einen lokalen Ordner `submissions/`):

```bash
mkdir -p ~/Desktop/vorstudie-submissions
rsync -av guardrail:~/web/privacy-guardrail/data/submissions/ ~/Desktop/vorstudie-submissions/
```

(rsync lädt nur neue/geänderte Dateien – ideal, um zwischendurch immer wieder
den aktuellen Stand zu holen.) Alternativ mit scp:

```bash
scp -r guardrail:~/web/privacy-guardrail/data/submissions ~/Desktop/vorstudie-submissions
```

Eine einzelne Datei ansehen, ohne sie herunterzuladen:

```bash
ssh guardrail "cat ~/web/privacy-guardrail/data/submissions/<DATEINAME>.json"
```

## 5. Aufräumen (z. B. Testdaten löschen)

```bash
ssh guardrail "rm ~/web/privacy-guardrail/data/submissions/testrun__*.json"
```

---

### Format einer Ergebnis-Datei

```json
{
  "received_at": "2026-07-…T…Z",
  "remote_addr": "…",
  "payload": {
    "id_one": "…",
    "conversations": [ /* nur die User-Prompts, geschwärzt */ ],
    "masking_summary": {
      "total_masked_terms": 12,
      "tag_counts": { "direct_identifier": 4, "…": 0 },
      "masked_terms": [ { "tag": "direct_identifier", "length": 14 } ]
    },
    "total_conversations": 4,
    "total_messages": 6
  }
}
```

Hilfe-Meldungen (aus dem Help-Formular) landen im selben Ordner, haben aber
`helpMessage` statt `conversations` im `payload`.
