# Deploy to Vercel — quick guide

This project has a Vercel-ready configuration (see `vercel.json` and `api/index.js`). Use this guide to deploy the app from the Vercel dashboard or CLI and to configure required environment variables and common gotchas (MongoDB/Atlas, JWT secret, email credentials).

## Summary
- The Express + EJS app is exported as a single serverless function at `api/index.js` (powered by `serverless-http`).
- `vercel.json` rewrites requests to the function so server-side rendering works.
- `utils/db.js` implements a serverless-friendly Mongoose connect cache to avoid connection storms.

## Pre-deploy checklist
1. Push your repository to GitHub/GitLab/Bitbucket and confirm the repo is visible to Vercel.
2. Make sure `api/index.js`, `vercel.json`, and `package.json` are present in the repository root.
3. Ensure `package.json` contains `serverless-http` (already added).
4. If you have static assets, place them in a `public/` folder (or remove the `public/**` build entry in `vercel.json`).

## Environment variables (required)
Set these in Vercel Dashboard → Project → Settings → Environment Variables (add them for `Preview` and `Production` as needed):

- `MONGODB_URI` — MongoDB connection string (Atlas SRV recommended). Example:
  `mongodb+srv://DBUSER:DBPASS@cluster0.abcd.mongodb.net/yourdbname?retryWrites=true&w=majority`
  - Create a dedicated DB user with a strong password and appropriate DB permissions.
  - If you use Atlas, consider VPC peering for production; otherwise you may need to allow the Vercel IPs (see note below).

- `JWT_SECRET` — secret used to sign JWT tokens. Use a long random string.

- (Optional) Email / SMTP variables used by `nodemailer` if you send emails (e.g. password resets):
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — configure according to your provider.

If you prefer to avoid exposing secrets in the dashboard you can use the Vercel CLI to add them as environment variables or secrets:

```powershell
vercel login
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
# or use vercel secrets
vercel secrets add mongodb-uri "mongodb+srv://..."
```

In `vercel.json` we included placeholders like `"@mongodb_uri"` — set the corresponding Vercel Environment Variable or Secret and ensure the name matches.

## Atlas / IP whitelist gotcha
- Vercel functions run from dynamic IP ranges. If your Atlas cluster requires IP whitelisting, you have two options:
  1. Allow access from anywhere (0.0.0.0/0) and secure via DB credentials (recommended for simplicity on small projects).
  2. Use VPC peering / private link (recommended for production, may require paid plans on Vercel/Atlas).

If you see `Authentication failed` or connection timeouts on Vercel, check the Atlas network access rules and your connection string.

## Cookie / domain notes
- This app stores an httpOnly JWT cookie (`token`). On Vercel your domain will be something like `your-app.vercel.app`. The cookie is set without a domain override, so it will work on the default domain. If you use a custom domain, verify cookie behavior (especially `secure` and `sameSite`) if you change protocol or domain.

## Deploy steps (Dashboard)
1. Go to https://vercel.com and create/import a new project. Point it to your repo.
2. During import, Vercel will detect `vercel.json` and configure builds. If prompted, accept defaults.
3. In Project → Settings → Environment Variables add `MONGODB_URI`, `JWT_SECRET`, and any SMTP vars.
4. Click Deploy. Watch the build logs — the function `api/index.js` will be built and served.

## Deploy steps (CLI)
1. Install Vercel CLI (if not installed):
```powershell
npm i -g vercel
```
2. Login and link the project:
```powershell
vercel login
vercel --prod
```
3. Add environment variables via CLI if desired:
```powershell
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
```

## Local testing with Vercel dev
- You can emulate Vercel serverless locally:
```powershell
npm install
npx vercel dev
# open http://localhost:3000
```
- This runs `api/index.js` in a local serverless environment and helps catch routing/build issues before pushing to production.

## Troubleshooting tips
- Build fails with missing module: ensure `npm install` has been run and `serverless-http` is present in `package.json`.
- `MongoDB connection error`: verify `MONGODB_URI` and Atlas Network Access rules.
- `403` or auth errors: confirm `JWT_SECRET` is identical between local and production (tokens signed with different secrets won't validate).
- Cold-start slowness: serverless functions can be slower on first request because of DB connection. `utils/db.js` caches the Mongoose connection to mitigate this.
- Static assets not found: if you don't have a `public/` folder, remove the `public/**` build from `vercel.json` to avoid warnings.

## Post-deploy checklist
- Visit the app URL and test login/registration flows.
- Test admin-only routes (regenerate QR / clear attendance / export) after logging in as an admin.
- Check Vercel function logs (Project → Functions → Logs) for runtime errors.

## GitHub Actions (optional)

You can automate deploys from `main` using the included GitHub Action `.github/workflows/deploy-vercel.yml`.

1. Create a repository secret named `VERCEL_TOKEN` (Vercel Personal Token). You can create a token at https://vercel.com/account/tokens.
2. Commit to `main` and the workflow will run and call `npx vercel --prod --token "$VERCEL_TOKEN" --confirm`.

If you prefer to pin to a specific Vercel project/org, also add `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as secrets and pass them to the CLI using `--scope` or `--project` flags.

### How to find `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`

- Vercel provides numeric IDs and human-readable slugs. For the GitHub Action you can use either, but slugs are often easier to read.
- To find them in the Vercel dashboard:
  1. Open your Project dashboard in Vercel.
 2. Click the project settings (gear icon) → General. The Project ID is shown under "Project ID".
 3. For the Org ID (or slug), click the top-left organization selector (your org name) and go to the Organization Settings; the Organization ID is visible there.

Alternatively you can use the Vercel CLI to list projects and orgs:

```powershell
# list projects (shows project ids)
npx vercel projects ls --token "%VERCEL_TOKEN%"
# list teams/orgs
npx vercel teams ls --token "%VERCEL_TOKEN%"
```

### Example (GitHub secrets)

- `VERCEL_TOKEN` = your personal Vercel token (create at https://vercel.com/account/tokens)
- `VERCEL_ORG_ID` = my-org (or the numeric org id)
- `VERCEL_PROJECT_ID` = party-management (or the numeric project id)

Then in the GitHub Action the deploy command will be invoked as:

```bash
npx vercel --prod --token "$VERCEL_TOKEN" --scope my-org --project party-management --confirm
```

If you omit `--scope` / `--project`, Vercel will infer the target from the token or the linked repo; adding them prevents ambiguity.

## Further improvements (optional)
- Use Vercel Secrets for extra sensitive data and reference them in `vercel.json`.
- For production scale, consider dedicated hosting (DigitalOcean, Render, Fly) if you need persistent sockets or lower cold-start latency.

If you want, I can add a small `vercel` GitHub Action or `README` section that automates deploys from `main` and sets environment variables using the Vercel CLI.
