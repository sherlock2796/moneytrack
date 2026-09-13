# MoneyTrack

Tracker di spese personali stile Monefy, come **PWA** (funziona su iPhone, Android e PC, installabile sulla home, offline).
Nessun build step: HTML/CSS/JS puri. Le decisioni di progetto sono in [SPEC.md](SPEC.md).

## Provare in locale

```
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

poi apri http://localhost:8765/ (serve un server perché i moduli ES non si caricano da `file://`).

## Pubblicare su GitHub Pages

1. Crea un repository su GitHub (es. `moneytrack`), pubblico o privato.
2. Push del progetto sul branch `main`.
3. Su GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`** → Save.
4. Dopo ~1 minuto l'app è su `https://<utente>.github.io/moneytrack/`.
5. Dal telefono: apri l'indirizzo → **Aggiungi alla schermata Home** (iPhone: Condividi → Aggiungi a Home; Android: menu → Installa app).

Ogni push successivo aggiorna l'app: alla prossima apertura compare "Nuova versione disponibile".
Ricorda di cambiare `VERSION` in `sw.js` (e `version` in `js/config.js`) quando pubblichi modifiche, così la cache offline si rinnova.

## Sincronizzazione (Supabase)

1. Crea un progetto gratuito su https://supabase.com (regione EU).
2. **SQL Editor** → incolla il contenuto di `supabase/schema.sql` → Run.
3. **Authentication → Providers → Email**: lascia attivo Email; se vuoi evitare l'email di conferma, disattiva "Confirm email".
4. **Project Settings → API**: copia `Project URL` e `anon public key`, e mettili in `js/config.js`
   (oppure inseriscili nell'app in *Altro → Sincronizzazione*).
5. Nell'app: *Altro → Registrati* con email e password, poi *Accedi* dagli altri dispositivi con le stesse credenziali.

La chiave `anon` è pubblica per design: i dati sono protetti dalle policy RLS (ogni utente vede solo le proprie righe).

## Struttura

```
index.html, manifest.webmanifest, sw.js   PWA shell + cache offline
css/app.css                               stili (tema chiaro/scuro)
js/app.js                                 bootstrap, router, shell
js/store.js, js/db.js                     stato in memoria + IndexedDB
js/sync.js                                sync Supabase (offline-first, last-write-wins)
js/views/*.js                             Home, Aggiungi, Conti, Budget, Statistiche, Lista, Impostazioni
js/importer.js                            import Notion, backup JSON, export CSV
js/recurring.js                           ricorrenze
data/notion/*.json                        dati iniziali esportati da Notion
supabase/schema.sql                       tabelle + RLS
```

## Test

`tools/test.html` esegue i test delle funzioni pure (calcolatrice, date, periodi, ricorrenze, grafici):
avvia il server locale e apri http://localhost:8765/tools/test.html — in fondo alla pagina il conteggio ok/falliti.
