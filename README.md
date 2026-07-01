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

1. Push this repository to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Framework preset: **Next.js** (auto-detected)
4. Deploy — no environment variables required

Or with the Vercel CLI:

```bash
npx vercel --prod
```

## License

Unofficial fan dashboard. All race data © Henley Royal Regatta.
