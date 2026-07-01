# HRR Princess Elizabeth Live Bracket

Live knockout bracket dashboard for **The Princess Elizabeth Challenge Cup** at Henley Royal Regatta 2026.

## Features

- Full 32-crew elimination bracket across all five rounds
- Live results from the official Henley Royal Regatta API
- Auto-refreshes every 30 seconds
- Recent results sidebar with verdicts and finish times

## Data Source

Results are fetched from the official HRR WordPress API:

```
https://www.hrr.co.uk/wp-json/hrr/v1/results?trophy=the-princess-elizabeth-challenge-cup
```

Initial bracket pairings are from the [2026 Henley Royal Regatta Draw](https://dftgz7dbeqc0e.cloudfront.net/2026/06/Henley-Royal-Regatta-2026-Draw.pdf).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Import [Hylton777/HRR1](https://github.com/Hylton777/HRR1) at [vercel.com/new](https://vercel.com/new)
2. Set **Production Branch** to `main`
3. In **Project Settings → General**, confirm:
   - **Framework Preset**: Next.js
   - **Root Directory**: (leave blank)
   - **Output Directory**: (leave blank — do not set `.next` or `public`)
   - **Build Command**: `npm run build` (default)
4. Deploy — no environment variables required

If you see a plain-text `DEPLOYMENT_NOT_FOUND` 404, the production domain is not linked to a successful deployment. Open **Deployments**, find the latest successful build, click **Promote to Production**, then redeploy.

Verify the deployment is working: visit `/api/health` — it should return `{"ok":true}`.

## License

Unofficial fan dashboard. All race data © Henley Royal Regatta.
