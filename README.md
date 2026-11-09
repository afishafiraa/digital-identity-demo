# Identity Wallet

An independent wallet demo using fictional data and walt.id Community Stack services.

**Revised direction:** one basic wallet page, small receive/share panels, and a thin Next.js server calling walt.id. Target four containers in one Compose project. Reuse the working foundation and add no extra infrastructure or generic recovery framework; see the [smaller plan](docs/plan/demo-plan.md). The four services now run together in the root Compose project.

**Current status: F1–F7 complete locally; F9 reset verified on the public demo.** Start demo creates an isolated real wallet; refresh resumes it; expiry is explicit; interrupted provisioning is reconciled without blindly creating another wallet. **Receive sample credential** creates a real offer and opens a review panel; Accept stores a real credential once, and Decline receives none. Stored credentials appear as cards with inline claims and dates. The page opens on **Wallet (User)**, with **Issuer** and **Verifier** tabs identifying each participant. Read-only participant profiles show wallet/key references, public credential identities and how the exchange connects them. In Verifier, **Try verification** prepares an owned real Harbor Works request without sending a presentation. **Review sharing in Wallet** shows the whole credential and records request-specific Approve/Cancel decisions; no presentation is sent by this step. **Send presentation** submits only the approved credential and shows the real verifier outcome, with safe result checks after uncertainty. **Reset demo** retires only your current session and starts a repeatable empty scenario without rebuilding Docker. Old server-side demo data is retained. **F8 and the full shared release gate remain pending**. No VPS changes have been made.

Try **https://digital-identity-demo.vercel.app**. For today’s presentation, the Docker backend and temporary tunnel on the owner’s computer must remain running; see [deployment and restart notes](docs/plan/vercel-demo.md). Local development uses **http://localhost:47831**. See [local setup](docs/plan/local-development.md) and [F4 evidence](docs/workitem/F4-list-and-inspect-stored-credentials-verification.md).

```sh
npm ci
cp .env.example .env.local
chmod 600 .env.local
npm run walt:setup
npm run walt:up
npm run proof:integration
npm run check
npm run dev
```

Use Node.js 22.23.2. Service startup must finish before the proof. The [container alternative](docs/plan/local-development.md) runs the app and services locally with persistent volumes.

Verified: **61 backend tests**, strict lint/type checks and the Vercel production build passed. Both focused F9 browser checks passed against the public demo, including real verified exchanges before/after reset, visitor isolation, late results and uncertain reset replies. Earlier F1–F7 verification remains recorded in the feature evidence; full shared acceptance is still pending.

## Reading order

1. [PRD](docs/spec/prd.md) — product scope and acceptance criteria.
2. [Feature guides](docs/spec/features/README.md) and [shared criteria](docs/spec/acceptance.md) — behavior boundaries and verification contract.
3. [System design](docs/arch/system-design.md) and [TypeScript rules](docs/arch/typescript-standards.md) — technical decisions and code standards.
4. [Demo plan](docs/plan/demo-plan.md) — delivery stages and deferred work.
5. [Implementation checklist](docs/workitem/implementation.md) and [acceptance ledger](docs/workitem/acceptance-results.md) — progress and evidence.

Our code owns UI, consent, coordination, adapters and result handling. walt.id owns credentials, signing keys and protocol/cryptographic mechanics. This is a custodial demo using fictional claims and locally generated keys. The implemented wallet feature has no visitor signup or issuer/verifier portals.

`research/` remains private background material and is excluded from runtime/public artifacts. No client source or data is used. Online deployment, public route controls, cleanup/quotas and the remaining complete-journey checks are still pending. MPC, product Backup & Recovery and the portfolio landing page remain deferred. A complete historical Codex-assisted build duration was not measured and is not claimed.
