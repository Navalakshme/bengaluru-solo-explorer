const form = document.querySelector('#plan-form');
const planButton = document.querySelector('#plan-button');
const statusLine = document.querySelector('#form-status');
const results = document.querySelector('#results');
const budget = document.querySelector('#budget');
const budgetValue = document.querySelector('#budget-value');
const locationStatus = document.querySelector('#location-status');
const startArea = document.querySelector('#start-area');
const themeToggle = document.querySelector('#theme-toggle');
let mode = 'day';
let lastInput = null;
let lastPlan = null;
let coords = null;
let discoveryCategories = [];
let discoverySearch = '';
let activeDiscoveryId = 'all';

function renderCategoryCards() {
  const grid = document.querySelector('#category-grid');
  grid.innerHTML = discoveryCategories.map(category => `<button class="category-card" type="button" data-category="${safe(category.id)}"><span class="category-icon" aria-hidden="true">${safe(category.icon || '✳')}</span><span class="category-copy"><strong>${safe(category.name)}</strong><span>${safe(category.mood)}</span></span><span class="category-arrow" aria-hidden="true">↗</span></button>`).join('');
}

async function loadDiscoveryCategories() {
  try {
    const response = await fetch('/api/discover?catalog=1');
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.categories)) throw new Error('Could not load categories.');
    discoveryCategories = payload.categories;
    renderCategoryCards();
  } catch {
    document.querySelector('#category-grid').innerHTML = '<p class="discover-loading">Place categories are temporarily unavailable. Use the planner above to describe what you are looking for.</p>';
  }
}

function priceLevel(place) {
  const value = Number(place.properties?.price_level ?? place.price_level);
  const labels = ['Free / no charge', '₹ · Inexpensive', '₹₹ · Moderate', '₹₹₹ · Expensive', '₹₹₹₹ · Premium'];
  return Number.isInteger(value) && value >= 0 && value < labels.length ? labels[value] : 'Not listed by Qloo · check venue';
}

function placeAddress(place) {
  const address = place.properties?.address || place.properties?.formatted_address || place.properties?.geocode?.address;
  if (typeof address === 'string') return address;
  if (address && typeof address === 'object') return [address.name, address.neighborhood, address.locality, address.city].filter(Boolean).join(', ');
  return [place.properties?.geocode?.neighborhood, place.properties?.geocode?.city, 'Bengaluru'].filter(Boolean).join(', ');
}

function explainability(place, signals) {
  const value = place.query?.explainability || place.explainability;
  if (typeof value === 'string' && value.trim()) return value.trim();
  const tags = (Array.isArray(place.tags) ? place.tags : []).map(tag => tag?.name).filter(Boolean).slice(0, 4);
  return tags.length ? `Qloo associates this place with ${tags.join(', ')}.` : `Qloo matched it with ${signals.join(', ')} around Bengaluru.`;
}

function renderDiscoveryPage(categoryId = 'all', search = '') {
  activeDiscoveryId = categoryId;
  discoverySearch = search;
  document.querySelector('.hero-grid').hidden = true;
  document.querySelector('#explore').hidden = true;
  document.querySelector('#results').hidden = true;
  const page = document.querySelector('#discover-page');
  page.hidden = false;
  const category = discoveryCategories.find(item => item.id === categoryId) || { id: 'all', name: search ? 'Search Bengaluru' : 'All tastes', icon: '⌕', mood: 'a little of everything', ambience: 'A mix of place ideas from across Bengaluru.', company: 'Suggested 1–4 people; confirm seating or activity capacity.', budget: 'Rough spend guide varies by place; check menus, tickets, and venue details.' };
  document.querySelector('#discovery-page-title').textContent = search ? `Bengaluru picks for “${search}”` : category.name;
  document.querySelector('#discovery-page-icon').textContent = category.icon || '✳';
  document.querySelector('#discovery-page-intro').textContent = search ? `A Qloo-powered search shaped by “${search}” and Bengaluru. Group sizes and budgets are planning guides; confirm details with each venue.` : `A Qloo-curated look at ${category.name.toLowerCase()}, for a ${category.mood} kind of day. Group sizes and budgets are planning guides; confirm details with each venue.`;
  document.querySelector('#discovery-query-page').value = search;
  document.querySelector('#discovery-status').textContent = 'Finding Qloo place matches around Bengaluru…';
  document.querySelector('#discovery-results').innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const params = new URLSearchParams({ category: categoryId, area: startArea.value.trim() || 'Bengaluru' });
  if (search) params.set('search', search);
  const favoriteNames = document.querySelector('#favorites').value.split(',').map(value => value.trim()).filter(Boolean).slice(0, 5);
  if (favoriteNames.length) params.set('favorites', favoriteNames.join(','));
  fetch(`/api/discover?${params}`).then(async response => {
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not find places.');
    return payload;
  }).then(payload => {
    if (activeDiscoveryId !== categoryId || discoverySearch !== search) return;
    const places = Array.isArray(payload.places) ? payload.places : [];
    const status = places.length >= 10
      ? `10+ Qloo matches · Bengaluru${search ? ` · search: ${search}` : ''}`
      : `${places.length} Qloo matches · Try a broader search for more places.`;
    document.querySelector('#discovery-status').textContent = status;
    if (!places.length) {
      document.querySelector('#discovery-results').innerHTML = '<div class="discover-empty"><strong>No close matches yet.</strong><span>Try another word, a nearby neighbourhood, or a different taste category.</span></div>';
      return;
    }
    document.querySelector('#discovery-results').innerHTML = places.map((place, index) => {
      const address = placeAddress(place);
      const tags = (Array.isArray(place.tags) ? place.tags : []).map(tag => tag?.name).filter(Boolean).slice(0, 4);
      const map = mapsUrl({ name: place.name, address }, startArea.value.trim() || 'Bengaluru');
      const group = category.company || 'Choose what works for your group';
      const atmosphere = tags.length ? `${category.ambience} Taste cues: ${tags.join(', ')}.` : category.ambience;
      const listedPrice = priceLevel(place);
      const budgetGuide = listedPrice.startsWith('Not listed') ? category.budget : `${listedPrice} · ${category.budget}`;
      return `<article class="discovery-card"><div class="discovery-card-top"><span class="discovery-number">${String(index + 1).padStart(2, '0')}</span><span class="discovery-category">${safe(category.name)}</span></div><h3>${safe(place.name)}</h3><p class="discovery-address">⌖ ${safe(address)}</p><p class="discovery-description">A ${safe(category.mood)} mood for this Bengaluru outing. ${safe(explainability(place, payload.signals || []))}</p><div class="discovery-details"><div><span>Mood</span><strong>${safe(category.mood)}</strong></div><div><span>Ambience cue</span><strong>${safe(atmosphere)}</strong></div><div><span>Suggested group size</span><strong>${safe(group)}</strong></div><div><span>Budget guide</span><strong>${safe(budgetGuide)}</strong></div></div>${tags.length ? `<div class="discovery-tags">${tags.map(tag => `<span>${safe(tag)}</span>`).join('')}</div>` : ''}<div class="discovery-card-footer"><span>Qloo cultural match${place.affinity !== undefined ? ` · ${safe(place.affinity)}` : ''}</span><a href="${map}" target="_blank" rel="noopener noreferrer">Open in Maps ↗</a></div></article>`;
    }).join('');
  }).catch(error => {
    if (activeDiscoveryId !== categoryId || discoverySearch !== search) return;
    document.querySelector('#discovery-status').textContent = error.message || 'Could not load Qloo place matches.';
  });
}

function showPlannerPage() {
  document.querySelector('.hero-grid').hidden = false;
  document.querySelector('#explore').hidden = false;
  document.querySelector('#discover-page').hidden = true;
}

function navigateToDiscovery(categoryId, search = '') {
  discoverySearch = search;
  const nextHash = `#places/${categoryId}`;
  if (location.hash === nextHash) renderDiscoveryPage(categoryId, search);
  else location.hash = nextHash;
}

window.addEventListener('hashchange', () => {
  const match = location.hash.match(/^#places\/([^/?#]+)/);
  if (match) renderDiscoveryPage(decodeURIComponent(match[1]), discoverySearch);
  else showPlannerPage();
});

document.querySelector('#category-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (button) navigateToDiscovery(button.dataset.category);
});
document.querySelector('#discovery-search').addEventListener('submit', event => {
  event.preventDefault();
  const search = document.querySelector('#discovery-query').value.trim();
  if (search) navigateToDiscovery('all', search);
});
document.querySelector('#discovery-search-page').addEventListener('submit', event => {
  event.preventDefault();
  const search = document.querySelector('#discovery-query-page').value.trim();
  if (search) navigateToDiscovery('all', search);
});
document.querySelector('#back-to-discover').addEventListener('click', () => { location.hash = '#explore'; });
loadDiscoveryCategories();
if (location.hash.startsWith('#places/')) {
  const id = decodeURIComponent(location.hash.slice('#places/'.length).split(/[/?#]/)[0]);
  renderDiscoveryPage(id, '');
}

function setTheme(theme) {
  const light = theme === 'light';
  document.body.dataset.theme = light ? 'light' : 'dark';
  themeToggle.setAttribute('aria-pressed', String(light));
  themeToggle.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} mode`);
  themeToggle.querySelector('.theme-toggle-label').textContent = light ? 'Dark' : 'Light';
  themeToggle.querySelector('.theme-toggle-icon').textContent = light ? '☾' : '☼';
  document.querySelector('meta[name="theme-color"]').content = light ? '#f1f4ed' : '#09121b';
}

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('elsewhere-theme') || 'dark'; } catch {}
setTheme(savedTheme);
themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  setTheme(nextTheme);
  try { localStorage.setItem('elsewhere-theme', nextTheme); } catch {}
});

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
  const readback = document.querySelector('#mood-readback');
  const interpretation = payload.interpretation;
  const cues = [interpretation?.mood, ...(payload.qlooTasteSignals || [])].filter(Boolean);
  readback.hidden = preview || cues.length === 0;
  readback.textContent = cues.length ? `Plan cues · ${cues.map(safe).join(' · ')}` : '';
  document.querySelector('#result-mode-pill').textContent = mode.toUpperCase() === 'DAY' ? 'FULL DAY' : mode.toUpperCase();
  document.querySelector('#preview-banner').hidden = !preview;
  document.querySelector('#preview-title').textContent = 'Concept preview';
  document.querySelector('#preview-copy').textContent = ' — sample places to show the experience. Add the missing API key in Vercel for live taste matches and current, sourced details.';
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
      statusLine.textContent = `${payload.interpretation?.mood ? `Read your request as ${payload.interpretation.mood}. ` : ''}Qloo considered ${payload.qlooCount ?? payload.qlooMatchesUsed ?? 0} place matches${payload.sources?.length ? ` · ${payload.sources.length} current sources` : ''}.`;
      renderPlan(payload, false);
    } else if (payload.missingKeys) {
      const sample = demoPlans[mode];
      const updatedSample = { ...sample, summary: input.mood ? `For “${input.mood}” — ${sample.summary}` : sample.summary };
      const missingProviders = payload.missingKeys.map(key => key === 'QLOO_API_KEY' ? 'Qloo' : 'Gemini');
      statusLine.textContent = `Add the ${missingProviders.join(' and ')} API key${missingProviders.length > 1 ? 's' : ''} in Vercel to enable live recommendations.`;
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
