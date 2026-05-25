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

Current frontend version: `0.3.1`

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

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-change`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push the branch: `git push origin feature/my-change`
5. Open a Pull Request

Please keep contributions focused and describe clearly what your change improves.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute it, provided the license terms are respected.

## Disclaimer

This project is provided as-is without warranty of any kind.

The author(s) are not responsible for any damage, data loss, misconfiguration, or security issues resulting from the use of this repository, its scripts, containers, or deployment examples.

By using this repository, you agree that you run it at your own risk and that you are responsible for reviewing changes before execution.

Drakkar does not ship with movies, shows, subtitles, or indexer content. Do not use this project to infringe copyright, pirate media, or violate the laws and service terms that apply in your country or to the systems you connect.
