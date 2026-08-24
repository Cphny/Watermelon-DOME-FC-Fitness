# Workout Squad

Real, multiplayer version — backed by Supabase. Your `.env` file already has
your project's URL and key filled in, so you shouldn't need to touch config.

## Run it

Open a terminal in this folder (or open the folder in Claude Code and ask
it to run these for you) and run:

```
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## First time using it

1. Enter your email — Supabase sends you a magic sign-in link, no password.
2. Click the link (opens in your browser), which logs you in.
3. Enter your name to join the group.
4. Log a workout, see it show up instantly.

## Getting a friend in

Send them the same running URL (if you deploy it — see below) or, for now,
have them run this same project on their own machine with the same `.env`
file. They sign in with their own email and pick their own name — they'll
land in the same "Iron Circle" group and see your activity live.

## Deploying so friends don't need to run code themselves

Once this feels solid, the easiest path is:

1. Push this folder to a GitHub repo
2. Go to vercel.com, sign in with GitHub, import the repo
3. Add the same two environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) in Vercel's project settings
4. Deploy — you get a real public URL to send friends

Ask me when you're ready for this step, or hand this whole project to
Claude Code and ask it to walk you through deployment.
