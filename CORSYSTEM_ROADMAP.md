# CorSystem Repair Manager

Fork evolutivo di RepairNOTE per la gestione completa del laboratorio tecnico CorSystem.

## Obiettivo

Trasformare RepairNOTE in un gestionale modulare per:

- clienti
- dispositivi
- accettazione riparazione
- stato lavorazione
- tecnico assegnato
- preventivi
- ricambi e magazzino
- pagamenti
- notifiche cliente
- storico interventi
- dashboard operativa

## Workflow target

Cliente → Dispositivo → Accettazione → Diagnosi → Tecnico assegnato → Preventivo → Approvazione cliente → Ricambi → Lavorazione → Test → Pronto → Pagamento → Consegna → Storico

## Fase 1 — Fondamenta

1. Refactoring del file monolitico `src/app/page.jsx` in moduli separati.
2. Separazione concettuale tra Cliente e Dispositivo.
3. Definizione ruoli: Amministratore, Front Office, Tecnico, Magazzino.
4. Revisione sicurezza per PIN/password/pattern dispositivo.
5. Branding CorSystem e localizzazione italiana.

## Fase 2 — Processo riparazioni

1. Accettazione con foto fronte/retro, IMEI/seriale, accessori consegnati e firma cliente.
2. Diagnosi tecnica strutturata.
3. Preventivo con versioni e stato: bozza, inviato, approvato, rifiutato, scaduto.
4. Assegnazione tecnico e storico cambi stato.
5. Gestione garanzia e rientri.

## Fase 3 — Magazzino e ricambi

1. Catalogo ricambi.
2. Fornitori.
3. Carico/scarico magazzino.
4. Scorta minima.
5. Costo, prezzo vendita e margine per riparazione.
6. Ricambi ordinati e in attesa.

## Fase 4 — Cliente e comunicazioni

1. Pagina pubblica stato riparazione via QR/token.
2. Email automatiche.
3. WhatsApp tramite provider/API configurabile.
4. SMS tramite provider/API configurabile.
5. Eventi automatici: preventivo pronto, approvazione richiesta, attesa ricambio, riparazione pronta, sollecito ritiro.

## Fase 5 — Dashboard

Indicatori principali:

- riparazioni aperte
- in diagnosi
- in attesa preventivo
- in attesa ricambio
- in lavorazione
- pronte per il ritiro
- non ritirate
- carico per tecnico
- tempo medio riparazione
- incassi
- costi ricambi
- margine medio

## Sicurezza dati dispositivo

PIN/password/pattern non devono essere conservati in chiaro. Target:

- cifratura applicativa
- accesso limitato ai tecnici autorizzati
- audit accessi
- cancellazione automatica alla consegna/chiusura
- possibilità di non memorizzarli affatto se non necessari

## Strategia Git

- `main`: versione stabile
- `develop`: integrazione sviluppo
- `feature/*`: singole funzionalità
- modifiche importanti tramite Pull Request verso `develop`

## Stack ereditato

- Next.js
- React
- Prisma
- MySQL/MariaDB
- Playwright

Licenza originale: MIT. Conservare gli avvisi di licenza e attribuzione previsti dal progetto upstream.
