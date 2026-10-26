# Elsewhere — Bengaluru discovery

Elsewhere helps people explore Bengaluru alone, with friends, with family, or as a group. Qloo is the sole recommendation source. A Qloo-powered planning agent maps a person's mood, favorite entities, starting point, time, budget tier, group, and travel preference into a sequence of Qloo searches; it expands sparse searches, enforces category rules against Qloo's returned names and tags, ranks the matches against known constraints, and composes a varied shortlist or day plan. The result includes a readable explanation of those steps and Qloo's available cultural-fit cues.

Explore has 12 categories: cafés, South Indian food, global dining, bakeries, gardens, art and museums, heritage, live music, bookshops, adventure activities, wellness, and local shopping. Search accepts a place, mood, or interest. Category searches use Qloo category tags and then require a direct category cue in the matched venue or its Qloo place tags. When a strict search is sparse, the agent broadens the Qloo query and reapplies the same category check. A garden search will not be filled with malls; an adventure search expects activity venues such as karting, bowling, arcades, climbing, or escape rooms.

Budget uses Qloo's relative 1–4 price tiers where the API provides them. The mapping from the per-person budget slider to a Qloo tier is approximate; displayed prices are never represented as confirmed INR totals. Group preferences are sent as Qloo taste signals when a matching tag is available, and are used to prioritize candidates only when Qloo metadata supports that match. The app asks users to verify venue capacity, suitability, prices, schedules, and live routes.

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

## Stack and agent flow

Node.js built-in HTTP server for local development and browser-native HTML, CSS, and JavaScript. Vercel serves the static app and the `api/` serverless functions. The Qloo integration uses the Insights API (`urn:entity:place`), the tags lookup, and entity search with Bengaluru location signals, optional resolved favorite entities, explainability metadata, place category filters, and restaurant price-tier filters. The agent chooses Qloo categories from the selected plan style and mood, widens a sparse Qloo query when needed, checks category fit, scores known price and group cues, and schedules the chosen results within the available time. When current coordinates are available, it sequences mapped candidates from the starting point; otherwise it leaves Qloo's match order intact. Google Maps links use the chosen travel mode for current directions.

## Project status

The full-day planner and category discovery are Qloo-only. No model-generated venue facts, exact costs, opening hours, activity availability, or travel times are claimed. The server applies a small per-IP request limit to reduce accidental API overuse.