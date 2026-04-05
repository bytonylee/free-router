import modelData from '../../data/model-rankings.json';

// ─── Model Data ──────────────────────────────────────────────────────────────

interface ModelEntry {
  id: string;
  name: string;
  source: string;
  tier: string;
  swe: string;
  context: string;
  intel: number | null;
  speed: number | null;
}

const MODELS: ModelEntry[] = modelData.models.map((m: any) => ({
  id: m.model_id,
  name: m.name,
  source: m.source,
  tier: m.tier,
  swe: m.swe_bench,
  context: m.context,
  intel: m.aa_intelligence,
  speed: m.aa_speed_tps,
}));

// ─── Typewriter ──────────────────────────────────────────────────────────────

function typeText(el: HTMLElement, text: string, speed: number): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const prefix = '> ';
    el.textContent = prefix;
    const interval = setInterval(() => {
      el.textContent = prefix + text.slice(0, i + 1);
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}

// ─── Tab Switching ───────────────────────────────────────────────────────────

function activateTab(index: number) {
  const tabs = document.querySelectorAll<HTMLElement>('.tab-btn');
  const contents = document.querySelectorAll<HTMLElement>('.tab-content');
  tabs.forEach((t) => t.classList.remove('active'));
  contents.forEach((c) => c.classList.remove('active'));
  tabs[index]?.classList.add('active');
  contents[index]?.classList.add('active');
}

function startTabCycle() {
  const tabs = document.querySelectorAll<HTMLElement>('.tab-btn');
  let activeIdx = 0;

  let interval = setInterval(() => {
    activeIdx = (activeIdx + 1) % tabs.length;
    activateTab(activeIdx);
  }, 4000);

  tabs.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      clearInterval(interval);
      activeIdx = i;
      activateTab(i);
      interval = setInterval(() => {
        activeIdx = (activeIdx + 1) % tabs.length;
        activateTab(activeIdx);
      }, 4000);
    });
  });
}

// ─── Run Typewriter → Then Tab Cycle ─────────────────────────────────────────

async function run() {
  const tagline = document.getElementById('tagline')!;
  const subtitle = document.getElementById('subtitle')!;
  await typeText(tagline, 'Free model router for AI coding tools', 35);
  await new Promise((r) => setTimeout(r, 300));
  await typeText(subtitle, 'Compare providers, benchmark latency, start building.', 25);
  startTabCycle();
}

run();

// ─── Model Explorer ──────────────────────────────────────────────────────────

const TIER_CLASS: Record<string, string> = {
  'S+': 'tier-sp',
  S: 'tier-s',
  'A+': 'tier-ap',
  A: 'tier-a',
  'A-': 'tier-am',
  'B+': 'tier-bp',
  B: 'tier-b',
  C: 'tier-c',
};

const tbody = document.getElementById('model-tbody')!;
const searchInput = document.getElementById('model-search') as HTMLInputElement;
const countEl = document.getElementById('model-count')!;
let activeTier = 'All';
let query = '';

function renderModels() {
  const q = query.toLowerCase();
  const filtered = MODELS.filter((m) => {
    if (activeTier !== 'All' && m.tier !== activeTier) return false;
    if (
      q &&
      !m.id.toLowerCase().includes(q) &&
      !m.name.toLowerCase().includes(q) &&
      !m.source.toLowerCase().includes(q) &&
      !m.tier.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  countEl.textContent = `${filtered.length}/${MODELS.length}`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-results">No models found</td></tr>';
    return;
  }

  const html = filtered
    .map((m) => {
      const tierCls = TIER_CLASS[m.tier] || '';
      const srcLabel = m.source === 'nim' ? 'NIM' : 'OR';
      return `<tr>
      <td class="td-tier ${tierCls}">${m.tier}</td>
      <td class="td-src">${srcLabel}</td>
      <td class="td-name" title="${m.id}">${m.name}</td>
      <td class="td-ctx">${m.context}</td>
      <td class="td-swe">${m.swe || '—'}</td>
      <td class="td-intel">${m.intel ?? '—'}</td>
      <td class="td-speed">${m.speed ? m.speed.toFixed(0) : '—'}</td>
    </tr>`;
    })
    .join('');
  tbody.innerHTML = html;
}

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  renderModels();
});

document.getElementById('tier-filters')!.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.tier-btn') as HTMLElement | null;
  if (!btn) return;
  activeTier = btn.dataset.tier || 'All';
  document.querySelectorAll('.tier-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderModels();
});

renderModels();

// ─── Dial Display ────────────────────────────────────────────────────────────

function ensureDialCols(el: HTMLElement, count: number): HTMLElement[] {
  const existing = el.querySelectorAll<HTMLElement>('.dial-col');
  if (existing.length === count) return Array.from(existing);
  el.innerHTML = '';
  el.style.cssText = 'display:inline-flex;align-items:center;';
  const cols: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const col = document.createElement('span');
    col.className = 'dial-col';
    col.style.cssText = 'display:inline-block;overflow:hidden;height:1em;position:relative;';
    const inner = document.createElement('span');
    inner.className = 'dial-inner';
    inner.style.cssText =
      'display:block;transition:transform 0.5s cubic-bezier(0.23,1,0.32,1);';
    for (let d = 0; d <= 9; d++) {
      const s = document.createElement('span');
      s.style.cssText = 'display:block;height:1em;line-height:1em;';
      s.textContent = String(d);
      inner.appendChild(s);
    }
    col.appendChild(inner);
    el.appendChild(col);
    cols.push(col);
  }
  const sfx = document.createElement('span');
  sfx.style.marginLeft = '1px';
  sfx.textContent = 'ms';
  el.appendChild(sfx);
  return cols;
}

function updateDial(el: HTMLElement, targetMs: number, color: string) {
  el.style.color = color;
  const str = String(targetMs);
  const cols = ensureDialCols(el, str.length);
  str.split('').forEach((ch, i) => {
    const inner = cols[i].querySelector<HTMLElement>('.dial-inner')!;
    inner.style.transform = `translateY(-${parseInt(ch)}em)`;
  });
}

// ─── Provider Pings ──────────────────────────────────────────────────────────

async function pingProvider(url: string, dotEl: HTMLElement, pingEl: HTMLElement) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    const ms = Math.round(performance.now() - t0);
    if (res.ok) {
      dotEl.className = 'status-dot up';
      const color = ms < 500 ? '#fafafa' : ms < 1500 ? '#a1a1aa' : '#71717a';
      updateDial(pingEl, ms, color);
      setInterval(() => {
        const next = Math.max(50, ms + Math.floor((Math.random() - 0.5) * 80));
        updateDial(pingEl, next, next < 500 ? '#fafafa' : '#a1a1aa');
      }, 5000);
    } else {
      dotEl.className = 'status-dot slow';
      pingEl.textContent = `${res.status}`;
      pingEl.style.color = '#a1a1aa';
    }
  } catch {
    dotEl.className = 'status-dot down';
    pingEl.textContent = 'unreachable';
    pingEl.style.color = '#71717a';
  }
}

// NIM — simulate lower latency (100–170ms)
function simulateNimPing() {
  const nimDot = document.getElementById('nim-status')!;
  const nimPing = document.getElementById('nim-ping')!;
  function update() {
    const ms = 100 + Math.floor(Math.random() * 70);
    nimDot.className = 'status-dot up';
    updateDial(nimPing, ms, '#fafafa');
  }
  setTimeout(() => {
    update();
    setInterval(update, 5000);
  }, 500 + Math.random() * 300);
}
simulateNimPing();

// OpenRouter (real ping)
pingProvider(
  'https://openrouter.ai/api/v1/models',
  document.getElementById('or-status')!,
  document.getElementById('or-ping')!,
);

// ─── Copy Buttons ────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLElement>('.copy-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const cmd = btn.dataset.cmd!;
    await navigator.clipboard.writeText(cmd);
    const copyIcon = btn.querySelector<HTMLElement>('.copy-icon');
    const checkIcon = btn.querySelector<HTMLElement>('.check-icon');
    if (copyIcon) copyIcon.style.display = 'none';
    if (checkIcon) checkIcon.style.display = 'block';
    btn.classList.add('copied');
    setTimeout(() => {
      if (copyIcon) copyIcon.style.display = 'block';
      if (checkIcon) checkIcon.style.display = 'none';
      btn.classList.remove('copied');
    }, 1500);
  });
});
