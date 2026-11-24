# Pame

Echtzeit-Partyspiel mit React, Vite, Tailwind, Express und Socket.IO. Die Spielleitung öffnet `/admin`, Mitspieler öffnen `/player`.

Das gesamte Projekt liegt direkt in `party-game`: Backend, Frontend, Bilder, Fragen und Tests. Alle folgenden Befehle werden aus diesem Projektordner ausgeführt. Persönliche Fragensätze und Personenbilder sind entfernt. Lokale Zugangsdaten, Hosting-Zuordnungen und installierte Pakete bleiben auf deinem Rechner und werden durch `.gitignore` von Git ausgeschlossen.

## Spielmodi

- Schätzfragen
- Pixelraten 
- Who Is? mit Emojis sowie Guess the Beer, jeweils mit Hinweisen und Buzzer
- What Is? mit erfundenen Antworten und Abstimmung
- Stadt–Land–Fluss mit eigenen Kategorien
- Imposter mit individuellen Rollen und Abstimmungen
- DrinkGame mit Aufgaben, Abstimmungen und Schätzfragen
- Testchat für lokale Funktionsprüfungen

## Lokal starten

Voraussetzung: Node.js ab 22.12 und npm.

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

Backend und Frontend in zwei Terminals starten:

```sh
npm start
```

```sh
npm run dev
```

Danach `http://localhost:5173/admin` und `http://localhost:5173/player` öffnen. Für weitere Spieler verschiedene Browserprofile oder Geräte verwenden. Im selben WLAN `localhost` durch die LAN-IP des Rechners ersetzen. Die Ports 5173 und 3001 müssen im privaten Netzwerk erreichbar sein.

Es gibt eine gemeinsame Spielrunde. Namen müssen eindeutig sein. Die Spielleitung nimmt in Imposter und DrinkGame mit einem eigenen Namen teil. Spielstände und Punkte liegen im Arbeitsspeicher; ein Serverneustart setzt sie zurück. Reconnects innerhalb von fünf Sekunden erhalten den Spieler.

## Server und Admin-Schlüssel

Für private lokale Runden funktioniert der Adminzugang ohne Schlüssel. Soll der Server öffentlich erreichbar sein, einen langen zufälligen `ADMIN_TOKEN` setzen. Der Schlüssel muss mindestens 16 Zeichen haben. Im Produktionsmodus startet der Server ohne diesen Schlüssel nicht.

`backend/.env.example` als `backend/.env` kopieren. Diese lokale Datei wird beim normalen Start eingelesen und ist durch `.gitignore` ausgeschlossen. Einen Schlüssel beispielsweise so erzeugen:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Die erzeugte Zeichenfolge ausschließlich in der lokalen Backend-Konfiguration oder den Umgebungsvariablen des Hosters speichern:

```dotenv
ADMIN_TOKEN=HIER_DEN_ERZEUGTEN_SCHLUESSEL_EINTRAGEN
PORT=3001
NODE_ENV=production
```

Auf `/admin` wird der Schlüssel abgefragt. Spieler benötigen ihn nicht. Der Browser merkt sich den Schlüssel nur für die aktuelle Browsersitzung und verwendet ihn beim Reconnect erneut. Öffentliches Hosting sollte HTTPS verwenden. Den Schlüssel nicht mit `VITE_` benennen oder in Frontend-Dateien eintragen: Frontend-Variablen sind für Besucher sichtbar.

`GET /health` liefert den Serverstatus. Für getrenntes Frontend-/Backend-Hosting `frontend/.env.production.example` als lokale `frontend/.env.production` kopieren und `VITE_SERVER_URL` auf die eigene HTTPS-Backend-Adresse setzen. Lokal ist die Variable optional; ohne sie wird der aktuelle Host auf Port 3001 verwendet.

## Build und Tests

```sh
npm run check
```

Das prüft Spielabläufe, Rollen, Reconnects, Rundenenden, JSON und Bildpfade, rendert die Spielansichten, führt ESLint aus und baut das Frontend. Das Ergebnis liegt in `frontend/dist`.

Zusätzlicher Durchlauf in Chrome oder Edge mit zwei getrennten Spielerprofilen:

```sh
npm run test:browser
```

Optional den Browserpfad über `BROWSER_BIN` festlegen. Zum Prüfen des geschützten Adminzugangs kann `SMOKE_ADMIN_TOKEN` auf einen Testschlüssel mit mindestens 16 Zeichen gesetzt werden. Browserprofile und Screenshots landen ausschließlich in `.test-artifacts` und gehören nicht ins öffentliche Repository.

Firebase-Hosting ist optional. `frontend/firebase.json` enthält die SPA-Weiterleitung. Wer Firebase nutzt, kopiert `frontend/.firebaserc.example` nach `frontend/.firebaserc` und trägt die eigene Projekt-ID ein. Eine bestehende Hosting-Zuordnung wird nicht mitgeliefert.

## Mit Git weiterarbeiten

`party-game` ist der einzige Projektordner. Änderungen vor dem Hochladen prüfen:

```sh
npm run check
git add .
git commit -m "Beschreibung der Änderung"
git push
```

Beim erstmaligen Hochladen ein leeres GitHub-Repository anlegen und `git push -u origin main` verwenden. Die in `origin` hinterlegte URL muss auf dein eigenes Repository zeigen.

`node_modules`, Build-Ausgaben, lokale `.env`-Dateien, Firebase-Cache, die persönliche Firebase-Projektzuordnung und Browserartefakte sind ausgeschlossen. Beispielkonfigurationen und Paket-Lockdateien gehören dagegen ins Repository. Die ignorierten Dateien bleiben lokal verfügbar; neue Mitwirkende installieren Pakete mit `npm ci` und richten ihre eigene Konfiguration anhand der Beispieldateien ein.

Es wurde keine neue Lizenz für den Quellcode festgelegt. Hinweise zu den unverändert übernommenen Bilddateien stehen in [ASSETS.md](ASSETS.md).
