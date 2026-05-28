'use strict';

// ===== State =====
const state = {
  currentStep: 1,
  passwords: [],
  filtered: [],
  page: 1,
  perPage: 50,
  sortMode: 'likely',
  filterMode: 'all',
  showPasswords: false,
};

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
  initDayMonthSelects();
  initTypewriter();
  initTheme();
  setupModal();
  updateLengthDisplay();

  document.getElementById('searchInput')?.addEventListener('input', applyFilters);
});

// ===== Day/Month Selects =====
function initDayMonthSelects() {
  const dayEl = document.getElementById('birthDay');
  const monthEl = document.getElementById('birthMonth');
  if (!dayEl || !monthEl) return;

  dayEl.innerHTML = '<option value="">-- Day --</option>';
  for (let i = 1; i <= 31; i++) {
    dayEl.innerHTML += `<option value="${i}">${i}</option>`;
  }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  monthEl.innerHTML = '<option value="">-- Month --</option>';
  months.forEach((m, i) => {
    monthEl.innerHTML += `<option value="${i+1}">${m}</option>`;
  });
}

// ===== Typewriter =====
function initTypewriter() {
  const el = document.getElementById('typewriter');
  if (!el) return;
  const phrases = [
    "Let's figure it out.",
    "We'll help you find it.",
    "Smart recovery starts here.",
    "Your answer is in here.",
  ];
  let pi = 0, ci = 0, deleting = false, delay = 80;

  function tick() {
    const current = phrases[pi];
    if (!deleting) {
      el.textContent = current.slice(0, ci + 1);
      ci++;
      if (ci === current.length) { deleting = true; delay = 2400; }
      else delay = 80;
    } else {
      el.textContent = current.slice(0, ci - 1);
      ci--;
      if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 300; }
      else delay = 45;
    }
    setTimeout(tick, delay);
  }
  setTimeout(tick, 800);
}

// ===== Theme =====
function initTheme() {
  const saved = localStorage.getItem('pp-theme') || 'dark';
  setTheme(saved);
}
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeIcon').textContent = t === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('pp-theme', t);
}
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : 'dark');
});

// ===== Modal =====
function setupModal() {
  const modal = document.getElementById('disclaimerModal');
  const accept = document.getElementById('modalAccept');
  if (!modal || !accept) return;
  if (localStorage.getItem('pp-accepted')) {
    modal.style.display = 'none';
    return;
  }
  accept.addEventListener('click', () => {
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s ease';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
    localStorage.setItem('pp-accepted', '1');
  });
}

// ===== Step Navigation =====
function goToStep(n) {
  if (n < 1 || n > 3) return;
  const prev = state.currentStep;
  state.currentStep = n;

  // Show/hide cards
  for (let i = 1; i <= 3; i++) {
    const card = document.getElementById(`step${i}`);
    if (!card) continue;
    if (i === n) {
      card.classList.remove('hidden');
      card.removeAttribute('data-active');
      void card.offsetWidth;
      card.setAttribute('data-active', 'true');
    } else {
      card.classList.add('hidden');
    }
  }

  // Update progress steps
  for (let i = 1; i <= 4; i++) {
    const ps = document.querySelector(`.ps[data-step="${i}"]`);
    if (!ps) continue;
    ps.classList.remove('active', 'done');
    if (i < n) ps.classList.add('done');
    else if (i === n) ps.classList.add('active');
  }

  // Update connector lines
  for (let i = 1; i <= 3; i++) {
    const line = document.getElementById(`line-${i}-${i+1}`);
    if (!line) continue;
    line.classList.toggle('filled', i < n);
  }

  window.scrollTo({ top: document.getElementById('mainTool')?.offsetTop - 80, behavior: 'smooth' });
}

// ===== Length Display =====
function updateLengthDisplay() {
  const minEl = document.getElementById('minLength');
  const maxEl = document.getElementById('maxLength');
  const display = document.getElementById('lengthDisplay');
  if (!minEl || !maxEl || !display) return;
  let min = parseInt(minEl.value);
  let max = parseInt(maxEl.value);
  if (min > max) { [min, max] = [max, min]; }
  display.textContent = `${min} – ${max}`;
}

// ===== Collect Form Data =====
function collectTraits() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  return {
    firstName: g('firstName'),
    lastName: g('lastName'),
    nickname: g('nickname'),
    city: g('city'),
    birthDay: g('birthDay'),
    birthMonth: g('birthMonth'),
    birthYear: g('birthYear'),
    school: g('school'),
    pets: g('pets'),
    partner: g('partner'),
    family: g('family'),
    friends: g('friends'),
    partialPassword: g('partialPassword'),
    favoriteWords: g('favoriteWords'),
    commonNumbers: g('commonNumbers'),
    commonSymbols: g('commonSymbols'),
    knownPasswords: g('knownPasswords'),
  };
}
function collectOptions() {
  const cb = id => document.getElementById(id)?.checked ?? true;
  let min = parseInt(document.getElementById('minLength')?.value || 6);
  let max = parseInt(document.getElementById('maxLength')?.value || 20);
  if (min > max) [min, max] = [max, min];
  return {
    leet: cb('optLeet'),
    commonSuffix: cb('optCommonSuffix'),
    yearVariants: cb('optYearVariants'),
    twoWord: cb('optTwoWord'),
    reverse: cb('optReverse'),
    minLength: min,
    maxLength: max,
  };
}

// ===== Password Engine =====
class PasswordEngine {
  constructor(traits, options) {
    this.traits = traits;
    this.options = options;
  }

  splitList(str) {
    if (!str) return [];
    return str.split(/[,;，]+/).map(s => s.trim()).filter(s => s.length > 1);
  }

  getBaseWords() {
    const t = this.traits;
    const raw = [];
    if (t.firstName) raw.push(t.firstName);
    if (t.lastName) raw.push(t.lastName);
    this.splitList(t.nickname).forEach(w => raw.push(w));
    if (t.city) raw.push(t.city);
    if (t.school) raw.push(t.school.split(/\s+/)[0]); // first word only
    this.splitList(t.pets).forEach(w => raw.push(w));
    this.splitList(t.partner).forEach(w => raw.push(w));
    this.splitList(t.family).forEach(w => raw.push(w));
    this.splitList(t.friends).forEach(w => raw.push(w));
    this.splitList(t.favoriteWords).forEach(w => raw.push(w));
    this.splitList(t.knownPasswords).forEach(w => raw.push(w));
    return [...new Set(raw.filter(w => w && w.length >= 2))];
  }

  caseVariants(word) {
    const lo = word.toLowerCase();
    const up = word.toUpperCase();
    const title = lo[0].toUpperCase() + lo.slice(1);
    const variants = new Set([lo, up, title]);
    if (lo.length >= 4) {
      variants.add(lo[0].toUpperCase() + lo.slice(1, -1) + lo.slice(-1).toUpperCase());
    }
    return [...variants];
  }

  leet(word) {
    return word.toLowerCase()
      .replace(/a/g, '@').replace(/e/g, '3').replace(/i/g, '1')
      .replace(/o/g, '0').replace(/s/g, '$').replace(/l/g, '1').replace(/t/g, '7');
  }

  allVariants(word) {
    const vs = new Set(this.caseVariants(word));
    if (this.options.leet) {
      const l = this.leet(word);
      if (l !== word.toLowerCase()) vs.add(l);
    }
    if (this.options.reverse) {
      const rev = word.toLowerCase().split('').reverse().join('');
      const revT = rev[0].toUpperCase() + rev.slice(1);
      vs.add(rev);
      vs.add(revT);
    }
    return [...vs];
  }

  dateCombos() {
    const { birthDay: bD, birthMonth: bM, birthYear: bY } = this.traits;
    if (!bD && !bM && !bY) return [];
    const DD = bD ? String(bD).padStart(2,'0') : null;
    const D  = bD ? String(parseInt(bD)) : null;
    const MM = bM ? String(bM).padStart(2,'0') : null;
    const M  = bM ? String(parseInt(bM)) : null;
    const YYYY = bY || null;
    const YY = bY ? String(bY).slice(-2) : null;

    const c = new Set();
    [DD, D, MM, M, YYYY, YY].forEach(x => x && c.add(x));
    if (DD && MM) { c.add(DD+MM); c.add(MM+DD); }
    if (DD && MM && YYYY) {
      c.add(DD+MM+YYYY); c.add(MM+DD+YYYY); c.add(YYYY+MM+DD); c.add(YYYY+DD+MM);
    }
    if (DD && MM && YY) { c.add(DD+MM+YY); c.add(MM+DD+YY); }
    if (YYYY && MM) { c.add(YYYY+MM); c.add(MM+YYYY); }
    if (YYYY && DD) { c.add(YYYY+DD); c.add(DD+YYYY); }
    return [...c];
  }

  numberTokens() {
    const toks = new Set(this.dateCombos());
    this.splitList(this.traits.commonNumbers).forEach(n => toks.add(n));
    ['123','1234','12345','123456','321','007','000','111','1111','786','99','100','69','420'].forEach(n => toks.add(n));
    if (this.options.yearVariants) {
      ['2024','2025','2026','2023','2022','2021','2020','2019','2018'].forEach(n => toks.add(n));
    }
    return [...toks];
  }

  symbolTokens() {
    if (!this.options.commonSuffix) return [''];
    const s = ['','!','@','#','.','_','-','*','!!','!@','123!','@123','1','12'];
    this.splitList(this.traits.commonSymbols).filter(sym => sym.length <= 3 && /[^a-zA-Z0-9]/.test(sym)).forEach(sym => s.push(sym));
    return [...new Set(s)];
  }

  score(pw) {
    let s = 0;
    const pl = pw.toLowerCase();
    const t = this.traits;

    if (t.firstName && pl.includes(t.firstName.toLowerCase())) s += 10;
    if (t.lastName  && pl.includes(t.lastName.toLowerCase()))  s += 8;
    this.splitList(t.nickname).forEach(n => { if (pl.includes(n.toLowerCase())) s += 9; });
    this.splitList(t.pets).forEach(p => { if (pl.includes(p.toLowerCase())) s += 7; });
    this.splitList(t.partner).forEach(p => { if (pl.includes(p.toLowerCase())) s += 6; });

    if (t.birthYear) {
      if (pl.includes(String(t.birthYear))) s += 9;
      const yy = String(t.birthYear).slice(-2);
      if (pl.endsWith(yy)) s += 4;
    }
    if (t.birthDay && t.birthMonth) {
      const dd = String(t.birthDay).padStart(2,'0') + String(t.birthMonth).padStart(2,'0');
      if (pl.includes(dd)) s += 6;
    }

    if (/123$/.test(pw)) s += 5;
    if (/!$/.test(pw))   s += 4;
    if (/\d{4}$/.test(pw)) s += 3;
    if (pw.length >= 6 && pw.length <= 12) s += 2;
    s -= Math.max(0, pw.length - 14) * 2;

    this.splitList(t.knownPasswords).forEach(kp => {
      if (pl === kp.toLowerCase()) s += 25;
      else if (pl.startsWith(kp.toLowerCase())) s += 15;
    });
    if (t.partialPassword && t.partialPassword.length > 1) {
      if (pl.includes(t.partialPassword.toLowerCase())) s += 14;
      if (pl.startsWith(t.partialPassword.toLowerCase())) s += 5;
    }
    return s;
  }

  generate() {
    const bases = this.getBaseWords();
    const nums = this.numberTokens();
    const syms = this.symbolTokens();
    const { minLength: minL, maxLength: maxL } = this.options;
    const results = new Set();

    const add = pw => {
      if (pw.length >= minL && pw.length <= maxL) results.add(pw);
    };

    const limitedNums = nums.slice(0, 40);
    const limitedSyms = syms.slice(0, 12);

    for (const base of bases) {
      const vs = this.allVariants(base);
      for (const v of vs) {
        add(v);

        const partial = this.traits.partialPassword?.trim();
        if (partial && partial.length > 0) {
          add(partial + v);
          add(v + partial);
          limitedNums.slice(0,20).forEach(n => add(partial + v + n));
        }

        for (const num of limitedNums) {
          add(v + num);
          add(num + v);
          for (const sym of limitedSyms) {
            if (sym) { add(v + num + sym); add(v + sym + num); }
          }
        }

        for (const sym of limitedSyms) {
          if (sym) add(v + sym);
        }
      }
    }

    if (this.options.twoWord && bases.length >= 2) {
      const cb = bases.slice(0, 7);
      for (let i = 0; i < cb.length; i++) {
        for (let j = 0; j < cb.length; j++) {
          if (i === j) continue;
          const a = cb[i], b = cb[j];
          const lo = a.toLowerCase() + b.toLowerCase();
          const ti = (a[0].toUpperCase()+a.slice(1).toLowerCase()) + (b[0].toUpperCase()+b.slice(1).toLowerCase());
          add(lo); add(ti);
          limitedNums.slice(0,18).forEach(n => { add(lo+n); add(ti+n); });
          limitedSyms.slice(0,6).forEach(s => { if (s) { add(ti+s); add(lo+s); } });
        }
      }
    }

    this.splitList(this.traits.knownPasswords).forEach(kp => {
      add(kp);
      limitedNums.slice(0,15).forEach(n => {
        add(kp + n);
        const stripped = kp.replace(/\d+$/, '');
        if (stripped && stripped !== kp) add(stripped + n);
      });
      limitedSyms.slice(0,6).forEach(s => { if (s) add(kp + s); });
    });

    const arr = [...results];
    const scored = arr.map(pw => ({ pw, score: this.score(pw) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.pw);
  }
}

// ===== Strength =====
function passwordStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  if (s <= 2) return { label: 'Weak', cls: 'strength-weak' };
  if (s <= 3) return { label: 'Fair', cls: 'strength-fair' };
  if (s <= 4) return { label: 'Good', cls: 'strength-good' };
  return { label: 'Strong', cls: 'strength-strong' };
}

// ===== Generate Passwords =====
async function generatePasswords() {
  const traits = collectTraits();
  const options = collectOptions();

  const hasInput = Object.values(traits).some(v => v && v.length > 0);
  if (!hasInput) {
    showToast('Please fill in at least one field first!', '⚠️', 'error');
    return;
  }

  // Mark step 4 active
  for (let i = 1; i <= 4; i++) {
    const ps = document.querySelector(`.ps[data-step="${i}"]`);
    if (!ps) continue;
    ps.classList.remove('active', 'done');
    if (i < 4) ps.classList.add('done');
    else ps.classList.add('active');
  }
  for (let i = 1; i <= 3; i++) {
    const line = document.getElementById(`line-${i}-${i+1}`);
    if (line) line.classList.add('filled');
  }

  // Hide step 3, show generating
  document.getElementById('step3').classList.add('hidden');
  const genCard = document.getElementById('generatingCard');
  genCard.classList.remove('hidden');

  // Animate progress bar
  const bar = document.getElementById('genBar');
  const status = document.getElementById('genStatus');
  const steps = [
    [20, 'Collecting your personal patterns...'],
    [45, 'Building word variants and combinations...'],
    [65, 'Generating date and number combos...'],
    [82, 'Applying leet speak and symbol patterns...'],
    [95, 'Ranking by likelihood...'],
  ];

  for (const [w, msg] of steps) {
    bar.style.width = w + '%';
    status.textContent = msg;
    await delay(280);
  }

  // Run engine
  const engine = new PasswordEngine(traits, options);
  const passwords = engine.generate();

  bar.style.width = '100%';
  status.textContent = 'Done!';
  await delay(300);

  state.passwords = passwords;
  state.filtered = passwords;
  state.page = 1;
  state.sortMode = 'likely';
  state.filterMode = 'all';
  state.showPasswords = false;

  genCard.classList.add('hidden');
  const resCard = document.getElementById('resultsCard');
  resCard.classList.remove('hidden');

  animateCounter(passwords.length);
  renderList();
  renderPagination();
  fireConfetti();

  resCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Counter Animation =====
function animateCounter(target) {
  const el = document.getElementById('countNum');
  if (!el) return;
  let current = 0;
  const increment = Math.max(1, Math.ceil(target / 60));
  const interval = setInterval(() => {
    current = Math.min(current + increment, target);
    el.textContent = current.toLocaleString();
    if (current >= target) clearInterval(interval);
  }, 18);
}

// ===== Render List =====
function renderList() {
  const list = document.getElementById('pwList');
  if (!list) return;
  const start = (state.page - 1) * state.perPage;
  const end = start + state.perPage;
  const page = state.filtered.slice(start, end);

  if (page.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No passwords match your filter.</div>`;
    return;
  }

  list.innerHTML = page.map((pw, i) => {
    const rank = start + i + 1;
    const str = passwordStrength(pw);
    return `
      <div class="pw-item">
        <span class="pw-rank">#${rank}</span>
        <span class="pw-text${state.showPasswords ? ' visible' : ''}" onclick="toggleSingleVisibility(this)">${escHtml(pw)}</span>
        <span class="pw-strength ${str.cls}">${str.label}</span>
        <button class="pw-copy-btn" onclick="copyPassword('${escAttr(pw)}')" title="Copy password">📋</button>
      </div>`;
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(s) {
  return s.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
}

// ===== Render Pagination =====
function renderPagination() {
  const wrap = document.getElementById('paginationWrap');
  if (!wrap) return;
  const total = Math.ceil(state.filtered.length / state.perPage);
  if (total <= 1) { wrap.innerHTML = ''; return; }

  const showing = `Showing ${(state.page-1)*state.perPage + 1}–${Math.min(state.page*state.perPage, state.filtered.length)} of ${state.filtered.length.toLocaleString()}`;

  let html = `<span class="page-info">${showing}</span>`;
  html += `<button class="page-btn" onclick="changePage(${state.page-1})" ${state.page===1?'disabled':''}>← Prev</button>`;

  const range = pageRange(state.page, total);
  range.forEach(p => {
    if (p === '...') html += `<span class="page-info">…</span>`;
    else html += `<button class="page-btn${p===state.page?' active':''}" onclick="changePage(${p})">${p}</button>`;
  });

  html += `<button class="page-btn" onclick="changePage(${state.page+1})" ${state.page===total?'disabled':''}>Next →</button>`;
  wrap.innerHTML = html;
}

function pageRange(cur, total) {
  if (total <= 7) return Array.from({length: total}, (_,i) => i+1);
  const r = [];
  if (cur <= 4) {
    for (let i = 1; i <= 5; i++) r.push(i);
    r.push('...', total);
  } else if (cur >= total - 3) {
    r.push(1, '...');
    for (let i = total-4; i <= total; i++) r.push(i);
  } else {
    r.push(1, '...', cur-1, cur, cur+1, '...', total);
  }
  return r;
}

function changePage(p) {
  const total = Math.ceil(state.filtered.length / state.perPage);
  if (p < 1 || p > total) return;
  state.page = p;
  renderList();
  renderPagination();
  document.getElementById('resultsCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Filters / Sort =====
function applyFilters() {
  let pw = [...state.passwords];
  const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
  if (q) pw = pw.filter(p => p.toLowerCase().includes(q));

  if (state.filterMode === 'hasNum') pw = pw.filter(p => /\d/.test(p));
  if (state.filterMode === 'hasSym') pw = pw.filter(p => /[^a-zA-Z0-9]/.test(p));

  if (state.sortMode === 'length') pw.sort((a, b) => a.length - b.length);
  else if (state.sortMode === 'alpha') pw.sort((a, b) => a.localeCompare(b));

  state.filtered = pw;
  state.page = 1;
  renderList();
  renderPagination();
}

function setSortMode(el, mode) {
  document.querySelectorAll('[data-sort]').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  state.sortMode = mode;
  applyFilters();
}

function setFilterMode(el, mode) {
  document.querySelectorAll('[data-filter]').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  state.filterMode = mode;
  applyFilters();
}

// ===== Visibility =====
function toggleAllVisibility() {
  state.showPasswords = !state.showPasswords;
  const btn = document.getElementById('visibilityBtn');
  if (btn) btn.innerHTML = `<span id="visIcon">${state.showPasswords ? '🙈' : '👁️'}</span> ${state.showPasswords ? 'Hide' : 'Show'}`;
  document.querySelectorAll('.pw-text').forEach(el => {
    el.classList.toggle('visible', state.showPasswords);
  });
}

function toggleSingleVisibility(el) {
  el.classList.toggle('visible');
}

// ===== Copy / Download =====
function copyPassword(pw) {
  navigator.clipboard.writeText(pw).then(() => {
    showToast('Password copied!', '📋', 'success');
  }).catch(() => showToast('Could not copy', '⚠️', 'error'));
}

function copyAll() {
  const text = state.filtered.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied ${state.filtered.length.toLocaleString()} passwords!`, '📋', 'success');
  }).catch(() => showToast('Could not copy', '⚠️', 'error'));
}

function downloadPasswords() {
  if (!state.passwords.length) return;
  const header = `Pass Predictor — Generated Passwords\nGenerated: ${new Date().toLocaleString()}\nTotal: ${state.filtered.length}\n\n`;
  const text = header + state.filtered.join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pass-predictor-results.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${state.filtered.length.toLocaleString()} passwords`, '⬇️', 'success');
}

// ===== Reset =====
function resetTool() {
  document.getElementById('resultsCard')?.classList.add('hidden');
  document.getElementById('generatingCard')?.classList.add('hidden');
  document.getElementById('step3')?.classList.remove('hidden');
  state.passwords = [];
  state.filtered = [];
  state.page = 1;
  goToStep(3);
  document.getElementById('mainTool')?.scrollIntoView({ behavior: 'smooth' });
}

// ===== Toast =====
function showToast(msg, icon = 'ℹ️', type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ===== Accordion =====
function toggleAccordion(btn) {
  const body = btn.nextElementSibling;
  const isOpen = btn.classList.contains('open');
  document.querySelectorAll('.acc-btn.open').forEach(b => {
    b.classList.remove('open');
    b.nextElementSibling?.classList.remove('open');
  });
  if (!isOpen) {
    btn.classList.add('open');
    body?.classList.add('open');
  }
}

// ===== Confetti =====
function fireConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const particles = [];
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#f87171'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.angle += p.spin;
      p.opacity -= 0.008;
      if (p.opacity <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size/2, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    });
    frame++;
    if (frame < 200) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}
