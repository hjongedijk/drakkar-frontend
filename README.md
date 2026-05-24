# Drakkar Frontend

React + Vite frontend for Drakkar.

The frontend provides:

- login/auth flow
- dashboard
- monitored library
- downloads and history
- health page
- release calendar
- watch page
- settings and user management

## Version

Current frontend version: `0.1.7`

## Development

```bash
npm install
npm run lint
npm run build
npm run dev
```

The dev server binds on all interfaces by default.

## Docker

Build locally:

```bash
docker build -t drakkar-frontend:latest .
```

Published image:

```txt
ghcr.io/hjongedijk/drakkar-frontend:latest
```

Public deployment compose is shipped with the backend repo, because the release stack includes:

- frontend
- backend
- postgres
- valkey
- optional seerr/debug services

## Authentication

The frontend talks to the backend with:

- session login for users
- backend API token validation for app-to-app traffic

There is no fixed default admin account anymore.
On first boot the setup wizard opens before login and creates the first admin.

## Notes

- Theme toggle supports dark and light mode
- API base URL can be overridden at runtime when frontend and backend are hosted separately
- Mobile layout is responsive, but depends on modern browser support
