const form = document.querySelector('#belonging-form');
const statusLine = document.querySelector('#form-status');
const matchButton = document.querySelector('#match-button');
const results = document.querySelector('#results');
const resultsGrid = document.querySelector('#community-results');
const interestInput = document.querySelector('#interest-seeds');
const themeToggle = document.querySelector('#theme-toggle');

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

function renderOptions(payload) {
  const options = Array.isArray(payload.options) ? payload.options : [];
  document.querySelector('#result-count').textContent = `${options.length} ${options.length === 1 ? 'MATCH' : 'MATCHES'}`;
  document.querySelector('#results-summary').textContent = options.length
    ? payload.matchMode === 'qloo'
      ? `${options.length} public ${options.length === 1 ? 'way' : 'ways'} to connect, ranked using Qloo’s cultural signals and filtered by the choices you made. We show only activities with a checked organiser source.`
      : payload.message || `${options.length} source-checked activities match your filters. Qloo did not find a clear cultural link for this search.`
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
  const interests = selectedInterests();
  const themes = [...document.querySelectorAll('input[name="themes"]:checked')].map(input => input.value);
  if (!interests.length && !themes.length) {
    statusLine.textContent = 'Add an interest or choose an activity type to begin.';
    interestInput.focus();
    return;
  }

  const payload = {
    interests,
    themes,
    area: document.querySelector('#start-area').value.trim(),
    budget: document.querySelector('#budget-filter').value,
    joinStyle: document.querySelector('#join-style').value
  };
  statusLine.textContent = 'Connecting your interests to Bengaluru activities with Qloo…';
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
      ? result.matchMode === 'qloo'
        ? `Qloo connected your interests to ${result.options.length} checked activities.`
        : `Showing ${result.options.length} checked activities that match your filters.`
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
