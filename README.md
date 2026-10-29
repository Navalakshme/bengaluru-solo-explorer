# Common Ground — Bengaluru

Common Ground helps people find local communities and activities through cultural interests they choose to share. A person can enter up to three artists, books, films, foods, or other interests, select an activity type, and add practical filters. The app resolves those interests with Qloo, asks Qloo for related cultural tags around Bengaluru, applies hard filters to a small source-linked activity directory, and ranks the eligible options using the resulting Qloo signals.

The directory contains 31 source-linked public events and organiser-led opportunities across books, creative activities, music, nature, volunteering, and learning. Each record links to its source and includes the date checked. Event entries expire automatically using their `activeUntil` value. Prices, dates, and eligibility details that are not published by the organiser are shown as unconfirmed instead of being invented.

## What the agent does

1. Resolves the user's chosen interests to Qloo entities or tags.
2. Requests related Qloo cultural tags with Bengaluru as the locality signal.
3. Applies selected activity, budget, neighbourhood, and joining-style constraints before ranking.
4. Returns up to 30 directory entries with a source link. Qloo-ranked matches appear first; when there is no clear cultural link, eligible listings are still shown with that distinction explained.
5. Sends the user to the organiser's own page to confirm details or take the next step.

Qloo is used for cultural connections and ranking. It does not verify event dates, availability, accessibility, or an organisation's current intake. Those details must be checked with the linked organiser. The application does not ask for or infer health, religion, identity, or a person's reason for seeking community.

## Run locally

Requires Node.js 20 or newer. No package installation is needed.

1. Copy `.env.example` to `.env` and add the Qloo hackathon key as `QLOO_API_KEY`.
2. Run `npm start`.
3. Open `http://localhost:4173`.

The Qloo key is only used by server routes. Do not place it in browser code or commit `.env`.

## Deploy on Vercel

Import the public repository, add `QLOO_API_KEY` as a server-side environment variable, and redeploy. The activity directory is bundled with the function; it is not sent wholesale to the browser.

## Project structure

- `index.html`, `styles.css`, `app.js` — responsive interface, theme toggle, form and results.
- `api/belonging.js` — serverless endpoint for the matching workflow.
- `lib/belonging.js` — Qloo entity/tag resolution, hard filters, and deterministic ranking.
- `data/bengaluru-community-options.json` — source-linked local activity directory.
- `server.mjs` — local development server and matching endpoint.

## Data maintenance

Update `data/bengaluru-community-options.json` when event listings expire or an organiser changes its information. Keep the source URL and `checkedOn` date current. Use `activeUntil` for time-limited listings. Unknown prices should remain `null`; do not estimate a fee as if the organiser published it. Check the linked page before representing an opportunity as open.
