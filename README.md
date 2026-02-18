# TiDB Cloud Zero TODO App (Node.js + React)

Full-stack TODO app:
- Backend: Node.js + Express
- Frontend: React + Vite
- Database: TiDB Cloud Zero (MySQL wire protocol)

## 1. Create a TiDB Cloud Zero instance

Option A (recommended): use the helper script:

```bash
npm run zero:new
```

Option B: use cURL directly:

```bash
curl --request POST \
  --url https://zero.tidbapi.com/v1alpha1/instances \
  --header "Content-Type: application/json" \
  --data '{"tag":"todo-app"}'
```

Copy the returned MySQL connection string and set it as `DATABASE_URL`.

## 2. Configure environment variables

Backend:

```bash
cp server/.env.example server/.env
```

Then edit `server/.env` and replace `DATABASE_URL` with your TiDB Cloud Zero value.

Frontend:

```bash
cp client/.env.example client/.env
```

Default API base URL is already set to `http://localhost:4000`.

## 3. Install dependencies

```bash
npm install
```

## 4. Run the app

```bash
npm run dev
```

App URLs:
- React app: [http://localhost:5173](http://localhost:5173)
- Node API: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## API routes

- `GET /api/todos`
- `POST /api/todos` with JSON `{ "title": "Buy milk" }`
- `PATCH /api/todos/:id` with JSON `{ "completed": true }` or `{ "title": "New title" }`
- `DELETE /api/todos/:id`

## Notes for TiDB Cloud Zero

- TiDB Cloud Zero instances are ephemeral; each instance has an expiration time.
- This app creates the `todos` table automatically on backend startup.
- TLS is enabled by default for DB connections (`TIDB_ENABLE_SSL=true` unless explicitly set to `false`).




