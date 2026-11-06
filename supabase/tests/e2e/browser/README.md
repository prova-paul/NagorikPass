# Browser scenarios (test only)

Run with the Playwright MCP's `browser_run_code_unsafe` (`filename` set to a script here), in this order, on a freshly started stack:
`admin.js`, `desk.js`, `emp.js`, `staff.js`, then `sweep.js`. Screenshots go to `.playwright-mcp/` in the repository root. Paths are absolute to this machine.

```sh
node supabase/tests/e2e/stack.mjs &                  # real PostgreSQL, real RLS; HTTP layer is a stand-in (see stack.mjs)
cd frontend
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54399 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_e2e npx next build
npx next start -p 3100 &
node ../supabase/tests/e2e/api-security.mjs          # on its own fresh stack: it leaves data behind
```

After a run, rebuild with your normal settings (`npm run build`), because the build above is pointed at the stand-in. The passwords in these
files exist only in the stand-in's memory and the scratch database, which is recreated on each start.
