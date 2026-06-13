# Panel PR · Next.js + Firebase (Firestore)

## Setup

### 1. Instalare
```bash
npm install
```

### 2. Firebase
Proiectul e deja configurat în `.env.local` cu config-ul tău Firebase
(`panel-pr-8036e`). La fel ca panelul vechi — doar config-ul client, fără
Admin SDK / service account.

**Important:** Mergi în Firebase Console → Firestore Database → Rules și
înlocuiește regulile cu cele din `firestore.rules` (acces deschis, ca în
panelul vechi — autentificarea/permisiunile sunt gestionate în cod prin
whitelist + grad).

### 3. Discord Developer Portal
OAuth2 → Redirects → adaugă:
- `http://localhost:3000/auth/callback` (dev)
- `https://test-panel-alpha.vercel.app/auth/callback` (prod)

Completează în `.env.local`:
```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

### 4. Primul admin (whitelist)
Mergi în Firebase Console → Firestore Database → Start collection →
`whitelist` → creează un document cu **ID-ul documentului = Discord ID-ul tău**
și câmpurile:
```
discord_id:  "<discord id>"
full_name:   "Nume Prenume"
rank:        "Manager PR"
employee_id: "PR-001"
callsign:    "PR-1"
join_date:   "2026-06-01"
added_by:    "system"
created_at:  "2026-06-01T00:00:00.000Z"
```

### 5. Run
```bash
npm run dev
```

## Structura de date Firestore

```
members/{discordId}        - membri activi (creat automat la primul login)
whitelist/{discordId}       - acces permis (gestionat din panel /whitelist)
events/{autoId}             - evenimente
events/{autoId}/reactions/{discordId} - prezență membri (1 reacție/persoană)
member_events/{autoId}       - evenimente oferite membrilor
announcements/{autoId}        - anunțuri dashboard
system_updates/{autoId}       - actualizări sistem dashboard
```

## Structura proiectului
```
panel-pr/
├── app/
│   ├── page.js              # Login Discord
│   ├── auth/callback/        # OAuth callback + whitelist check + upsert membru
│   ├── hub/                  # Pagina principală (bento grid)
│   ├── dashboard/             # Statistici, anunțuri, actualizări
│   ├── members/                # Listă membri + editare
│   ├── events/                  # Evenimente, reacții, statusuri
│   ├── whitelist/                # Gestionare acces
│   └── api/auth/               # Discord OAuth token exchange (server-only)
├── components/
│   └── UserCard.js            # Topbar cu user + sync realtime grad
├── lib/
│   └── firebase.js             # Config client Firestore
├── firestore.rules              # Reguli Firestore (acces deschis)
└── .env.local
```

## Realtime
Toate paginile folosesc `onSnapshot` din Firestore — orice modificare
(grad, status, eveniment, reacție, anunț) se reflectă instant pe toate
sesiunile conectate, fără refresh.
