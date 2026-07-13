# RepMate

RepMate is the Next.js migration of the original `GYM` progressive workout PWA. The original project remains unchanged in the sibling `GYM` directory.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS
- Selected shadcn/ui-style components
- Lucide React icons
- Supabase authentication and per-user data
- IndexedDB outbox and service-worker caching for offline workouts

## Local development

1. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable key.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Add `http://localhost:3000/app` to Supabase Authentication redirect URLs.
4. Install and start the app:

   ```bash
   npm install
   npm run dev
   ```

Open `http://localhost:3000`.

## Netlify

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Netlify environment variables. Add the deployed `/app` URL to the Supabase redirect allow list. Netlify detects the Next.js application using `netlify.toml`.

## Validation

```bash
npm run lint
npm run build
```
