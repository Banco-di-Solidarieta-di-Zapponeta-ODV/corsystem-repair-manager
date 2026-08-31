# CorSystem feature modules

Questa cartella raccoglie il dominio applicativo separato dall'interfaccia monolitica ereditata da RepairNOTE.

Moduli previsti:

- `clients` - anagrafica clienti e storico
- `devices` - dispositivi, IMEI/seriale e relazione con il cliente
- `intake` - accettazione, foto, accessori e firma
- `repairs` - diagnosi, stati, assegnazione tecnico e lavorazione
- `quotes` - preventivi, versioni e approvazione cliente
- `inventory` - ricambi, fornitori, giacenze e movimenti
- `payments` - acconti, saldi, metodi di pagamento e margini
- `notifications` - email/SMS/WhatsApp e log notifiche
- `dashboard` - KPI operativi e finanziari

## Regola di refactoring

Il codice viene estratto progressivamente da `src/app/page.jsx` senza riscritture massive. Ogni modulo deve essere collegato solo dopo aver verificato che il comportamento esistente resti invariato.
