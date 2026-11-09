# PRD — Identity Wallet Portfolio Project

Version: 1.4 · Updated: 2026-11-09 · Status: F1–F7 implemented locally; F9 verified publicly at the owner's request; F8 and full release acceptance pending

## 1. Purpose

Build a small working identity-wallet web app as a portfolio project, available online through the existing VPS and a demo subdomain. Visitors can explore the core experience independently: receive a Verifiable Credential (VC), store it, and share it through a Verifiable Presentation (VP) that a verifier actually checks.

This is an independent project inspired by HCW, using fictional data and public open-source walt.id services. It showcases end-to-end product implementation, digital identity integration, and AI-assisted development through a usable app and documented technical decisions. Original HCW contributions are explained separately: MPC-related PoC work ending in May, enrollment for Backup & Recovery from late September, and QA bug fixes ahead of production release through November. The owner also has prior walt.id implementation experience.

**Simplicity direction (owner review, 2026-11-08):** one basic wallet page with small offer/consent panels; one Next.js app calling the three existing walt.id services; target one Compose project. Reuse the proved integration and working session code. Add no separate backend, database server, generic workflow/recovery framework, or new infrastructure milestone. The functional requirements below remain the demo contract.

**Priority:** a small, reliable VC/VP journey. **Optional later:** MPC and Backup & Recovery. **Deferred:** a presentation landing page that introduces the project and launches the demo.

## 2. Audience and success

Audience: portfolio visitors, including developers, potential collaborators, and anyone exploring the owner's work. The app must be understandable without a live presenter or prior knowledge of HCW, VC, or VP.

The MVP succeeds when:

- A first-time portfolio visitor can complete issue → accept → view → present → verify using only the app’s labels and guidance.
- Issuance and presentation use real walt.id operations; verification success comes from the actual verifier result.
- The complete walkthrough works three consecutive times from a reset state.
- Decline, cancellation, expired requests, and service failures produce understandable outcomes without false success or duplicate credentials.
- Project documentation clearly explains what the owner built, what walt.id provides, the key technical decisions, and how this independent project relates to the owner’s original HCW contributions.

These are release acceptance targets, not claims of results already achieved.

## 3. Product boundaries

| MVP — required | Later — optional | Deferred / excluded from MVP |
|---|---|---|
| Demo wallet entry | MPC with independently sourced open-source code | Presentation landing page |
| One VC offer and acceptance flow | Simple Backup & Recovery demonstration | Native mobile app |
| Credential list and detail | Selective disclosure if the selected format supports it | Real ID verification and government-card integration |
| One VP request and consent flow | QR/cross-device interaction | Messaging, delegation, advanced revocation infrastructure |
| Actual verification result | Additional credential scenarios | Full issuer/verifier admin portals |
| Safe scenario reset | | Production recovery infrastructure, client code or data |

Do not begin optional features until the MVP completion checks pass. Do not reconstruct HCW's services or original multilingual architecture.

## 4. Demo scenario and data

**Scenario:** Northstar Learning, a fictional issuer, offers Alex Morgan a Training Certificate. Alex stores it in the wallet. Harbor Works, a fictional verifier, requests evidence of the training. Alex approves sharing, and Harbor Works verifies the presentation.

Use one holder, one issuer, one verifier, and one credential type per demo session.

| Field | Fictional example |
|---|---|
| Holder name | Alex Morgan |
| Credential | Training Certificate |
| Course | Cloud Foundations |
| Completion date | 2026-10-15 |
| Issuer | Northstar Learning |
| Verifier | Harbor Works |

Generate issuance/expiry times consistently for each run so the default scenario remains valid. Use non-production signing keys. Never import client source, credentials, private keys, personal data, screenshots, or internal endpoints.

## 5. Main user journey

1. Open the demo and select **Start demo**.
2. Enter an isolated fictional wallet; see an empty-state explanation and **Receive sample credential**.
3. Create a real credential offer, review issuer and claims, then accept or decline.
4. After successful acceptance, see the credential in the wallet and open its details.
5. Select **Try verification** to create a request from the fictional verifier.
6. Review who is asking, the requested credential, and what will be shared; approve or cancel.
7. After approval, submit the presentation and show pending until a terminal verifier result arrives.
8. Show **Verified**, **Verification failed**, or a distinct service/timeout message.
9. Reset the session to repeat the walkthrough.

Same-browser actions/links are sufficient. A scanner or separate physical device is not required.

## 6. Minimum screens

Use one wallet page with these states and panels. Participant tabs distinguish Wallet (User), Issuer and Verifier; Wallet (User) is the default. Issuer controls can create the fixed sample offer and return the user to wallet review; Verifier controls prepare its request. These are views of the same isolated demo session. Offer/consent views are small dialogs or panels, credential details are inline, and the result is shown on the same page. These are not separate portals or required routes.

| View | Required content and actions |
|---|---|
| Demo entry | One-sentence wallet explanation, fictional-data label, Start demo |
| Wallet home | Credential list/empty state, Receive sample credential, Try verification, Reset demo |
| Offer review | Issuer, credential name, offered claims, Accept, Decline |
| Credential detail | Issuer, received claims, dates, available validity information |
| Presentation review | Verifier, purpose, requested credential, exact disclosure scope, Approve, Cancel |
| Verification result | Pending/verified/failed status, concise reason where available, return/retry action |

Keep issuer and verifier actions as scenario controls. No additional dashboards, analytics, or administrative navigation is needed. Place “independent demo” and “powered by walt.id” context unobtrusively in the app.

## 7. Functional requirements

| ID | Requirement | Acceptance condition |
|---|---|---|
| F1 | Start a demo session | Creates or resumes only that browser session's demo wallet; refresh does not silently create a second wallet |
| F2 | Create and review an offer | Uses the configured issuer and fixed fictional claims; issuer-service failure leaves the wallet unchanged |
| F3 | Accept or decline a VC | Accept stores a real issued credential once; decline stores none; repeated clicks cannot duplicate the operation |
| F4 | Display stored credentials | List/detail come from wallet state and remain consistent after refresh; pending issuance is not shown as received |
| F5 | Create a presentation request | Uses a real verifier session requesting the selected credential type; no matching credential gives a clear next step |
| F6 | Obtain consent | Shows what is shared; cancel submits no presentation; if the whole credential is shared, say so explicitly |
| F7 | Present and verify | Uses the appropriate holder proof for the chosen format; only an actual successful verifier result produces Verified |
| F8 | Handle non-success states | Pending, validation failure, request expiry, and service failure are distinguishable; bounded polling ends with a retryable status rather than endless loading |
| F9 | Reset the scenario | Clears/replaces only the current session's demo state, invalidates old UI operations, and returns to a repeatable start; cannot affect another session |

Do not add a custom credential-status/revocation service. Display only validity facts actually known; do not describe a credential as “not revoked” without a real status check.

## 8. Technical ownership and constraints

Our code owns UI, consent, visitor-session coordination, integration adapters, and result handling. walt.id owns credential/key storage and protocol/cryptographic mechanics. The MVP uses standard walt.id-managed keys; describe its custodial configuration accurately. Do not claim device-local secure custody or MPC recovery.

The selected stack, integration gate, credential-profile decision, storage boundaries, and deployment design live in the [system design](../arch/system-design.md). The existing 1.2.1 SD-JWT exchange is already proved; reuse it. Only that proved profile is supported by the MVP.

## 9. Reliability and usability

- Use service adapters and explicit operation states rather than placing protocol logic in UI components.
- Disable duplicate submissions. After ambiguous network failures, check the operation's state before retrying a potentially completed action.
- Tie results to the current presentation/session so stale responses cannot show success after reset or a new attempt.
- Keep application/service credentials server-side and signing keys out of browser code and logs. A session may access only its own wallet and results.
- Use readable loading/error/empty states, labeled controls, keyboard operation, and status text that does not depend on color.
- Support desktop and narrow-screen portfolio browsing. English only is sufficient for MVP.
- Explain credentials and sharing in plain language at the relevant step; visitors should not need an accompanying presentation.
- Favor stable behavior over animation, extra screens, or broad customization.

## 10. Verification and definition of done

Required checks:

1. Happy path with actual issuance and successful verification, repeated three times with reset between runs.
2. Declined offer creates no credential; double acceptance creates one credential.
3. Cancelled presentation sends no presentation and does not show Verified.
4. Missing matching credential blocks sharing; expired or invalid presentation request does not show success.
5. Issuer/wallet/verifier unavailability has bounded waiting and a usable error/retry path.
6. Refresh preserves the current wallet; reset prevents stale async updates from restoring old UI state.
7. Two sessions cannot read/reset each other's wallet or verification result.

Reuse the automated real exchange and important state/ownership checks. Add only focused coverage for newly implemented behavior; use a short manual walkthrough for layout and keyboard behavior. Avoid a large test suite that mirrors trivial UI details.

MVP is done when these checks pass, the source includes reproducible setup with pinned dependencies, and a short README explains the scenario, custody model, limitations, and actual Codex-assisted build time. A presentation landing page is not a completion requirement.

## 11. Delivery references

The [feature guides](features/README.md) refine F1–F9 into traceable acceptance criteria without changing product scope. [Shared acceptance criteria](acceptance.md) map release-wide checks to this PRD; the [acceptance results ledger](../workitem/acceptance-results.md) records verification evidence. Complete wallet acceptance remains unverified; consult the ledger for current blockers.

The [demo plan](../plan/demo-plan.md) owns delivery stages, optional features, and the deferred portfolio landing page. The [implementation checklist](../workitem/implementation.md) tracks implementation and validation evidence. This PRD owns product requirements and acceptance criteria.

## References

- [Documentation index](../README.md) — reading order and document responsibilities.
- [HCW project brief](../../research/hcw-project-brief.md) — private background research; exclude from public artifacts.
- [walt.id Community Stack](https://docs.walt.id/community-stack/home) and [source repository](https://github.com/walt-id/waltid-identity) — upstream references to validate against the selected release during the integration proof.
