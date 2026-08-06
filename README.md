# Giochini del Pupi

Hub dei giochi Pupi con app dedicata `Serie A 1X2`.

## Serie A 1X2

MVP production-ready:

- calendario Serie A 2026-27 dalla giornata 1 alla 38
- login con nome e PIN
- pronostici privati per utente
- cutoff di giornata all'orario della prima partita
- classifica pubblica senza mostrare i pronostici degli altri
- endpoint admin per inserire risultati ufficiali
- sync opzionale da football-data.org

## Comandi

```bash
npm install
npm run build
npm start
```

Il server espone:

- frontend: `http://localhost:3000`
- app Serie A 1X2 diretta: `http://localhost:3000/serie-a-1x2`
- health check: `http://localhost:3000/api/health`
- calendario: `GET /api/fixtures`
- classifica: `GET /api/leaderboard`

## Produzione

Variabili ambiente:

```bash
PORT=3000
ADMIN_TOKEN=token-lungo-segreto
FOOTBALL_DATA_TOKEN=token-football-data
FOOTBALL_DATA_COMPETITION=SA
FOOTBALL_DATA_SEASON=2026
FOOTBALL_DATA_SYNC_INTERVAL_MS=900000
```

Il database locale viene scritto in `data/serie-a-1x2.json`. In produzione serve un disco persistente o, come step successivo, migrazione a Postgres/Supabase.

Su Render usare:

- build command: `npm install && npm run build`
- start command: `npm start`
- persistent disk mount path: `/var/data`
- `DATA_DIR=/var/data`

Il file `render.yaml` contiene gia il blueprint del servizio. `ADMIN_TOKEN` e `FOOTBALL_DATA_TOKEN` vanno inseriti nel pannello Render come secret/env var.

## Iscrizione e cutoff

L'utente si iscrive dalla pagina `Serie A 1X2` con nome e PIN. Lo stesso nome e PIN servono poi per il login.

I pronostici sono salvati sul server e sono visibili solo all'utente proprietario. La classifica pubblica mostra solo punti e numero di pronostici inviati.

La cutoff e per giornata: quando arriva l'orario ufficiale di kickoff della prima partita della giornata (`utcDate` da football-data), tutta la giornata diventa bloccata. Questa regola evita gestione complicata con anticipi e posticipi.

## Admin risultati

```bash
curl -X PUT http://localhost:3000/api/admin/results/g01m01 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"officialResult\":\"1\"}"
```

Valori accettati: `1`, `X`, `2`.

## Sync football-data

```bash
curl -X POST http://localhost:3000/api/admin/sync-football-data \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Il sync aggiorna calendario, orari ufficiali, stato partite e risultati finiti usando `FOOTBALL_DATA_TOKEN`.

Se `FOOTBALL_DATA_TOKEN` e presente, il server fa sync automatico all'avvio e poi ogni 15 minuti.
