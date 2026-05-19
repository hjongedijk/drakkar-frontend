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

Current frontend version: `0.1.1`

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

## Authentication

The frontend talks to the backend with:

- session login for users
- backend API token validation for app-to-app traffic

Initial local admin account:

- username: `admin`
- password: `password1234`

The login form does not prefill credentials anymore. Enter them manually and change the password after first login.

## Notes

- Theme toggle supports dark and light mode
- API base URL can be overridden at runtime when frontend and backend are hosted separately
- Mobile layout is responsive, but depends on modern browser support

