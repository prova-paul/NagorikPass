# NagorikPass Frontend

React, TypeScript, Vite, Tailwind CSS and React Router. It talks to the API in `../backend`, which must be running. See `../backend/README.md`.

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev        # development server at http://localhost:5173
npm run build      # type-check and production build
npm run typecheck  # check types only
npm run lint       # run ESLint
npm run preview    # serve the production build
```

Requests to `/api` are proxied to `http://localhost:4000`. Set `VITE_API_PROXY_TARGET` in `.env.local` to change that.
In production, serve the built files and the API from the same origin.

Design tokens live in `src/index.css`.
