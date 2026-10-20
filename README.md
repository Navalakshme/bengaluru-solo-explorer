# Bengaluru Solo Explorer

A taste-aware day planner for people exploring Bengaluru on their own. Qloo recommends places using cultural taste signals; Gemini interprets the request, grounds current details with Google Search and Google Maps, and turns the results into a flexible plan.

## Run locally

Requires Node.js 20 or newer. No package install is needed.

1. Copy `.env.example` to `.env` and add your Qloo hackathon and Gemini API keys. `GEMINI_FALLBACK_API_KEY` is optional.
2. Run `npm start`.
3. Open `http://localhost:4173`.

The app can also be explored in demo mode without API keys. Demo mode is clearly labeled and does not claim to use live Qloo or Gemini data.

## API keys

Keep all keys on the server. Never put them in browser code or commit `.env` to the repository. If the primary Gemini key hits quota or fails, the app tries `GEMINI_FALLBACK_API_KEY`. If both Gemini keys fail, it returns Qloo's place matches; if Qloo is unavailable too, it shows a clearly labeled local Bengaluru shortlist.

## Deploy on Vercel

Import this repository as a project in Vercel. Add `QLOO_API_KEY` and `GEMINI_API_KEY` as encrypted environment variables for Production (and Preview if you want preview builds to use live recommendations). Optionally add a second Gemini API key from a different Google AI Studio project as `GEMINI_FALLBACK_API_KEY`. Each project’s key must be added to this Vercel project explicitly; keys in other projects are not automatically accessible. Redeploy after changing environment variables. The keys are read only by the serverless API routes.

## Stack

Node.js built-in HTTP server for local development and browser-native HTML, CSS, and JavaScript. Vercel serves the static app and the `api/` serverless functions. The Qloo integration uses the Insights API (`urn:entity:place`) with a Bengaluru locality signal, optional resolved favorite entities, explainability metadata, and a lower-popularity filter for explicit hidden-gem requests. Gemini uses Google Search and Google Maps grounding so current place information and routes can be linked to their sources.

## Project status

The initial interactive product and API integration scaffold are in place. Live Qloo and Gemini recommendations require valid API keys. Routing uses Google Maps grounding and directions links; confirm live traffic and transit availability in Maps. The server applies a small per-IP request limit to reduce accidental API overuse.
