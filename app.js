const form = document.querySelector('#belonging-form');
const statusLine = document.querySelector('#form-status');
const matchButton = document.querySelector('#match-button');
const results = document.querySelector('#results');
const resultsGrid = document.querySelector('#community-results');
const interestInput = document.querySelector('#interest-seeds');
const themeToggle = document.querySelector('#theme-toggle');
const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
const budgetSelect = document.querySelector('#budget-filter');
const communityBudgetOptions = [
  ['any', 'Any / not listed'], ['free', 'Free only'], ['500', 'Up to ₹500'], ['2000', 'Up to ₹2,000']
];
const placeBudgetOptions = [
  ['any', 'Any price level'], ['1', 'Level 1 · lower'], ['2', 'Level 2'], ['3', 'Level 3'], ['4', 'Level 4 · higher']
];

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
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

function currentMode() {
  return modeInputs.find(input => input.checked)?.value || 'places';
}

function updateMode() {
  const places = currentMode() === 'places';
  document.body.dataset.discoveryMode = places ? 'places' : 'community';
  document.querySelectorAll('.community-only').forEach(element => { element.hidden = places; });
  document.querySelectorAll('.place-only').forEach(element => { element.hidden = !places; });
  document.querySelector('#budget-label').textContent = places ? 'Qloo price level' : 'Activity cost';
  document.querySelector('#interest-label').textContent = places ? 'What food or taste should Qloo look for?' : 'What cultural interests should Qloo connect?';
  interestInput.placeholder = places ? 'Korean food, cozy cafés, dosa…' : 'A book, film, artist, or cause…';
  document.querySelector('#interest-help').textContent = places
    ? 'Search any cuisine, dish, café style, or food preference—like biryani, ramen, vegan food, or desserts. Qloo uses your words for this search; no account or personal profile needed.'
    : 'Enter up to three cultural interests—such as a book, film, musician, or cause. Qloo connects them to Bengaluru activity listings only when a direct taste link is found.';
  budgetSelect.innerHTML = (places ? placeBudgetOptions : communityBudgetOptions)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  document.querySelector('#submit-label').textContent = places ? 'Find places for me' : 'Find my kind of community';
  document.querySelector('#results-title').textContent = places ? 'Places that fit your taste.' : 'A few ways to find common ground.';
  document.querySelector('#results-note').innerHTML = places
    ? '<span aria-hidden="true">✳</span> Qloo place details, menus, opening hours, prices, and availability can change. Confirm with the venue before you go.'
    : '<span aria-hidden="true">✳</span> Activities and availability can change. Use the organiser’s own page to confirm dates, cost, suitability, and access details.';
}

modeInputs.forEach(input => input.addEventListener('change', updateMode));
updateMode();

document.querySelectorAll('[data-place-shortcut]').forEach(button => {
  button.addEventListener('click', () => {
    interestInput.value = button.dataset.placeShortcut;
    document.querySelectorAll('[data-place-shortcut]').forEach(item => item.classList.toggle('is-used', item === button));
    interestInput.focus();
  });
});

document.querySelectorAll('[data-theme-shortcut]').forEach(button => {
  button.addEventListener('click', () => {
    const themeId = button.dataset.themeShortcut;
    const choice = document.querySelector(`input[name="themes"][value="${themeId}"]`);
    const surprise = document.querySelector('input[name="themes"][value="any"]');
    if (choice) {
      surprise.checked = false;
      choice.checked = true;
      choice.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.querySelectorAll('[data-theme-shortcut]').forEach(item => item.classList.toggle('is-used', item === button));
  });
});

document.querySelectorAll('input[name="themes"]').forEach(input => {
  input.addEventListener('change', () => {
    const all = document.querySelector('input[name="themes"][value="any"]');
    if (input.value === 'any' && input.checked) {
      document.querySelectorAll('input[name="themes"]').forEach(other => { if (other !== input) other.checked = false; });
    } else if (input.checked) {
      all.checked = false;
    }
  });
});

function selectedInterests() {
  return [...new Set(interestInput.value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean))].slice(0, 3);
}

function qlooSignalSummary(signals) {
  const container = document.querySelector('#qloo-signals');
  const usefulSignals = Array.isArray(signals) ? signals.slice(0, 6) : [];
  container.hidden = usefulSignals.length === 0;
  container.innerHTML = usefulSignals.length
    ? `<span class="qloo-signals-label">QLOO FOUND RELATED CULTURAL SIGNALS</span><div>${usefulSignals.map(signal => `<span>${safe(signal.name)}</span>`).join('')}</div>`
    : '';
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function renderPlaces(payload) {
  const places = Array.isArray(payload.options) ? payload.options : [];
  document.querySelector('#result-count').textContent = `${places.length} ${places.length === 1 ? 'PLACE' : 'PLACES'}`;
  document.querySelector('#results-summary').textContent = places.length
    ? `Qloo matched your taste signals to ${places.length} Bengaluru ${places.length === 1 ? 'place' : 'places'}. Use each venue’s own details to confirm menus, opening hours, prices, and availability.`
    : payload.message || 'Qloo did not return a close place match. Try a cuisine, dish, or neighbourhood.';
  qlooSignalSummary(payload.signals);

  if (!places.length) {
    resultsGrid.innerHTML = `<div class="discover-empty"><strong>No close place matches yet.</strong><span>${safe(payload.message || 'Try another cuisine, dish, or neighbourhood.')}</span></div>`;
    return;
  }

  resultsGrid.innerHTML = places.map((place, index) => {
    const tags = Array.isArray(place.tags) ? place.tags : [];
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.name, place.address, place.area].filter(Boolean).join(', '))}`;
    const website = safeUrl(place.website);
    const image = safeUrl(place.image);
    const facts = [
      place.address ? `<div><dt>Address</dt><dd>${safe(place.address)}</dd></div>` : '',
      place.area ? `<div><dt>Area</dt><dd>${safe(place.area)}</dd></div>` : '',
      place.priceLevel ? `<div><dt>Qloo price</dt><dd>Level ${safe(place.priceLevel)} of 4 · relative price tier</dd></div>` : '',
      place.rating ? `<div><dt>Rating</dt><dd>${safe(place.rating)}${place.ratingCount ? ` (${safe(place.ratingCount)} ratings)` : ''}</dd></div>` : ''
    ].filter(Boolean).join('');
    return `
      <article class="community-card place-card">
        ${image ? `<img class="place-image" src="${safe(image)}" alt="" loading="lazy">` : ''}
        <div class="community-card-top"><span class="community-number">${String(index + 1).padStart(2, '0')}</span><span class="community-kind">Qloo place match</span></div>
        <h3>${safe(place.name)}</h3>
        ${tags.length ? `<div class="place-tags">${tags.slice(0, 5).map(tag => `<span>${safe(tag)}</span>`).join('')}</div>` : ''}
        <p class="community-description">${safe(place.description || 'A Qloo-recommended place in Bengaluru. Check the venue’s own listing for current menu and visit details.')}</p>
        <p class="community-qloo"><span aria-hidden="true">✳</span> ${safe(place.qlooReason || 'Recommended by Qloo from your selected tastes and Bengaluru location.')}</p>
        ${facts ? `<dl class="community-details">${facts}</dl>` : ''}
        <div class="community-footer"><a href="${safe(mapsUrl)}" target="_blank" rel="noopener noreferrer">Open in Maps ↗</a>${website ? `<a class="community-join" href="${safe(website)}" target="_blank" rel="noopener noreferrer">Venue details ↗</a>` : ''}</div>
      </article>`;
  }).join('');
}

function renderOptions(payload) {
  if (payload.mode === 'places') return renderPlaces(payload);
  const options = Array.isArray(payload.options) ? payload.options : [];
  document.querySelector('#result-count').textContent = `${options.length} ${options.length === 1 ? 'MATCH' : 'MATCHES'}`;
  document.querySelector('#results-summary').textContent = options.length
    ? payload.matchMode === 'qloo'
      ? `${options.length} public ${options.length === 1 ? 'way' : 'ways'} to connect, ranked using Qloo’s cultural signals and filtered by the choices you made. We show only activities with a checked organiser source.`
      : payload.matchMode === 'qloo-theme'
        ? `${options.length} checked activities match the category signals Qloo returned. Your specific interest had no direct match, so these are broader ${safe([...document.querySelectorAll('input[name="themes"]:checked')].map(input => input.parentElement.textContent.trim()).join(', ') || 'category')} results.`
      : payload.message || `${options.length} source-checked activities match your filters.`
    : payload.message || 'There are no checked options matching this combination yet.';
  qlooSignalSummary(payload.signals);

  if (!options.length) {
    resultsGrid.innerHTML = `<div class="discover-empty"><strong>No clear match yet.</strong><span>${safe(payload.message || 'Try a different interest or widen one filter.')}</span></div>`;
    return;
  }

  resultsGrid.innerHTML = options.map((option, index) => `
    <article class="community-card">
      <div class="community-card-top"><span class="community-number">${String(index + 1).padStart(2, '0')}</span><span class="community-kind">${safe(option.kind)}</span></div>
      <p class="community-organizer">${safe(option.organizer)}</p>
      <h3>${safe(option.name)}</h3>
      <p class="community-description">${safe(option.description)}</p>
      <p class="community-qloo"><span aria-hidden="true">✳</span> ${safe(option.qlooReason)}</p>
      <dl class="community-details">
        <div><dt>When</dt><dd>${safe(option.schedule)}</dd></div>
        <div><dt>Where</dt><dd>${safe(option.area)}</dd></div>
        <div><dt>Cost</dt><dd>${safe(option.priceLabel)}</dd></div>
        <div><dt>First step</dt><dd>${safe(option.newcomer)}</dd></div>
      </dl>
      <div class="community-footer"><span>Details checked ${safe(option.checkedOn)}</span><a href="${safe(option.sourceUrl)}" target="_blank" rel="noopener noreferrer">See source ↗</a><a class="community-join" href="${safe(option.joinUrl)}" target="_blank" rel="noopener noreferrer">Contact / join ↗</a></div>
    </article>`).join('');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const mode = currentMode();
  const interests = selectedInterests();
  const themes = [...document.querySelectorAll('input[name="themes"]:checked')].map(input => input.value);
  if (!interests.length && (mode === 'places' || !themes.length)) {
    statusLine.textContent = mode === 'places' ? 'Enter a cuisine, dish, or other taste to find places.' : 'Add an interest or choose an activity type to begin.';
    interestInput.focus();
    return;
  }

  const payload = {
    mode,
    interests,
    themes,
    area: document.querySelector('#start-area').value.trim(),
    budget: document.querySelector('#budget-filter').value,
    joinStyle: document.querySelector('#join-style').value
  };
  statusLine.textContent = mode === 'places' ? 'Finding Bengaluru places with Qloo…' : 'Connecting your interests to Bengaluru activities with Qloo…';
  statusLine.classList.add('loading-dots');
  matchButton.disabled = true;
  matchButton.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/belonging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not match activities right now.');
    renderOptions(result);
    statusLine.textContent = result.options.length
      ? result.mode === 'places'
        ? `Qloo found ${result.options.length} Bengaluru places for your taste.`
        : result.matchMode === 'qloo-theme'
          ? `Qloo found ${result.options.length} broader matches for the selected activity category. Your named interest did not match directly.`
          : `Qloo connected your interests to ${result.options.length} checked activities.`
      : result.message;
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    statusLine.textContent = error.message || 'Qloo could not complete the match. Please try again.';
  } finally {
    statusLine.classList.remove('loading-dots');
    matchButton.disabled = false;
    matchButton.removeAttribute('aria-busy');
  }
});

document.querySelector('#copy-mcp').addEventListener('click', async event => {
  const endpoint = `${location.origin}/api/mcp`;
  try {
    await navigator.clipboard.writeText(endpoint);
    event.currentTarget.textContent = 'Copied';
    window.setTimeout(() => { event.currentTarget.textContent = 'Copy MCP endpoint'; }, 1800);
  } catch {
    event.currentTarget.textContent = endpoint;
  }
});
