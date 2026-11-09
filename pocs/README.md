# Integration proof

The gate passed locally on 2026-11-08 using walt.id Community Stack **1.2.1**, upstream commit `cf3c836cc78a9e64b2fd87933527327972e014da`.

This is prerequisite compatibility evidence. F1–F4 are implemented locally; see the [acceptance ledger](../docs/workitem/acceptance-results.md). CLI presentation fixtures do not enable F5–F9 in the app.

## Reproduce

From the project root with Node.js 22.23.2 and Docker available:

```sh
npm ci
npm run walt:setup
npm run walt:up
npm run proof:integration
```

Allow the three services to finish startup before the proof. A successful run prints one PASS line and writes a private, timestamped evidence record to `.local/evidence/integration.json`. It creates a fictional wallet and credential; reruns create new isolated proof fixtures rather than resetting another wallet. Setup preserves existing local signing material.

## Proved profile

| Decision | Observed configuration/result |
|---|---|
| Credential | Northstar Learning Training Certificate for Alex Morgan; Cloud Foundations; completion 2026-10-15 |
| Format | Holder-bound `dc+sd-jwt`; VCT `urn:diw:training:1` |
| Exchange | OID4VCI 1.0 and OID4VP 1.0 service generation |
| Signing | ES256; local issuer `did:jwk`; walt.id-managed holder P-256 key |
| Disclosure | Whole configured credential; optional selective disclosure is not implemented |
| Presentation | Protocol `cross_device` request descriptor, submitted by Wallet API; no physical scanner/device required |
| Verdict | Verifier `SUCCESSFUL` and `policy_results.overallSuccess = true` |
| Checks observed | Issuer signature; presentation audience, nonce, key-binding signature, SD hash, key-binding issue time, expiry/not-before and transaction-data hash checks |
| Trust model | Fictional locally generated issuer; no external trust registry or custom revocation service |

## Pinned service images

The exact images are committed in [local service Compose](../infra/walt.compose.yaml):

| Service | Image digest |
|---|---|
| Issuer2 | `sha256:9cb23f2cd34bf73eddcd4b3715553bdb39fc1d1009f77ff11c92082eae41fd83` |
| Wallet2 | `sha256:7937cfe2450e5521e272615179baef66f805459df391f2321b2f20ad92468614` |
| Verifier2 | `sha256:acd56d414b95c9b47558845060cb34cf138fa6fdae3aeff7e0ac1f1e53c25624` |

All use version tag `1.2.1` together with the digest. The app's resolved Node base image during verification was `sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9` (`22.23.2-bookworm-slim`). App packages and transitive integrity records are in the real package lockfile.

## Endpoints exercised

| Service | Operations |
|---|---|
| Wallet2 | `POST /wallet`, `GET /wallet`, `GET /wallet/{id}`, named-store list/create under `/stores/keys` and `/stores/credentials` |
| Holder fixture | `POST /wallet/{id}/keys/generate`, `POST /wallet/{id}/credentials/receive`, `GET /wallet/{id}/credentials`, `POST /wallet/{id}/credentials/present` |
| Issuer2 | `POST /issuer2/credential-offers`; Wallet2 resolves the offer and OID4VCI endpoints |
| Verifier2 | `POST /verification-session/create`, `GET /verification-session/{id}/info`; Wallet2 resolves and responds to the request |

Browser requests use only the Next.js routes. Service ports 7004–7006 are loopback-only for local development. Docker-internal origins are `issuer:7005`, `wallet:7006` and `verifier:7004`; protocol URLs resolve within that network. These are local settings, not the future public origin/routing map.

## Storage and exposure

Wallet descriptors, named stores, holder keys and credentials use SQLite at `/waltid-wallet-api2/data/wallet2.db`, persisted in `diw-walt_wallet-data`. Actual wallet restart preserved credentials and bindings. App metadata uses a separate SQLite file and, in container mode, the `diw-local_coordination` volume.

Generated issuer keys/configuration are private files under `.local/walt-config/`, mounted read-only. Issuer/verifier exchange state uses their current in-memory configuration; outstanding exchanges must be treated as lost/expired on service restart. This does not affect F1 wallet resume. Persisting or recovering those request states is not claimed.

Local management APIs run without walt.id user authentication and are reachable only through loopback or the dedicated Docker network. The app enforces visitor ownership and accepts no wallet IDs from visitors. Before online deployment, keep management routes off the public interface and prepare the protocol-only exposure map. Private configuration, evidence and research are excluded from image contexts and standalone artifacts.

## Sources

Configuration was checked against the [pinned upstream source](https://github.com/walt-id/waltid-identity/tree/cf3c836cc78a9e64b2fd87933527327972e014da), its Wallet2 route handler and persistence implementation, and the [official v2 tutorial](https://docs.walt.id/community-stack/home/tutorial-30-min-v2). The repository's generated local keys and fictional payloads replace the upstream demo signing material.
