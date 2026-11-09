# F5-create-verification-request — Participant identity profiles

Date: 2026-11-09. Owner-requested profile/education refinement to the existing participant tabs. Scope remains the implemented F1–F5 flow; no holder DID generation, verifier signing setup, consent, presentation or reset was added.

## Identity model and interface

Wallet (User) names Alex Morgan and shows the owning wallet ID, Wallet2 key IDs/types, server-side custody and, after receiving a credential, its holder public JWK and SHA-256 RFC 7638 thumbprint. A wallet ID identifies a storage container, not a DID or authorization token. No holder DID is configured: the existing allocation uses no DID store and the supported SD-JWT binds to the holder public key through `cnf.jwk`. Before first acceptance, the key list is empty; the UI says the key is generated on acceptance. No new key mutation was introduced.

Issuer identifies Northstar Learning, the `did:jwk` found in the owning wallet's received credential, its decoded public JWK, the ES256/P-256 signing role and the `urn:diw:training:1` credential type. Until acceptance, live issuer identity is explicitly unavailable from a stored credential. It does not read private issuer configuration or synthesize a DID. The UI distinguishes public-key signature checks from real-world issuer trust/accreditation.

Verifier explains the proved request mode: a request-specific `redirect_uri` client identifier and unsigned, unencrypted requests/responses. This flow uses no verifier DID or request-signing key. The profile displays a labeled identifier pattern, not a live response URL, nonce or request token. Verifier verification uses the issuer public key and holder public key; each request also supplies audience/nonce and credential query/policies. This does not imply that other verifier modes cannot use signing keys or certificates.

An expandable communication explanation covers OID4VCI offer/issuance and holder binding, OID4VP/DCQL request creation, and the future consent/presentation/verification step. The last step is explicitly upcoming. It also distinguishes session-cookie authorization from credential cryptography. Public JWK details are expandable; private keys remain server-side.

The existing pinned local upstream Wallet2 route source was consulted for wallet-info and key-metadata contracts. The OpenID4VP [client identifier rules](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html) confirm that `redirect_uri` identifies the response/redirect URI and that requests in this mode cannot be signed. Existing [integration evidence](../../pocs/README.md) owns the actual SD-JWT/issuer/holder proof baseline.

## Read-only boundary

`GET /api/profile` accepts only the visitor cookie with no query selectors. It verifies the ready binding, inspects the same wallet's live no-DID configuration, reads key metadata and the supported stored training credential, and checks ownership again after the upstream reads. All calls use the existing bounded transport and a shared 12-second deadline. The client has a 15-second deadline and explicit loading/unavailable/retry states. A confirmed acceptance refreshes this profile alongside the credential list.

The response whitelists wallet ID, key ID/type, credential ID, issuer DID, public EC/P-256 JWK coordinates and holder thumbprint. It includes no session tokens, private JWK fields, issuer configuration, signed credentials, disclosure strings, holder-key bindings, store IDs or raw service objects. Private `d` values are rejected; encoded issuer DIDs must contain only the expected public members. No key-export endpoint is called. Errors cannot masquerade as an empty profile. Responses are private/no-store. This is public identity display, not cryptographic validation or proof of legal identity.

Source: `src/lib/profile.ts`, `src/server/core/profile-handler.ts`, `src/app/api/profile/route.ts`, `src/components/identity-profile.tsx`, the existing wallet tabs and server entry point. Focused security/ownership tests: `test/profile.test.ts`; real-service checks extend `e2e/F5-create-verification-request.spec.ts`.

## Verification evidence

Environment: Node 22.23.2, pinned Next 16.4.5 / React 19.3.1, Playwright 1.65.0 Chromium, real local pinned walt.id 1.2.1 services and existing fictional configuration. Host browser origin `http://localhost:3000`; isolated metadata directory `.local/identity-profile-qa-20261109` avoids accumulated host-session capacity without changing limits or existing data.

- `npm run check`: passed environment validation, type-aware lint, **52/52 backend tests**, strict typecheck, production build and private-artifact scan. An initial compiler narrowing error was corrected before the successful full rerun.
- `DEMO_DATA_DIR=.local/identity-profile-qa-20261109 npm run test:e2e -- e2e/F5-create-verification-request.spec.ts`: **2/2 passed**. A real empty wallet had no keys. After real acceptance, profile metadata matched `/wallet/{own-id}/keys`, the credential holder public key was P-256, and its RFC 7638 thumbprint matched an actual wallet key ID. Issuer `did:jwk`/public JWK became visible, and Verifier explicitly showed no DID. Existing request/no-presentation checks still passed.
- Focused controlled backend checks cover separate visitors, anonymous/foreign-selector rejection, live ownership expiry during reads, malformed key metadata, private holder JWK rejection, a private key encoded in an issuer DID, unavailable services and exclusion of signed credentials/internal bindings/private metadata. These are controlled contract/failure tests, not simulated cryptographic proof.

Visual inspection: full-page desktop 1280 × 720 wallet and issuer captures and 390 × 844 narrow verifier capture showed readable wrapping for long wallet/key/DID values, collapsible public JWK data and no horizontal overflow. The communication explanation opens using native details. Private screenshots remain under `.local/evidence/`: `F5-role-tabs-wallet-desktop.png`, `F5-identity-profile-issuer.png`, `F5-create-verification-request-{desktop,mobile}.png`.

SHA-256 source fingerprints:

- `src/lib/profile.ts`: `1596472a92338b5061f46f9090ed03e1610d969996c9dcc8b1404e5174361886`
- `src/server/core/profile-handler.ts`: `42eb4d5afd98e8444446d48c15b0c8c02f37a1bf9c7d782f1f12c417de90bc44`
- `src/components/identity-profile.tsx`: `86fced5f9a6d4c910d3a35b87925b6be4604007fb6a71cf7486038a3ca09f419`
- `src/components/stored-credentials.tsx`: `2884a9f58065e0f2df85f7e1a3b9e4031d88f44d8ecfdfd420fa0ba4aebb025e`

The complete isolated browser regression command `DEMO_DATA_DIR=.local/identity-profile-qa-20261109 npm run test:e2e` passed **15/15 checks**, including F1–F4 offer/receipt/refresh/failure/isolation regressions. Full release-wide acceptance and F6–F9 remain pending.

The normal app container was rebuilt and restored with existing volumes. Image: `sha256:9241b449fcbe0abc880354ab09d9fa3594d39db26a6fe1e31fccf0b1d587721c`. Host QA dev was stopped. No Compose/VPS configuration or signing material was changed.

A smoke check inside the rebuilt container passed the real offer/acceptance/request flow and profile assertions: issuer `did:jwk`, P-256 holder public key, holder thumbprint matching a wallet key ID, and no private `d` member in either public JWK. Credential records remained unchanged by request/profile reads.
