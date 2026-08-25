# Scorito MatchKing Advisor

Lokale webapp voor MatchKing advies op basis van odds, met opslag in SQLite via Prisma.

## Stack

- Next.js 15
- React + TypeScript
- TailwindCSS
- Prisma
- SQLite (lokaal)

## Lokale setup

1. Installeer dependencies:

```bash
npm install
```

2. Vul je API keys in in .env:

```env
ENABLE_EXTERNAL_SYNC="true"
API_FOOTBALL_KEY="jouw_key"
ODDS_API_KEY="jouw_key"
```

`ENABLE_EXTERNAL_SYNC` wordt in de app altijd als `true` behandeld.

3. Maak of update je lokale database:

```bash
npx prisma migrate dev
```

4. Start de app:

```bash
npm run dev
```

Na opstarten:

- De homepage probeert automatisch een eerste sync te doen als de lokale data nog leeg is.
- Je kunt altijd handmatig syncen met de knop "Sync nu via API" op de homepage.
- Je hebt nu aparte pagina's voor NL, KKD, BE en INT.
- Op elke variantpagina kun je via "Kies speelronde" wisselen tussen speelrondes op basis van kickoff-datums.
- Elke speelronde toont nu ook een datumrange (bijv. `16 aug - 18 aug`).

## Belangrijke lokale commando'**s**

- Handmatige sync via script (optioneel, meestal niet nodig):

```bash
npm run sync:local
```

- Variant-specifieke sync (bijvoorbeeld KKD):

```bash
npm run sync:local -- KKD
```

- Sync via API endpoint (de knop gebruikt dit endpoint):

```bash
curl -X POST http://localhost:3000/api/sync
```

- Validatie:

```bash
npm run lint
npm run test
npm run build
```

## API endpoints

- GET /api/dashboard
- GET /api/predictions
- GET /api/scenarios
- GET /api/scorers
- POST /api/sync

## Opmerking over deployment

Deze setup is bedoeld voor lokaal gebruik. Deployment is niet nodig om de API-gebaseerde adviezen te gebruiken.
