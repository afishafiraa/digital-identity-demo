# F1-start-and-resume-demo-session — Localhost origin mismatch

Date: 2026-11-08. Status: Fixed and verified locally. Affected baseline: F1/F2 local app, Next 16.4.5, walt.id 1.2.1.

## Reproduction

Open `http://localhost:3000` while `APP_ORIGIN` is configured as `http://127.0.0.1:3000`, then select Start demo.

Expected: The requested local browser address supports wallet setup. Actual: exact-origin protection rejects the session POST with 403; the UI shows Retry wallet setup. App and wallet service health remain normal.

## Fix

Use `http://localhost:3000` as the development default and in `.env.example`, private `.env.local`, Compose app origin, browser test configuration and local instructions. Host development/start commands bind to localhost. Keep Docker port publication on loopback and retain internal numeric service/health URLs. Origin protection still checks one configured origin exactly; no alias allowlist or bypass was added. Existing data volumes are preserved.

## Verification

`npm run check` passed: environment, strict lint/types, 35 backend tests, production build and private-artifact scan. Rebuilt/recreated only the app container. A real Chromium walkthrough at localhost completed Start demo → Wallet connected → Receive sample credential → actual Northstar Learning offer; refresh preserved the offer reference. A mutation with the old numeric Origin header returned 403. The seven-test browser suite's earlier F2 run remains historical evidence; this follow-up used a focused browser smoke check against Docker rather than claiming a full rerun.

Use **http://localhost:3000** from now on. Cookies for the former numeric address are separate; localhost starts or resumes its own session. No wallets or credentials were deleted.
