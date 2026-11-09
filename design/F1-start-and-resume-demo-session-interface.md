# F1-start-and-resume-demo-session — Interface design

F1 uses one responsive app shell: project identity/header, entry or connected-wallet panel, a fixed four-step journey explanation, and a concise custody/fictional-data footer. It adds no issuer/verifier navigation or portfolio landing page.

Tokens live in `src/app/globals.css`: warm paper, dark green ink, one green accent, system body typography and a serif display heading. The live status has visible text; green marks a connected wallet and amber marks work requiring attention. Controls have explicit focus outlines, the app has a skip link and status updates use a polite live region. Disabled receive controls identify the next capability without pretending it is implemented.

Desktop 1280px and narrow 390px screenshots were reviewed under `.local/evidence/`. The browser checks cover keyboard start, refresh/resume, focus and narrow-screen overflow. The images are local verification artifacts, not assets copied from client work.
