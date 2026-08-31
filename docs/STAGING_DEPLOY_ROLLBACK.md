# CorSystem Repair Manager - Staging, Deploy e Rollback

Questa procedura serve per migrare un database RepairNOTE esistente verso CorSystem Repair Manager senza applicare modifiche alla cieca.

## Regola fondamentale

Non eseguire `prisma migrate deploy` direttamente su produzione senza aver prima:

1. provato la stessa versione su una copia reale del database RepairNOTE;
2. eseguito `npm ci` e `npm audit --audit-level=high`;
3. completato il preflight;
4. creato uno snapshot SQL verificato SHA-256;
5. definito chi può autorizzare il rollback.

Gli script `mysql:setup` e `plesk:setup` ereditati da RepairNOTE non devono essere usati per aggiornare alla cieca un database operativo esistente.

## Prerequisiti server

- Node.js 24+
- npm compatibile con il lockfile
- MySQL 8 / MariaDB compatibile
- client `mysql` o `mariadb`
- `mysqldump` o `mariadb-dump`
- `.env` con `DATABASE_URL=mysql://...`
- directory backup non pubblica e con spazio sufficiente

Le password MySQL non vengono passate come argomento di processo: gli script usano temporaneamente `MYSQL_PWD` nel solo processo figlio.

## Fase A - Preparare STAGING

Creare una copia del database RepairNOTE reale con gli strumenti Plesk/hosting oppure con un dump. La copia deve avere un nome distinto, per esempio `corsystem_repair_staging`.

Impostare `DATABASE_URL` sulla COPIA staging, mai sul database produzione.

Eseguire:

```bash
npm ci
npm run deploy:preflight -- --expect=legacy
npm run deploy:snapshot
```

Il preflight deve riconoscere le tabelle legacy `Staff`, `Client`, `Repair` e `Part`, e deve classificare lo schema come `legacy`.

## Fase B - Migrare STAGING

```bash
CORSYSTEM_DEPLOY_TARGET=staging \
CORSYSTEM_DEPLOY_CONFIRM=APPLY-STAGING \
npm run deploy:apply
```

Il comando esegue nell'ordine:

1. preflight database;
2. audit dipendenze;
3. Prisma validate;
4. build Next.js prima di toccare il database;
5. snapshot SQL con checksum;
6. `prisma migrate deploy`;
7. Prisma generate;
8. verifica post-migrazione.

Al termine eseguire:

```bash
npm run deploy:verify
```

Poi riavviare l'app staging e fare UAT con account distinti Admin, Front Office, Tecnico e Magazzino.

## Checklist UAT staging

- login per tutti i ruoli;
- ricerca cliente storico;
- apertura di almeno una vecchia riparazione;
- dispositivo collegato allo storico;
- nuova accettazione di prova;
- diagnosi e preventivo;
- approvazione dal portale cliente;
- ricambio/prenotazione/uso;
- test finale;
- pagamento e consegna;
- ricevuta A4/80 mm;
- QR stato cliente;
- dashboard;
- verifica che i ruoli non vedano/facciano operazioni non autorizzate.

Annotare i conteggi pre/post di Client, Repair, Part e Staff. Non cancellare lo snapshot staging finché il collaudo non è concluso.

## Fase C - Preparare PRODUZIONE

Prima del deploy:

1. programmare una finestra di manutenzione;
2. impedire nuove scritture durante backup/migrazione;
3. eseguire anche il backup Plesk/hosting oltre allo snapshot CorSystem;
4. conservare SHA commit/release da distribuire;
5. verificare spazio disco per backup + applicazione;
6. predisporre la release precedente per rollback applicativo.

Preflight produzione:

```bash
npm ci
npm audit --audit-level=high
npm run deploy:preflight -- --expect=legacy
npm run deploy:snapshot
```

Solo dopo esito positivo:

```bash
CORSYSTEM_DEPLOY_TARGET=production \
CORSYSTEM_DEPLOY_CONFIRM=APPLY-PRODUCTION \
npm run deploy:apply
```

Riavviare Node.js/Plesk e verificare immediatamente login, dashboard, una pratica storica e una pratica di test.

## Criteri GO / NO-GO

GO solo se:

- build verde;
- migrazioni completate;
- `deploy:verify` verde;
- conteggi clienti/riparazioni/ricambi coerenti;
- nessun errore Prisma/MySQL nei log;
- accesso ai dati storici verificato;
- ruoli verificati;
- snapshot e checksum disponibili fuori dalla web root.

NO-GO se appare uno schema `partial`, una migrazione fallita, conteggi incoerenti o dati storici non leggibili.

## Rollback database

Il rollback è intenzionalmente distruttivo e richiede tre condizioni contemporanee:

- `CORSYSTEM_ROLLBACK_TARGET=staging|production`
- `CORSYSTEM_ROLLBACK_ALLOW_DESTRUCTIVE=YES`
- `CORSYSTEM_ROLLBACK_CONFIRM=RESTORE-<nome_database>`

Esempio:

```bash
CORSYSTEM_ROLLBACK_TARGET=staging \
CORSYSTEM_ROLLBACK_ALLOW_DESTRUCTIVE=YES \
CORSYSTEM_ROLLBACK_CONFIRM=RESTORE-corsystem_repair_staging \
npm run deploy:rollback -- /percorso/backups/2026-08-31-...-predeploy.sql
```

Lo script:

1. verifica che esista anche il file `.sha256`;
2. ricalcola SHA-256;
3. verifica il nome esatto del database nella conferma;
4. rimuove le tabelle correnti del database selezionato;
5. ripristina lo snapshot;
6. pretende che il preflight torni a riconoscere lo schema `legacy`.

Dopo il rollback database bisogna ripristinare ANCHE il codice alla release precedente, eseguire `npm ci`, build e riavvio applicazione. Database e codice devono tornare allo stesso punto temporale.

## Backup da conservare

Per ogni deploy conservare almeno:

- `.sql`
- `.sql.sha256`
- `.sql.json` con host/database/conteggi/SHA commit
- riferimento al commit Git distribuito
- backup hosting/Plesk, se disponibile

Non salvare dump reali nel repository GitHub. `backups/`, `*.sql`, `*.dump` e formati analoghi sono già esclusi da `.gitignore`.

## Limite attuale

Questi strumenti preparano e validano il deploy, ma il test definitivo prima della produzione deve essere fatto su una copia/snapshot REALE del database RepairNOTE. La CI usa fixture realistiche, non i dati reali CorSystem.
