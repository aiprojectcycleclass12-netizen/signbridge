# SignBridge

Real-Time Sign Language Interpreter & Learning Companion — static web app (PWA-ready).

This repository contains a single-page static web app that uses MediaPipe Hands to detect hand landmarks and a simple heuristic classifier to demo ASL-like signs. The project has been updated to be installable as a Progressive Web App (PWA).

## Quick start (no build tools)

1. Clone the repo:

   ```bash
   git clone https://github.com/aiprojectcycleclass12-netizen/signbridge.git
   cd signbridge
   ```

2. Run a local static server (required for webcam access; file:// won't work):

   - Option A (recommended, no install):
     ```bash
     npx http-server -p 8080
     # then open http://localhost:8080
     ```

   - Option B (npm script):
     ```bash
     npm install
     npm run dev
     # opens at http://localhost:8080
     ```

   - Option C (serve):
     ```bash
     npm install -g serve
     serve -s . -l 8080
     ```

3. Open the site in Chrome/Edge/Firefox at http://localhost:8080 and allow camera access.

## Install as PWA

- When opened in a supported browser (Chrome/Edge on desktop or Android), you should see an "Install" option in the address bar or in the browser menu. Install will add SignBridge to your device and run it like a native app.
- The app uses a simple service worker to cache core assets so the shell can load offline.

## Notes & privacy

- MediaPipe and browser APIs require a secure context (HTTPS) or `localhost` to access camera and microphone.
- The sign classifier is a heuristic demo — not production-grade. For better accuracy use a trained model.
- This static version does not send camera frames anywhere; all processing is done client-side in the browser.

## Deployment

- GitHub Pages: enable Pages in repo settings and choose `main` branch / root.
- Or deploy to Netlify / Vercel as a static site by connecting this repository.

## License

MIT
