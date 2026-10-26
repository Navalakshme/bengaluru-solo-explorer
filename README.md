# Elsewhere — Bengaluru discovery

A Bengaluru discovery and day-planning app for people exploring alone, with friends, with family, or as a group. Qloo is the sole recommendation engine: the app sends mood, category, starting area, and optional favorite entities as taste signals, then presents Qloo place matches with its available tags and explainability.

Explore includes 12 Qloo-powered categories: coffee, South Indian food, global dining, bakeries, gardens, art and culture, heritage, live music, books, adventure activities, wellness, and local shopping. Category results are checked with simple local category rules so a garden page does not present a mall and an adventure page does not present a civic landmark. Search accepts free-text place and taste queries. Qloo provides location and taste matches; the interface labels practical guidance as a prompt to confirm details with the venue.

## Run locally

Requires Node.js 20 or newer. No package install is needed.

1. Copy `.env.example` to `.env` and add your Qloo API key.
2. Run `npm start`.
3. Open `http://localhost:4173`.

Live recommendations require `QLOO_API_KEY`. The app does not show fabricated sample places when the key is missing or Qloo is unavailable.

## API key

Keep the key on the server. Never put it in browser code or commit `.env` to the repository. Qloo requests are made by server routes only.

## Deploy on Vercel

Import this repository as a project in Vercel and add `QLOO_API_KEY` as an encrypted environment variable for Production (and Preview if desired). Redeploy after changing the key. The key is read only by the serverless API routes.

## Stack

Node.js built-in HTTP server for local development and browser-native HTML, CSS, and JavaScript. Vercel serves the static app and the `api/` serverless functions. The Qloo integration uses the Insights API (`urn:entity:place`) with Bengaluru location signals, optional resolved favorite entities, explainability metadata, and a lower-popularity filter for explicit hidden-gem requests. Mood and category signals are converted into Qloo tags; category-specific matching uses transparent local rules over Qloo's returned place names, types, and tags. Maps links open external directions; check live routes and venue details before going.

## Project status

The app uses Qloo for category discovery and outing recommendations. Budget, group-size, and ambience copy is presented as planning guidance and is not represented as live venue verification. The server applies a small per-IP request limit to reduce accidental API overuse.