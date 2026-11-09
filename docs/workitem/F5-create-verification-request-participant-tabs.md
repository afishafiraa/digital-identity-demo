# F5-create-verification-request — Participant tabs

Date: 2026-11-09. Owner-requested interface refinement to make Issuer, Wallet (User) and Verifier responsibilities visible on the existing page. Product implementation remains F1–F5; F6–F9 remain pending.

## Interface

Wallet (User) is the default tab and explicitly identifies Alex Morgan as the credential holder. Offer review, Accept/Decline and stored credentials belong here. The user can still request the sample credential from the wallet.

Issuer identifies Northstar Learning, the training provider, and explains the Training Certificate and recipient. Create sample offer reuses the existing offer operation and opens Wallet (User) for review. It does not accept a credential on the user's behalf.

Verifier identifies Harbor Works, explains its evidence request and contains Try verification. Missing-credential guidance links back to Wallet (User). No presentation or approval was added.

Tabs keep their panels mounted so switching views preserves an offer, in-flight operation, expanded card or prepared request. Selecting a tab itself dispatches no mutation. Only the selected panel is visible and available to keyboard navigation. The tablist has selected-state semantics, roving focus, Left/Right arrows and Home/End navigation. Each tab names the participant as well as the role. Desktop and narrow layouts reuse the existing green palette and card styling.

Source: `src/components/stored-credentials.tsx`, `src/components/credential-offer.tsx`, `src/components/verification-request.tsx`, `src/components/demo-session.tsx`, `src/app/globals.css`. The existing offer state was moved into a local hook so issuer creation and wallet review share one operation.

## Verification

`npm run check` passed: environment validation, type-aware lint, 49 backend tests, strict typecheck, production build and private-artifact scan.

The initial browser run reached the normal 100-session capacity in accumulated host test metadata. It was stopped and rerun against `.local/participant-tabs-qa-20261109`, preserving existing data and leaving limits/configuration unchanged. This is an isolated QA dataset, not a cleanup/reset implementation. Commands:

```sh
DEMO_DATA_DIR=.local/participant-tabs-qa-20261109 npm run dev
DEMO_DATA_DIR=.local/participant-tabs-qa-20261109 npm run test:e2e
```

The F2 holder-name assertion was scoped to the offer review region because Alex Morgan now also appears in the Wallet (User) tab. Its required offer-claims assertion remains intact. Existing F5 browser checks now navigate to Verifier explicitly, verify the default Wallet tab, exercise keyboard tab switching and create a real offer from Issuer before accepting it in Wallet.

Results: the isolated full browser run passed 14/15 checks; its one failure was the pre-existing globally scoped offer-claims selector matching new participant labels. After scoping the holder/course assertions to the offer review region, the focused F2 review rerun passed 1/1. All 15 checks therefore have passing results across the regression run and focused rerun. Final lint and strict typecheck were rerun for the adjusted selectors. No acceptance assertion, compiler setting or resource limit was weakened.

Visual inspection covered 1280 × 720 desktop Wallet and Issuer captures and the 390 × 844 Verifier capture. Role names and participant identities remain readable; the narrow page has no horizontal overflow. The existing F5 real journey passed default-tab, arrow-key/Home navigation, issuer creation → wallet review/acceptance, request preparation, refresh, expiry and session-isolation checks. Existing F1–F4 checks cover wallet receipt, refresh, native details, failures and keyboard return.

Private screenshots: `.local/evidence/F5-role-tabs-{wallet,issuer}-desktop.png` and `.local/evidence/F5-create-verification-request-{desktop,mobile}.png`.

SHA-256 source fingerprints:

- `src/components/stored-credentials.tsx`: `35d58514fe22dc9840fbda75cc7a0e36696431ee4cd36a8965bfbea80a0f29de`
- `src/components/credential-offer.tsx`: `6ea42cd2950beeb98d1bdca27e389ba3f98ef5886d689d0e42e42a535c221a2c`
- `src/components/verification-request.tsx`: `b99186d3682a0d9f9d4a26857532a24d78a18a8d094257b21a03addd9dc7d587`
- `src/components/demo-session.tsx`: `94f45119bcec8c60ce7641876b838d19ea4a4bd356551c30fa514c8bdca5c5b1`
- `src/app/globals.css`: `39caa17a790ca2b8b40157ae4d91075374693ee81678c5405989d66fe49b0ae6`

The normal app container was rebuilt and restored with existing volumes, using image `sha256:9b646e2f462fa768d9bd37ac7fc03a2417d6c44e26b1ea6ba0811820cd995cf6`. Host QA dev was stopped. No Compose or VPS configuration changed.
