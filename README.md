<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c456c147-46b9-4e54-85ab-b4d0cb0f170c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Tests

- `npm run lint` - type-check
- `npm test` - unit tests (scoring, outline, standing…)
- `npm run test:rules` - Firestore security rules against the local emulator (fake data only; needs the Firebase CLI and Java)

## Deploying

Deploys are automatic: **every merge to `main` runs all tests, then deploys hosting and Firestore rules** (`.github/workflows/ci.yml`). Pull requests run the same tests without deploying. Don't deploy by hand from a local checkout - that's how stale code reached the live site before.

One-time setup (a project owner):

1. Google Cloud console → project `gen-lang-client-0559782052` → IAM & Admin → Service Accounts → **Create service account** (e.g. `github-deploy`).
2. Grant it **Firebase Hosting Admin** and **Firebase Rules Admin**.
3. Service account → Keys → **Add key → JSON**, download it.
4. GitHub repo → Settings → Secrets and variables → Actions → **New repository secret** named `FIREBASE_SERVICE_ACCOUNT`, paste the whole JSON file, save. Then delete the downloaded file.

Until the secret exists, the deploy step is skipped with a warning (tests still run).
