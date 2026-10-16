# SignBridge

Real-Time Sign Language Interpreter & Learning Companion — static web app.

This repository contains a single-page static web app that uses MediaPipe Hands to detect hand landmarks and a simple heuristic classifier to demo ASL-like signs. It's intended for local testing and static hosting.

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

## Notes

- MediaPipe and browser APIs require a secure context (HTTPS) or `localhost` to access camera and microphone.
- The current sign classifier is a small heuristic for demo purposes only — not a production-grade model.
- This static version does not send any camera frames to a server; all processing is client-side.

## Deployment

- GitHub Pages: enable Pages in repo settings and choose `main` branch / root.
- Or deploy to Netlify / Vercel as a static site by connecting this repository.

## License

MIT — see LICENSE file.
