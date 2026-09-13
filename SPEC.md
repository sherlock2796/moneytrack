# MoneyTrack — Specifica

Tracker di spese personali stile Monefy. Decisioni prese il 13/09/2026.

## Piattaforma
- **PWA** (HTML/CSS/JS puri, ES modules, nessun build step). Librerie esterne vendorizzate in `lib/`.
- Hosting: **GitHub Pages** (repo su GitHub dell'utente). Deploy = push sul branch `main`.
- Installabile sulla home (manifest + service worker), funziona **offline**.
- Tema chiaro + scuro automatico (segue il sistema, forzabile nelle impostazioni).
- Lingua: **italiano + inglese**, selezionabile.
- Valuta: **solo euro**, formato italiano (`1.234,56 €`).
- Nessun PIN all'apertura.

## Utente e sincronizzazione
- Un solo utente, **più dispositivi** (telefono + PC).
- Backend: **Supabase** (piano gratuito). Login email + password.
- Offline-first: i dati vivono in IndexedDB sul dispositivo; sync bidirezionale con Supabase quando c'è rete.
  - Ogni riga ha `id` (uuid), `updated_at`, `deleted` (soft delete). Conflitti: vince l'`updated_at` più recente.
- Backup manuale: esporta/importa **JSON completo** + esporta **CSV** per Excel.

## Modello dati
- **Conti** (`accounts`): nome, icona, colore, saldo iniziale, incluso nel totale (sì/no), ordine, archiviato.
  - Iniziali (da Notion): `Cash`, `Extra Cash`, `Saving LY`, `Bybyt`.
- **Categorie** (`categories`): nome, tipo (`expense`/`income`), icona, colore, budget (importo + periodo `month`/`year`), ordine, archiviata.
  - Predefinite + personalizzabili (aggiungi / rinomina / icona / colore / budget). Nessuna sottocategoria.
  - Spese iniziali (da Notion, con budget):
    Bills 202/m · Rent 302/m · Spesa 202/m · Food & Drinks 152/m · Benzina + auto 302/m · Abbonamenti 102/m ·
    Entertainment 52/m · Tabaccheria 52/m · Extra 165/m · Weed 252/m · Animali 28/m ·
    Viaggi 1400/anno · Assicurazioni 850/anno · Spese mediche 765/anno · Lose/Gain · Casa + Piscina
  - Entrate iniziali (da Notion "Source"): Salary, Side Hustle, Ripetizioni, Remains.
- **Transazioni** (`transactions`): tipo (`expense`/`income`/`transfer`), importo, data, categoria, conto, conto destinazione (solo transfer), nota, flag `recurring` (etichetta), id ricorrenza di origine.
- **Ricorrenze** (`recurring`): come una transazione + frequenza (`weekly`/`monthly`/`quarterly`/`yearly`/`2years`), prossima data, attiva. L'app genera le transazioni alla scadenza (all'apertura) e mostra i prossimi rinnovi.
  - Iniziali: gli 11 abbonamenti attivi di Notion (Rata auto, Wi-Fi, Claude, GamePass, Amazon Prime, Assicurazione auto/civile, Bollo, Tagliando, Caldaia, Crunchyroll).
- **Impostazioni**: budget totale mensile, lingua, tema, ultimo sync.

## Funzioni
1. **Inserimento rapido**: tastierino calcolatrice (`+ − × ÷`, es. `12.50+3.20`), scelta categoria a griglia con icone, conto, data (default oggi), nota. Spesa / Entrata / Trasferimento.
2. **Schermata principale**: anello (donut) per categoria con totale al centro; periodi Giorno / Settimana / Mese / Anno / Tutto + intervallo personalizzato, frecce per scorrere. Il mese parte dal 1°. Il flag "ricorrente" NON ripartisce l'importo: pesa nel giorno registrato (come Monefy).
3. **Conti**: saldo per conto, saldo totale (solo conti inclusi), trasferimenti.
4. **Budget**: totale mensile + per categoria (mensile o annuale) con barre di avanzamento, rosso se sforato.
5. **Statistiche**: barre mensili entrate vs uscite (12 mesi); storico per categoria (mese per mese); lista transazioni con ricerca per nota e filtri conto/categoria/periodo.
6. **Backup**: export JSON, import JSON, export CSV.
7. **Import da Notion**: una tantum — i dati (303 spese, 37 entrate, trasferimenti, conti, categorie, abbonamenti) vengono estratti dal workspace Notion e caricati come dati iniziali.

## Struttura repo
```
index.html            app shell
manifest.webmanifest  PWA
sw.js                 service worker (cache offline)
css/                  stili
js/                   moduli (db, sync, ui, views, i18n, charts, recurring, import/export)
lib/                  librerie vendorizzate (supabase-js)
data/                 seed iniziale (export da Notion)
supabase/schema.sql   tabelle + RLS da eseguire nel progetto Supabase
icons/                icone PWA
```
