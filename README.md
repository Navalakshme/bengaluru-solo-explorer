# Bengaluru Solo Explorer

A taste-aware day planner for people exploring Bengaluru on their own. Qloo recommends places using cultural taste signals; Gemini interprets the request, grounds current details with Google Search and Google Maps, and turns the results into a flexible plan.

## Run locally

Requires Node.js 20 or newer. No package install is needed.

1. Copy `.env.example` to `.env` and add your Qloo hackathon and Gemini API keys.
2. Run `npm start`.
3. Open `http://localhost:4173`.

The app can also be explored in demo mode without API keys. Demo mode is clearly labeled and does not claim to use live Qloo or Gemini data.

## API keys

Keep both keys on the server. Never put them in browser code or commit `.env` to the repository.

## Stack

Node.js built-in HTTP server and browser-native HTML, CSS, and JavaScript. The Qloo integration uses the Insights API (`urn:entity:place`) with a Bengaluru locality signal, optional resolved favorite entities, explainability metadata, and a lower-popularity filter for explicit hidden-gem requests. Gemini uses Google Search and Google Maps grounding so current place information and routes can be linked to their sources.

## Project status

The initial interactive product and API integration scaffold are in place. Live Qloo and Gemini recommendations require valid API keys. Routing uses Google Maps grounding and directions links; confirm live traffic and transit availability in Maps. The server applies a small per-IP request limit to reduce accidental API overuse.
