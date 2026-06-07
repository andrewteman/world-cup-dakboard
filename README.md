# World Cup 2026 widget for Dakboard

A self-contained live-score and group-standings board that pulls from
football-data.org through your own Vercel proxy, then embeds into Dakboard as a
single iframe. No branding, no ads, themed to sit calmly on a wall display.

Three files:

- `api/wc.js` ........ Vercel serverless function. Holds your API token, adds
                       CORS, edge-caches the response, returns standings +
                       matches in one payload.
- `index.html` ....... The widget. Fetches `/api/wc`, renders fixtures and
                       rotating group tables. Handles the pre-tournament state.
- `package.json` ..... Pins ESM so the function runs as-is.

The whole thing costs nothing: football-data.org free tier plus Vercel's free
Hobby plan.

---

## Step 1: Get a football-data.org token (2 minutes)

1. Go to https://www.football-data.org/client/register
2. Register with your email. Confirm the email.
3. Sign in. Your API token is shown on the account page. Copy it.

Free tier gives you the FIFA World Cup (`WC`), 10 requests/minute, and scores on
a short delay (not real-time). The proxy caches for 5 minutes, so you will never
hit the limit even with several displays.

## Step 2: Put the files on Vercel

You have two ways. Pick one.

### Option A: drag-and-drop (no Git)

1. Go to https://vercel.com and sign in.
2. Install the Vercel CLI if you want the fastest path: `npm i -g vercel`
3. From inside this folder, run `vercel` and follow the prompts (link to your
   account, accept defaults, it deploys). Or use the dashboard import in Option B.

### Option B: GitHub (cleaner for edits later)

1. Create a new GitHub repo and push these three files (keep the `api/` folder
   structure intact).
2. In Vercel: Add New > Project > import that repo > Deploy. Defaults are fine;
   this is a zero-config static site plus one function.

## Step 3: Add your token as an environment variable

This is the one step you must do yourself, since it is a credential.

1. In the Vercel project: Settings > Environment Variables.
2. Add: name `FOOTBALL_DATA_TOKEN`, value = the token from Step 1. Apply to all
   environments.
3. Redeploy (Deployments > the latest one > Redeploy). The env var only takes
   effect on a build that runs after you add it.

## Step 4: Confirm it works

- Open `https://YOUR-PROJECT.vercel.app/api/wc` in a browser. You should see JSON
  with `standings`, `matches`, and `fetchedAt`. If you see a token error, recheck
  Step 3. A `403` upstream status means the token is wrong; `429` means rate
  limited (wait a minute).
- Open `https://YOUR-PROJECT.vercel.app/` to see the widget. Right now (before
  June 11) it will show upcoming fixtures and a note that group tables fill in
  once the stage begins. That is correct behavior.

## Step 5: Embed in Dakboard

1. Edit a Custom Screen. Add a block, choose Website/iframe.
2. Paste `https://YOUR-PROJECT.vercel.app/` as the URL.
3. Set the block's refresh interval to 10 minutes (the widget also refreshes its
   own data on a 10-minute timer, so this is just a backstop).
4. Size and place the block. The layout is fluid and reflows to fit.

---

## Tuning, via URL parameters (no code edits)

Append these to the iframe URL. Combine with `&`.

- `?view=both` ............ default. Use `fixtures` or `standings` for a single
  panel (handy if you want two separate Dakboard tiles).
- `?fav=USA,ENG,BRA` ...... highlight these teams in lime wherever they appear.
  Use the three-letter codes (TLA).
- `?refresh=600` .......... data refresh in seconds. Default 600.
- `?rotate=14` ............ seconds between group rotations. Default 14.
- `?groups=3` ............. how many group cards show at once. Default 3.

Example, a standings-only tile that highlights the US and cycles two groups at a
time:

```
https://YOUR-PROJECT.vercel.app/?view=standings&fav=USA&groups=2
```

## Notes and limits

- Free-tier scores lag real play by a short interval. For a wall display this is
  invisible. If you ever want true real-time, swap the proxy's upstream to a paid
  API (Sportmonks World Cup or api-football); the widget would not need to change
  much, only the field mapping in `api/wc.js`.
- Group standings only exist during the group stage. Once knockouts begin, the
  standings panel will show the pre/empty note and the fixtures panel carries the
  load, labeling knockout matches by their stage. A bracket view is a later add
  if you want it.
- Crests load from football-data.org's CDN. If one is missing, the row falls back
  to the team's three-letter code automatically.
