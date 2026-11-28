# Pame

Echtzeit-Partyspiel mit React, Vite, Tailwind, Express und Socket.IO. Auf der Startseite treten Mitspieler direkt mit Raumcode und Namen bei. „Raum erstellen“ führt zur Spielleitung auf `/admin`; Einladungen über `/player?room=CODE` füllen den Raumcode vor.

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

Danach `http://localhost:5173` öffnen. Spieler geben direkt auf der Startseite Raumcode und Namen ein und klicken auf **Beitreten**. Zum Erstellen auf **Raum erstellen** klicken und den eigenen Namen als Spielleiter eingeben. Die Spielleitung erhält einen sechsstelligen Raumcode und einen Beitrittslink. Einladungen füllen den Raumcode im Beitrittsformular vor.

`/admin` und `/player` sind weiterhin direkt erreichbar. Das Pame-Logo lässt die Spielleitung in ihrer aktuellen Adminansicht. Oben rechts öffnen **Einstellungen** die Raumaktionen. Spieler finden dort Raumcode und **Raum verlassen**. Bei der Spielleitung bleiben Raumcode und **Einladen** in der Lobby sichtbar und stehen während einer Runde in den Einstellungen.

Im selben WLAN `localhost` durch die LAN-IP des Rechners ersetzen. Die Ports 5173 und 3001 müssen im privaten Netzwerk erreichbar sein.

## Mehrere Gruppen gleichzeitig

Jede Spielleitung erstellt einen eigenen Raum. Spieler, Spielmodus, Punkte, Abstimmungen, Ausschlüsse, Rangliste und Timer sind pro Raum getrennt. Namen müssen nur innerhalb desselben Raums eindeutig sein. Der Name der Spielleitung wird beim Erstellen im Raum gespeichert und ist für sie reserviert. Imposter und DrinkGame übernehmen ihn automatisch, auch nach einem Neuladen oder Wiederöffnen des Adminraums. Derselbe Browser kann in verschiedenen Räumen teilnehmen; die Verbindung zu einer Spieleridentität innerhalb desselben Raums kann immer nur ein Tab gleichzeitig verwenden.

Der Raumcode und der Beitrittslink sind für Spieler bestimmt. Zum Verwalten benötigt die Spielleitung zusätzlich den automatisch erzeugten **Spielleiter-Schlüssel**. Er steht in den Einstellungen unter „Spielleiter-Schlüssel sichern“ und wird in der Browsersitzung gespeichert. Die Adminseite kann nach einem Neuladen automatisch zurückkehren. Auf einem anderen Gerät über „Bestehenden Raum verwalten“ Raumcode und Spielleiter-Schlüssel eingeben. Ein fremder Raumcode allein erlaubt keine Admin-Aktionen.

„Raum verlassen“ führt zur Raumwahl zurück; andere Gruppen bleiben unberührt. Das Verlassen eines Spielmodus führt weiterhin in die Lobby desselben Raums.

Die Räume laufen gemeinsam in einer Node.js-Serverinstanz und liegen im Arbeitsspeicher. Ein Serverneustart setzt alle Räume und Punkte zurück. Reconnects innerhalb von fünf Sekunden erhalten den Spieler. Räume ohne verbundene Spieler oder Spielleitung werden nach 30 Minuten mit ihren Timern entfernt. Gleichzeitig können bis zu 100 Räume bestehen.

## Server und Admin-Schlüssel

Für private lokale Runden können Räume ohne Server-Schlüssel erstellt werden. Soll der Server öffentlich erreichbar sein, einen langen zufälligen `ADMIN_TOKEN` setzen. Dieser Server-Schlüssel erlaubt das **Erstellen neuer Räume**. Er muss mindestens 16 Zeichen haben. Im Produktionsmodus startet der Server ohne diesen Schlüssel nicht.

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

Auf `/admin` wird bei konfiguriertem `ADMIN_TOKEN` der Server-Schlüssel zum Erstellen eines Raums abgefragt. Zum Wiederöffnen eines bestehenden Raums reicht dessen eigener Spielleiter-Schlüssel. Spieler benötigen nur den Raumcode. Öffentliches Hosting sollte HTTPS verwenden. Den Server-Schlüssel nicht mit `VITE_` benennen oder in Frontend-Dateien eintragen: Frontend-Variablen sind für Besucher sichtbar.

`GET /health` liefert den Serverstatus. Für getrenntes Frontend-/Backend-Hosting `frontend/.env.production.example` als lokale `frontend/.env.production` kopieren und `VITE_SERVER_URL` auf die eigene HTTPS-Backend-Adresse setzen. Lokal ist die Variable optional; ohne sie wird der aktuelle Host auf Port 3001 verwendet.

## Build und Tests

```sh
npm run check
```

Das prüft Spielabläufe, Rollen, Reconnects, Rundenenden, die Trennung gleichzeitiger Räume, JSON und Bildpfade, rendert die Spielansichten, führt ESLint aus und baut das Frontend. Das Ergebnis liegt in `frontend/dist`.

Zusätzlicher Durchlauf in Chrome oder Edge mit zwei gleichzeitig spielenden Gruppen, getrennten Browserprofilen, Raumwechsel und Wiederbeitritt:

```sh
npm run test:browser
```

Der Browserdurchlauf prüft außerdem den Einladungslink, Formularfehler, Layouts von 320 bis 1440 Pixeln, Tablet-Hoch- und Querformat, lange Fragen und Namen sowie die Lobby mit 20 Spielern. Er kontrolliert horizontales Scrollen, wichtige Touch-Ziele und sichtbaren Tastaturfokus. Eine kleinere Fensterhöhe simuliert den verfügbaren Platz bei geöffneter Bildschirmtastatur; eine echte Mobilgerät-Tastatur wird damit nicht getestet.

Optional den Browserpfad über `BROWSER_BIN` festlegen. Zum Prüfen des geschützten Adminzugangs kann `SMOKE_ADMIN_TOKEN` auf einen Testschlüssel mit mindestens 16 Zeichen gesetzt werden. Browserprofile und Screenshots landen ausschließlich in `.test-artifacts` und gehören nicht ins öffentliche Repository.

Firebase-Hosting ist optional. `frontend/firebase.json` enthält die SPA-Weiterleitung. Wer Firebase nutzt, kopiert `frontend/.firebaserc.example` nach `frontend/.firebaserc` und trägt die eigene Projekt-ID ein. Eine bestehende Hosting-Zuordnung wird nicht mitgeliefert.


