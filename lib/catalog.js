import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CSV_URL = new URL('../data/bengaluru-places.csv', import.meta.url);
let rowsPromise;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const [headers = [], ...values] = rows;
  return values.filter(record => record.some(Boolean)).map(record => Object.fromEntries(headers.map((header, index) => [header.trim(), (record[index] || '').trim()])));
}

function loadRows() {
  if (!rowsPromise) rowsPromise = readFile(fileURLToPath(CSV_URL), 'utf8').then(parseCsv);
  return rowsPromise;
}

const categoryMap = {
  coffee: ['Cafés & Bakeries'],
  'south-indian': ['Food & Local Eats'],
  'global-food': ['Food & Local Eats'],
  bakeries: ['Cafés & Bakeries'],
  gardens: ['Gardens & Outdoors'],
  art: ['Museums & Learning', 'Arts & Performance'],
  heritage: ['Heritage & Landmarks'],
  music: ['Arts & Performance'],
  books: ['Museums & Learning'],
  outdoors: ['Adventure & Games'],
  wellness: [],
  shopping: ['Markets & Shopping'],
  all: null
};

export function normalizeVenueName(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function categorySpecificMatch(row, categoryId) {
  const name = String(row['Place name'] || '').toLowerCase();
  const text = `${name} ${row.Description || ''} ${row['Mood fit (editorial)'] || ''}`.toLowerCase();
  const southIndian = /south indian|dosa|idli|tiffin|thindi|udupi|darshini|filter coffee|karnataka meal|karnataka cuisine|bisi bele|ragi mudde|military hotel/;
  const bakery = /bakery|baker|bakehouse|patisserie|pastry|dessert|ice cream|sweet shop|cake shop/;
  const genericCafeBakeryCopy = /cafe or bakery option|coffee, tea, light bite or dessert break/;
  const clearBakeryName = /bakery|bakehouse|patisserie|dessert|ice cream|sweet shop|cake shop/.test(name);
  const clearBakeryDescription = bakery.test(text) && !genericCafeBakeryCopy.test(text);
  if (categoryId === 'south-indian') return southIndian.test(text);
  if (categoryId === 'global-food') {
    const cafeOrDessert = /\bcaf[eé]\b|coffee|tea room|roastery|bakery|baker|bakehouse|patisserie|dessert|ice cream|sweet shop|cake shop/;
    return !southIndian.test(text) && !cafeOrDessert.test(text);
  }
  if (categoryId === 'coffee') return !(clearBakeryName || clearBakeryDescription);
  if (categoryId === 'bakeries') return clearBakeryName || clearBakeryDescription;
  if (categoryId === 'art') return /art|museum|gallery|theatre|theater|performance|culture|craft|exhibit|cinema|learning/.test(text);
  if (categoryId === 'books') return /book|library|reading|literary/.test(text);
  if (categoryId === 'music') return /music|concert|gig|performance|live show/.test(text);
  if (categoryId === 'shopping') return !/\bmall\b|shopping centre|shopping center/i.test(name)
    || /market|craft|design|handicraft|boutique|independent shop/i.test(text);
  return true;
}

export async function catalogCandidates(categoryId = 'all', search = '') {
  const rows = await loadRows();
  const allowed = categoryMap[categoryId];
  if (allowed === undefined) throw new Error('Choose one of the available discovery categories.');
  const query = normalizeVenueName(search);
  const eligible = rows.filter(row => (!allowed || allowed.includes(row.Category))
    && (!allowed || categorySpecificMatch(row, categoryId)));
  if (!query) return eligible;
  const nameMatches = eligible.filter(row => normalizeVenueName(row['Place name']).includes(query));
  if (nameMatches.length) return nameMatches;
  const areaMatches = eligible.filter(row => normalizeVenueName(row['Neighbourhood / area']).includes(query));
  if (areaMatches.length) return areaMatches;
  return eligible.filter(row => normalizeVenueName(`${row.Description} ${row['Mood fit (editorial)']} ${row['Ambience (editorial)']}`).includes(query));
}

export function enrichFromCatalog(place, candidates) {
  const comparableName = value => normalizeVenueName(value)
    .replace(/\b(bengaluru|bangalore|india)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const name = comparableName(place?.name);
  if (!name) return null;
  const matches = candidates.filter(row => {
    const candidateName = comparableName(row['Place name']);
    const withoutParenthetical = comparableName(String(row['Place name']).replace(/\([^)]*\)/g, ' '));
    return candidateName === name || withoutParenthetical === name;
  });
  if (!matches.length) return null;
  const qlooAddress = normalizeVenueName(typeof place.properties?.address === 'string'
    ? place.properties.address
    : [place.properties?.geocode?.neighborhood, place.properties?.geocode?.locality].filter(Boolean).join(' '));
  const areaMatches = matches.filter(row => {
    const area = normalizeVenueName(row['Neighbourhood / area']);
    return qlooAddress && area && (qlooAddress.includes(area) || area.includes(qlooAddress));
  });
  const match = areaMatches[0] || (matches.length === 1 ? matches[0] : null);
  if (!match) {
    return {
      ...place,
      catalog: {
        verification: 'Qloo matched this venue name, but the catalogue has multiple Bengaluru branches and the returned location did not identify one. Check the branch details before visiting.'
      }
    };
  }
  return {
    ...place,
    catalog: {
      category: match.Category,
      area: match['Neighbourhood / area'],
      description: match.Description,
      mood: match['Mood fit (editorial)'],
      ambience: match['Ambience (editorial)'],
      groupSize: match['Suggested group size (editorial)'],
      pricing: match['Indicative pricing'],
      pricingNote: match['Pricing basis / caveat'],
      researchSource: match['Research source'],
      venueLookup: match['Venue lookup'],
      verification: match['Verification status']
    }
  };
}
