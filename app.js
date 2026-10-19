const form = document.querySelector('#plan-form');
const planButton = document.querySelector('#plan-button');
const statusLine = document.querySelector('#form-status');
const results = document.querySelector('#results');
const budget = document.querySelector('#budget');
const budgetValue = document.querySelector('#budget-value');
const locationStatus = document.querySelector('#location-status');
const startArea = document.querySelector('#start-area');
let mode = 'day';
let lastInput = null;
let lastPlan = null;
let coords = null;

const demoPlans = {
  day: { title: 'A slower side of Bengaluru', summary: 'A concept itinerary that leaves room to wander: ease into the day, find a little culture, then end somewhere green. Sample preview only; live place matches and current details need API keys.', budgetNote: 'Illustrative budget only. Check current menus and entry details before heading out.', items: [
    { name: 'Brahmin’s Coffee Bar', category: 'Coffee & breakfast', time: '09:00 · Start easy', address: 'Basavanagudi', estimatedCostINR: 180, reason: 'A small, familiar Bengaluru coffee stop to ease into a day out.', qlooFit: 'In live mode, Qloo will personalize place suggestions from the cultural interests you share.', goodToKnow: 'A casual quick stop; check current hours before you go.', gettingThere: 'Map directions open in Google Maps.' },
    { name: 'National Gallery of Modern Art', category: 'Art & culture', time: '11:00 · Take it in', address: 'Vasanth Nagar', estimatedCostINR: 250, reason: 'A quieter cultural interlude between food and the outdoors.', qlooFit: 'Qloo’s place recommendations will help shape the cultural fit.', goodToKnow: 'A flexible, self-paced visit; verify entry details.', gettingThere: 'Map directions open in Google Maps.' },
    { name: 'Cubbon Park', category: 'Green space', time: '15:30 · Slow down', address: 'Sampangi Rama Nagar', estimatedCostINR: 0, reason: 'Room to pause, walk, and let the day unfold without a fixed agenda.', qlooFit: 'Qloo taste signals will make the full route feel more like your kind of day.', goodToKnow: 'Check local conditions and daylight for your visit.', gettingThere: 'Map directions open in Google Maps.' }
  ] },
  food: { title: 'A little food-led wandering', summary: 'A concept preview for a Bengaluru food day: one traditional stop, one longer meal, and a relaxed coffee break. Live menus, hours, and Qloo personalization are not connected in preview mode.', budgetNote: 'Illustrative estimates only; prices and availability change.', items: [
    { name: 'Vidyarthi Bhavan', category: 'South Indian', time: '09:00 · Breakfast', address: 'Basavanagudi', estimatedCostINR: 250, reason: 'A classic dosa stop to anchor the day in local food culture.', qlooFit: 'Live mode will use Qloo affinity to select places that match your taste signals.', goodToKnow: 'Check current wait times and opening hours.', gettingThere: 'Map directions open in Google Maps.' },
    { name: 'Mavalli Tiffin Rooms', category: 'South Indian', time: '13:00 · Lunch', address: 'Lalbagh Road', estimatedCostINR: 500, reason: 'A substantial sit-down meal, with an easy park visit nearby if you want one.', qlooFit: 'Taste graph connections can help find food beyond generic popularity lists.', goodToKnow: 'Confirm timings before visiting.', gettingThere: 'Map directions open in Google Maps.' },
    { name: 'Third Wave Coffee', category: 'Coffee break', time: '16:00 · Take a breather', address: 'Multiple Bengaluru locations', estimatedCostINR: 350, reason: 'A low-key place to pause before deciding whether the day continues.', qlooFit: 'Qloo will tune the actual venue choice to your interests and starting area.', goodToKnow: 'Choose the closest branch in Maps.', gettingThere: 'Map directions open in Google Maps.' }
  ] },
  sights: { title: 'A day of little discoveries', summary: 'A concept preview with a mix of green space and culture. In live mode, Qloo and Gemini will find and ground options around your current starting point.', budgetNote: 'Illustrative estimates only; check current entry requirements and opening hours.', items: [
    { name: 'Lalbagh Botanical Garden', category: 'Garden', time: '08:30 · Start outdoors', address: 'Mavalli', estimatedCostINR: 100, reason: 'A spacious first stop if you want fresh air and an unhurried start.', qlooFit: 'Live suggestions will be ranked using Qloo taste and location signals.', goodToKnow: 'Check entry gates and current timings before setting out.', gettingThere: 'Map directions open in Google Maps.' },
    { name: 'MAP — Museum of Art & Photography', category: 'Art & culture', time: '12:00 · A culture break', address: 'Bengaluru CBD', estimatedCostINR: 300, reason: 'A contemporary indoor stop to add visual culture to the day.', qlooFit: 'Qloo’s cultural graph can connect interests in art, film, music, and places.', goodToKnow: 'Verify exhibits and ticket details for your date.', gettingThere: 'Map directions open in Google Maps.' },
    { name: 'Sankey Tank', category: 'Lakeside', time: '16:30 · Evening reset', address: 'Sadashivanagar', estimatedCostINR: 0, reason: 'A gentler finish with a change of pace from the city center.', qlooFit: 'Recommendations will be tailored to your taste profile in live mode.', goodToKnow: 'Check local access and daylight conditions.', gettingThere: 'Map directions open in Google Maps.' }
  ] },
  adventure: { title: 'A more active kind of day', summary: 'A concept preview for an outdoorsy Bengaluru day. Check weather, booking requirements, and current operating hours before travelling.', budgetNote: 'Illustrative estimates only; verify booking and entry costs directly.', items: [
    { name: 'Turahalli Forest', category: 'Nature & trails', time: '07:00 · Get moving', address: 'South Bengaluru', estimatedCostINR: 0, reason: 'A nearby nature break for a walk and a change of scenery.', qlooFit: 'Live Qloo signals will help personalize which outdoor experiences make the shortlist.', goodToKnow: 'Review current access guidance and trail conditions before visiting.', gettingThere: 'Map directions open in Google Maps.' },
    { name: 'Bengaluru climbing gym', category: 'Indoor activity', time: '11:30 · Try something new', address: 'Choose a current venue near your start', estimatedCostINR: 900, reason: 'An indoor activity adds a structured adventure option to the plan.', qlooFit: 'This preview uses a category placeholder; live mode will search current venues.', goodToKnow: 'Confirm session availability and beginner options directly.', gettingThere: 'Search nearby climbing gyms in Google Maps.' },
    { name: 'Ulsoor Lake', category: 'Waterfront walk', time: '16:00 · Cool down', address: 'Halasuru', estimatedCostINR: 0, reason: 'A lighter final stop after an active morning.', qlooFit: 'Qloo will connect your taste signals to specific places in the city.', goodToKnow: 'Check current access and daylight conditions.', gettingThere: 'Map directions open in Google Maps.' }
  ] }
};

function formatMoney(amount) {
  if (amount === null || amount === undefined) return 'Cost not confirmed';
  return amount === 0 ? 'Free' : `~₹${Number(amount).toLocaleString('en-IN')}`;
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function mapsUrl(item, origin) {
  const destination = [item.name, item.address, 'Bengaluru'].filter(Boolean).join(', ');
  const params = new URLSearchParams({ api: '1', destination, travelmode: document.querySelector('#transport').value === 'public' ? 'transit' : document.querySelector('#transport').value === 'walk' ? 'walking' : 'driving' });
  if (origin) params.set('origin', origin);
  return `https://www.google.com/maps/dir/?${params}`;
}

function renderPlan(payload, preview = false) {
  const plan = payload.plan;
  lastPlan = plan;
  document.querySelector('#results-title').textContent = plan.title || 'A day that feels like yours.';
  document.querySelector('#results-summary').textContent = plan.summary || '';
  document.querySelector('#result-mode-pill').textContent = mode.toUpperCase() === 'DAY' ? 'FULL DAY' : mode.toUpperCase();
  document.querySelector('#preview-banner').hidden = !preview;
  document.querySelector('#budget-note').hidden = !plan.budgetNote && !plan.travelNote;
  document.querySelector('#budget-note').textContent = [plan.budgetNote, plan.travelNote].filter(Boolean).join(' ');
  const origin = coords ? `${coords.latitude},${coords.longitude}` : startArea.value.trim();
  document.querySelector('#itinerary').innerHTML = (plan.items || []).map((item, index) => {
    const sources = (item.sourceUrls || []).filter(url => /^https?:\/\//i.test(url));
    const map = mapsUrl(item, origin);
    const practicalNote = item.goodToKnow || item.soloNotes;
    return `<article class="stop-card"><div class="stop-time">${safe(item.time || `STOP ${String(index + 1).padStart(2, '0')}`)}</div><div class="stop-body"><span class="stop-category">${safe(item.category || 'A place to explore')}</span><h3>${safe(item.name)}</h3><div class="stop-address">${safe(item.address || 'Bengaluru')}</div><p class="stop-reason">${safe(item.reason)}</p>${item.qlooFit ? `<p class="qloo-fit"><strong>Qloo taste fit</strong> · ${safe(item.qlooFit)}</p>` : ''}<div class="stop-foot"><span class="cost-tag">${formatMoney(item.estimatedCostINR)}</span>${item.gettingThere ? `<span class="transit-tag">${safe(item.gettingThere)}</span>` : ''}${practicalNote ? `<span class="good-to-know-tag">Good to know: ${safe(practicalNote)}</span>` : ''}<div class="stop-links"><a href="${map}" target="_blank" rel="noopener noreferrer">Open route ↗</a>${sources.slice(0, 1).map(url => `<a href="${url}" target="_blank" rel="noopener noreferrer">Source ↗</a>`).join('')}</div></div></div></article>`;
  }).join('');
  const allSources = [...new Map((payload.sources || []).filter(source => source.url).map(source => [source.url, source])).values()].slice(0, 8);
  const sourcesRow = document.querySelector('#sources-row');
  sourcesRow.hidden = allSources.length === 0;
  document.querySelector('#sources-list').innerHTML = allSources.map(source => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${safe(source.platform || 'Source')} · ${safe(source.title || 'Source')} ↗</a>`).join('');
  results.hidden = false;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function currentInput(refinement = '') {
  return {
    mode,
    mood: document.querySelector('#request').value.trim(),
    refinement,
    startArea: startArea.value.trim() || 'Bengaluru',
    coordinates: coords,
    budgetINR: Number(budget.value),
    durationHours: Number(document.querySelector('#duration').value),
    transport: document.querySelector('#transport').value,
    groupType: document.querySelector('#group-type').value,
    favorites: document.querySelector('#favorites').value.split(',').map(value => value.trim()).filter(Boolean),
    previousPlan: refinement && lastPlan ? lastPlan : undefined
  };
}

async function createPlan(refinement = '') {
  const input = currentInput(refinement);
  lastInput = input;
  statusLine.textContent = 'Finding your kind of places and checking the details';
  statusLine.classList.add('loading-dots');
  planButton.disabled = true;
  try {
    const response = await fetch('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const payload = await response.json();
    if (response.ok) {
      statusLine.textContent = `Qloo considered ${payload.qlooCount} place matches${payload.sources?.length ? ` · ${payload.sources.length} current sources` : ''}.`;
      renderPlan(payload, false);
    } else if (payload.missingKeys) {
      const sample = demoPlans[mode];
      const updatedSample = { ...sample, summary: input.mood ? `For “${input.mood}” — ${sample.summary}` : sample.summary };
      statusLine.textContent = 'Live Qloo and Gemini keys are needed for real recommendations.';
      renderPlan({ plan: updatedSample, sources: [] }, true);
    } else {
      statusLine.textContent = payload.error || 'Could not make a plan. Try again.';
    }
  } catch (error) {
    statusLine.textContent = 'Could not reach the planner. Check that the local app is running.';
  } finally {
    statusLine.classList.remove('loading-dots');
    planButton.disabled = false;
  }
}

document.querySelectorAll('.mode-chip').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.mode-chip.selected')?.classList.remove('selected');
  button.classList.add('selected');
  document.querySelectorAll('.mode-chip').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  mode = button.dataset.mode;
}));

document.querySelectorAll('.vibe-chip').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.vibe-chip').forEach(option => option.classList.toggle('is-used', option === button));
  const request = document.querySelector('#request');
  request.value = button.dataset.vibe;
  request.focus();
}));

budget.addEventListener('input', () => {
  const amount = Number(budget.value);
  budgetValue.textContent = amount >= 5000 ? '₹5,000+' : `₹${amount.toLocaleString('en-IN')}`;
  const percent = ((amount - Number(budget.min)) / (Number(budget.max) - Number(budget.min))) * 100;
  budget.style.background = `linear-gradient(90deg,#678c6b 0 ${percent}%,#e1e8db ${percent}% 100%)`;
});

form.addEventListener('submit', event => { event.preventDefault(); createPlan(); });
document.querySelector('#refine-form').addEventListener('submit', event => {
  event.preventDefault();
  const field = document.querySelector('#refine-input');
  const refinement = field.value.trim();
  if (!refinement) return;
  document.querySelector('#request').value = [document.querySelector('#request').value.trim(), refinement].filter(Boolean).join('. ');
  field.value = '';
  createPlan(refinement);
});

document.querySelector('#use-location').addEventListener('click', () => {
  if (!navigator.geolocation) { locationStatus.textContent = 'Location is not available in this browser. Type a neighborhood instead.'; return; }
  locationStatus.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(position => {
    coords = { latitude: Number(position.coords.latitude.toFixed(5)), longitude: Number(position.coords.longitude.toFixed(5)) };
    startArea.value = 'My current location';
    locationStatus.textContent = 'Current location ready for this plan.';
  }, () => { locationStatus.textContent = 'Could not get location. Type a neighborhood instead.'; }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 });
});
