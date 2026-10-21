# Bengaluru Solo Explorer

A Bengaluru discovery and day-planning app for people exploring alone, with friends, with family, or as a group. Qloo supplies culturally grounded place candidates; Gemini interprets the selected category and mood, removes mismatches, and turns the shortlist into useful outing recommendations.

The Explore section includes 12 Qloo-powered Bengaluru categories: cafés, South Indian food, global dining, bakeries, gardens, art and museums, heritage, live music, bookshops, adventure activities, wellness, and local shopping. Qloo provides taste and location signals; Gemini filters the candidates against the category's strict intent (for example, gardens exclude malls, while adventure prioritizes bowling, karting, arcades, climbing, and similar activities). Search accepts free-text place and taste queries. Each card shows the mood fit, available Qloo cues, group-size guidance, and a clearly marked rough budget guide.

## Run locally

Requires Node.js 20 or newer. No package install is needed.

1. Copy `.env.example` to `.env` and add your Qloo hackathon and Gemini API keys. `GEMINI_FALLBACK_API_KEY` is optional.
2. Run `npm start`.
3. Open `http://localhost:4173`.

The app can also be explored in demo mode without API keys. Demo mode is clearly labeled and does not claim to use live Qloo or Gemini data.

## API keys

Keep all keys on the server. Never put them in browser code or commit `.env` to the repository. If the primary Gemini key hits quota or fails, the day planner tries `GEMINI_FALLBACK_API_KEY`. The discovery pages require Gemini curation to keep displayed places relevant to the selected category; if curation is unavailable, the API returns an error instead of presenting a misleading mixed list.

## Deploy on Vercel

Import this repository as a project in Vercel. Add `QLOO_API_KEY` and `GEMINI_API_KEY` as encrypted environment variables for Production (and Preview if you want preview builds to use live recommendations). Optionally add a second Gemini API key from a different Google AI Studio project as `GEMINI_FALLBACK_API_KEY`. Each project’s key must be added to this Vercel project explicitly; keys in other projects are not automatically accessible. Redeploy after changing environment variables. The keys are read only by the serverless API routes.

## Stack

Node.js built-in HTTP server for local development and browser-native HTML, CSS, and JavaScript. Vercel serves the static app and the `api/` serverless functions. The Qloo integration uses the Insights API (`urn:entity:place`) with a Bengaluru locality signal, optional resolved favorite entities, explainability metadata, and a lower-popularity filter for explicit hidden-gem requests. Gemini uses Google Search and Google Maps grounding so current place information and routes can be linked to their sources.

## Project status

The initial interactive product and API integration scaffold are in place. Live Qloo and Gemini recommendations require valid API keys. Routing uses Google Maps grounding and directions links; confirm live traffic and transit availability in Maps. The server applies a small per-IP request limit to reduce accidental API overuse.
