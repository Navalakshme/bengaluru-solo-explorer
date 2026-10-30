# Common Ground — Bengaluru

Common Ground has two discovery modes for Bengaluru. **Food places** sends cuisine or food interests such as “Korean food” to Qloo's place recommendations and returns matching restaurant and venue entities, with Qloo price level and neighbourhood filters. **People & activities** uses Qloo cultural signals to rank source-linked local community listings against the interests and activity filters a person chooses.

The directory contains 31 source-linked public events and organiser-led opportunities across books, creative activities, music, nature, volunteering, and learning. Each record links to its source and includes the date checked. Event entries expire automatically using their `activeUntil` value. Prices, dates, and eligibility details that are not published by the organiser are shown as unconfirmed instead of being invented.

## What the food-place finder does

1. Resolves known cuisines to restaurant cuisine tags and sends other entered food, dish, café, or cuisine terms to Qloo's tag search.
2. Requests Qloo place entities in Bengaluru (or the neighbourhood entered) and uses the cuisine as a taste signal.
3. Applies the selected Qloo price-level limit and returns place details, tags, and links where Qloo provides them.
4. Offers a Google Maps search for each place. Confirm menus, opening hours, prices, and availability with the venue.

## What the community finder does

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
- `lib/belonging.js` — Qloo place search, entity/tag resolution, hard filters, and community ranking.
- `data/bengaluru-community-options.json` — source-linked local activity directory.
- `server.mjs` — local development server and matching endpoint.

## Data maintenance

Update `data/bengaluru-community-options.json` when event listings expire or an organiser changes its information. Keep the source URL and `checkedOn` date current. Use `activeUntil` for time-limited listings. Unknown prices should remain `null`; do not estimate a fee as if the organiser published it. Check the linked page before representing an opportunity as open.
