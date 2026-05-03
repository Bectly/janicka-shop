This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Analytics (GA4)

GA4 is wired through `src/components/analytics-provider.tsx` and only loads
`gtag.js` after the user grants analytics-cookie consent. To enable, set on
Vercel (or in `.env.local`):

```
NEXT_PUBLIC_GA4_ID=G-XXXXXXXX
# Optional: GA4 Measurement Protocol secret for server-side cron metrics
GA4_API_SECRET=
```

When the env var is unset the provider is a no-op (no script loaded, no events
fired). The legacy name `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is still accepted as a
fallback. Tracked events: `view_item`, `add_to_cart`, `begin_checkout`,
`purchase`, `search`, `referral_share` — see `src/lib/analytics.ts`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
