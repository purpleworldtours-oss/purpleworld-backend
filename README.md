# purple-backend

REST API for the Purpleworld Tours website and admin panel.
Node.js + Express 5 + MongoDB (Mongoose), written in TypeScript.

## Setup

1. Install and start MongoDB (the Windows service "MongoDB" is enough locally).
2. `npm install`
3. Copy `.env.example` to `.env` and fill it in. `JWT_SECRET` and `ADMIN_PASSWORD` must be real values.
4. `npm run seed`: creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and imports the
   website's current destinations and Kerala packages. Safe to re-run; it skips what already exists.

   There is one admin account and its password is set only in `.env`. To change it, edit
   `ADMIN_PASSWORD` and run `npm run seed` again.
5. `npm run dev`: API on http://localhost:4000

For production: `npm run build`, then `npm start`.

## API

Public routes return published items only. Write routes need `Authorization: Bearer <token>`
from `/api/auth/login`. Adding `?all=1` with a token includes drafts.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | – | Email + password → token (rate-limited: 10 per 15 min) |
| GET | `/api/auth/me` | ✔ | Current admin |
| GET | `/api/packages` | – | List (`?destination=Kerala`, `?featured=1`) |
| GET | `/api/packages/destinations` | – | Destinations that have packages |
| GET | `/api/packages/:slugOrId` | – | One package |
| POST / PUT / PATCH / DELETE | `/api/packages[/:id]` | ✔ | Create / replace / toggle published+featured / delete |
| GET | `/api/destinations` | – | Featured Destinations cards |
| POST / PUT / DELETE | `/api/destinations[/:id]` | ✔ | Manage cards |
| POST | `/api/enquiries` | – | Website enquiry form (rate-limited: 5 per 10 min per IP) |
| GET | `/api/enquiries` | ✔ | List (`?status=new|contacted|closed`) |
| GET | `/api/enquiries/counts` | ✔ | Count per status |
| PATCH / DELETE | `/api/enquiries/:id` | ✔ | Set status / team notes, or delete |
| GET / POST | `/api/media` | ✔ | List / upload images (field `files`, up to 20, 5 MB each) |
| PATCH / DELETE | `/api/media/:id` | ✔ | Edit alt text / delete (409 if in use; `?force=1` to override) |

Uploaded images are stored on Cloudinary (folder `purple-world`) and the database stores their
full `https://res.cloudinary.com/…` URL. Images uploaded before the switch lived in `uploads/`;
`npm run migrate:uploads` moves them to Cloudinary and updates every page that uses them.

## Before going live

- Set `CORS_ORIGINS` to the real website and admin URLs.
- Serve the API over HTTPS.
"# purpleworld-backend" 
