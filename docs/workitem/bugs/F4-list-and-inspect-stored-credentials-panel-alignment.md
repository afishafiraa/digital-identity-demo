# F4-list-and-inspect-stored-credentials — Panel alignment and wallet interface

Date: 2026-11-08. Status: fixed and verified locally. Affects the existing F1–F4 page; no later feature was implemented.

## Observed defect

Opening a credential made the static journey panel move down the page. The original two-column layout centered `.journey` against the full height of the growing wallet column. The poster-sized heading, muted controls and minimal card feedback also made the page feel static.

Reproduce on the earlier F4 UI: start a wallet, accept a credential, then expand its details. The right panel changes vertical position as the left column becomes taller. Expected: both columns remain anchored at the top; expanding a credential changes only its own content flow.

## Change

The wallet and guide now use a top-aligned workspace grid with independently sized sections. The page has a compact wallet heading, stronger green/lime credential surfaces, a CSS wallet illustration, visible action states, native card disclosure with changing View/Close labels and a rotating arrow, confirmation notices, and hover/focus/press feedback. Cards remain native keyboard-operable details elements. Reduced-motion preferences disable animation and transitions. Mobile stacks the guide below the wallet.

Receive/accept/decline/read calls and session ownership are unchanged. Later sharing and verification are clearly labeled Coming next. The F4 browser test now scopes its holder assertion to the detail document because the actual holder is also displayed on the card face.

## Verification

Environment: pinned Node 22.23.2 / Next 16.4.5 / React 19.3.1 / Playwright 1.65.0 Chromium and real local walt.id 1.2.1 services. Checked with `npm run check` and `npm run test:e2e`: environment validation, strict lint/typecheck, **45 backend tests**, production build, artifact inspection and **13 browser tests** passed. No rule/configuration bypass was introduced.

Focused visual check: `node .local/review-wallet-ui.mjs` against the host app, using a fresh real wallet and credential. Measured document coordinates of the wallet/guide before and after keyboard expansion: both remained aligned and unchanged within one pixel. Enter opened and closed details and changed the disclosure label. No horizontal overflow at 320, 390 or 768 pixels. Desktop inspected at 1280 × 900; narrow viewport inspected at 390 × 844. Reduced-motion captures show final readable content without capturing transitional opacity. No new permanent test suite was added for styling.

Private captures: `.local/evidence/F4-wallet-interface-redesign-{entry,desktop,mobile}.png`. Visual review confirmed readable claims/dates and separated guide/workspace surfaces. Full shared release acceptance remains pending; these are scoped UI checks.

Checked source SHA-256:

- `src/app/page.tsx`: `8777549e866009f828a4ebc648f5affeb75826c39875c42dd16ca7ed79b1a837`
- `src/app/globals.css`: `ffa3e139563beec302630a3125037baaf2e6ded421f68e7d6d0342a5eb68ca0c`
- `src/components/demo-session.tsx`: `ab9bcad4e59c7dd57e775a8e388cfb0f27bd4b274eebf4b61a4b97b81b701c7c`
- `src/components/stored-credentials.tsx`: `0e534c15d2bba8c5a5b61fef9012d539519b4eeb32a43b02ef86941e2493f858`
- `src/components/credential-offer.tsx`: `b7f2edca4527b3a955bc6c376de8bce91c30ad09ca245fd5751e80e36d5f0e6e`

Container follow-up: rebuilt/recreated only the local app, preserving volumes. Image `sha256:fff15bad5aa8b59e37cb18af190fbd06f37df49c7f269049a6f3c43b84ace1f7`. The same focused browser check passed against the rebuilt localhost container; app health passed. No VPS, service configuration or service data was changed beyond isolated fictional verification fixtures.
