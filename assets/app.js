'use strict';

const S = {
  scored: [],
  filtered: [],
  page: 1,
  perPage: 50,
  sortMode: 'likely',
  filterMode: 'all',
  showAll: false,
  running: false,
  counterId: null,
};

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
  populateDateSelects();
  initTheme();
  checkSession();
  bindEvents();
  bindLivePreview();
  updateLengthDisplay();
  initScrollReveal();
});

// ===== Date Selects =====
function populateDateSelects() {
  const dayEl = document.getElementById('birthDay');
  const monEl = document.getElementById('birthMonth');
  if (!dayEl || !monEl) return;
  dayEl.innerHTML = '<option value="">Day</option>';
  for (let i = 1; i <= 31; i++) dayEl.innerHTML += `<option value="${i}">${i}</option>`;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  monEl.innerHTML = '<option value="">Month</option>';
  months.forEach((m, i) => { monEl.innerHTML += `<option value="${i+1}">${m}</option>`; });
}

// ===== Theme =====
function initTheme() {
  const saved = localStorage.getItem('pp-theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pp-theme', next);
}

// ===== Session =====
function saveSession() {
  const data = collectTraits();
  if (!Object.values(data).some(v => v && v.length)) return;
  localStorage.setItem('pp-session', JSON.stringify({ data, ts: Date.now() }));
}

function checkSession() {
  const raw = localStorage.getItem('pp-session');
  if (!raw) return;
  try {
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 7 * 86400000) { localStorage.removeItem('pp-session'); return; }
    const dateStr = new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const banner = document.getElementById('sessionBanner');
    const dateEl = document.getElementById('sessionDate');
    if (!banner || !dateEl) return;
    dateEl.textContent = dateStr;
    banner.classList.remove('hidden');
    document.getElementById('sessionRestore').onclick = () => {
      restoreSession(data);
      banner.classList.add('hidden');
    };
    document.getElementById('sessionDiscard').onclick = () => {
      localStorage.removeItem('pp-session');
      banner.classList.add('hidden');
    };
  } catch(e) { localStorage.removeItem('pp-session'); }
}

function restoreSession(data) {
  const ids = ['firstName','lastName','nickname','city','birthDay','birthMonth','birthYear',
    'phoneLast4','school','pets','partner','family','friends','celebrity','sportsTeam',
    'startsWithField','containsField','endsWithField','favoriteWords','commonNumbers',
    'commonSymbols','knownPasswords'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && data[id]) el.value = data[id];
  });
  toast('Session restored', 'success');
}

// ===== Events =====
function bindEvents() {
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);

  document.getElementById('heroScroll')?.addEventListener('click', () => {
    document.getElementById('toolSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('stepTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-step]');
    if (btn) switchTab(parseInt(btn.dataset.step));
  });

  document.querySelector('.step-panels')?.addEventListener('click', e => {
    const next = e.target.closest('[data-next]');
    const prev = e.target.closest('[data-prev]');
    if (next) { saveSession(); switchTab(parseInt(next.dataset.next)); }
    if (prev) switchTab(parseInt(prev.dataset.prev));
  });

  document.getElementById('generateBtn')?.addEventListener('click', runGenerate);

  document.getElementById('minLen')?.addEventListener('input', updateLengthDisplay);
  document.getElementById('maxLen')?.addEventListener('input', updateLengthDisplay);

  document.getElementById('toggleVis')?.addEventListener('click', toggleVisibility);
  document.getElementById('copyAllBtn')?.addEventListener('click', copyAll);
  document.getElementById('exportTxt')?.addEventListener('click', () => exportFile('txt'));
  document.getElementById('exportCsv')?.addEventListener('click', () => exportFile('csv'));
  document.getElementById('resetBtn')?.addEventListener('click', resetTool);
  document.getElementById('searchInp')?.addEventListener('input', applyFilters);

  document.getElementById('sortChips')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-sort]');
    if (!chip) return;
    document.querySelectorAll('#sortChips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    S.sortMode = chip.dataset.sort;
    applyFilters();
  });

  document.getElementById('filterChips')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    document.querySelectorAll('#filterChips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    S.filterMode = chip.dataset.filter;
    applyFilters();
  });

  document.getElementById('pwTableBody')?.addEventListener('click', e => {
    const copyBtn = e.target.closest('.copy-cell-btn');
    const pwCell = e.target.closest('.pw-cell');
    const row = e.target.closest('tr[data-pw]');
    if (copyBtn) {
      const pw = copyBtn.closest('tr')?.dataset.pw;
      if (pw) copyPw(pw);
    } else if (pwCell) {
      pwCell.classList.toggle('vis');
    } else if (row && !copyBtn) {
      row.classList.toggle('tried');
    }
  });

  document.getElementById('pagination')?.addEventListener('click', e => {
    const btn = e.target.closest('.pg-btn');
    if (!btn || btn.disabled) return;
    const p = parseInt(btn.dataset.page);
    if (!isNaN(p)) changePage(p);
  });

  document.getElementById('serviceSelect')?.addEventListener('change', e => {
    if (document.getElementById('resultsWrap') && !document.getElementById('resultsWrap').classList.contains('hidden')) {
      updatePlatformNote(e.target.value);
    }
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!S.running) runGenerate();
    }
  });
}

// ===== Live Preview =====
function bindLivePreview() {
  const ids = ['firstName','lastName','nickname','city','birthYear','pets','partner',
               'family','celebrity','sportsTeam','favoriteWords','commonNumbers'];
  let timer;
  ids.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(updatePreview, 450);
    });
  });
}

function updatePreview() {
  const list = document.getElementById('previewList');
  if (!list) return;
  const traits = collectTraits();
  const opts = { leet: true, suffix: true, years: false, twoWord: false, reverse: false, keyboard: false, commonPwds: false, minLen: 6, maxLen: 16 };
  const engine = new PasswordEngine(traits, opts);
  const scored = engine.generate();
  if (!scored.length) {
    list.innerHTML = '<div class="preview-empty">Fill in the form below to see a live preview of likely passwords.</div>';
    return;
  }
  list.innerHTML = scored.slice(0, 8).map(({ pw }) => `<div class="preview-item">${escHtml(pw)}</div>`).join('');
}

// ===== Tab Navigation =====
function switchTab(idx) {
  document.querySelectorAll('.step-tab').forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
    btn.setAttribute('aria-selected', i === idx ? 'true' : 'false');
  });
  document.querySelectorAll('.step-panel').forEach((panel, i) => {
    panel.classList.toggle('active', i === idx);
  });
}

// ===== Scroll Reveal =====
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('revealed'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
}

// ===== Length Display =====
function updateLengthDisplay() {
  const minEl = document.getElementById('minLen');
  const maxEl = document.getElementById('maxLen');
  const valEl = document.getElementById('lengthVal');
  if (!minEl || !maxEl || !valEl) return;
  let min = parseInt(minEl.value), max = parseInt(maxEl.value);
  if (min > max) [min, max] = [max, min];
  valEl.textContent = `${min} – ${max} characters`;
}

// ===== Collect =====
function collectTraits() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  return {
    firstName: g('firstName'), lastName: g('lastName'), nickname: g('nickname'),
    city: g('city'), birthDay: g('birthDay'), birthMonth: g('birthMonth'),
    birthYear: g('birthYear'), phoneLast4: g('phoneLast4'), school: g('school'),
    pets: g('pets'), partner: g('partner'), family: g('family'), friends: g('friends'),
    celebrity: g('celebrity'), sportsTeam: g('sportsTeam'),
    startsWithField: g('startsWithField'), containsField: g('containsField'),
    endsWithField: g('endsWithField'), favoriteWords: g('favoriteWords'),
    commonNumbers: g('commonNumbers'), commonSymbols: g('commonSymbols'),
    knownPasswords: g('knownPasswords'),
  };
}

function collectOptions() {
  const cb = id => !!(document.getElementById(id)?.checked);
  let min = parseInt(document.getElementById('minLen')?.value || 6);
  let max = parseInt(document.getElementById('maxLen')?.value || 20);
  if (min > max) [min, max] = [max, min];
  return {
    leet: cb('optLeet'), suffix: cb('optSuffix'), years: cb('optYears'),
    twoWord: cb('optTwoWord'), reverse: cb('optReverse'),
    keyboard: cb('optKeyboard'), commonPwds: cb('optCommonPwds'),
    minLen: min, maxLen: max,
  };
}

// ===== Engine =====
class PasswordEngine {
  constructor(traits, opts) { this.t = traits; this.o = opts; }

  split(s) {
    if (!s) return [];
    return s.split(/[,;\s]+/).map(w => w.trim()).filter(w => w.length >= 2);
  }

  bases() {
    const t = this.t, raw = [];
    if (t.firstName) raw.push(t.firstName);
    if (t.lastName) raw.push(t.lastName);
    this.split(t.nickname).forEach(w => raw.push(w));
    if (t.city) raw.push(t.city.split(/\s+/)[0]);
    if (t.school) raw.push(t.school.split(/\s+/)[0]);
    this.split(t.pets).forEach(w => raw.push(w));
    this.split(t.partner).forEach(w => raw.push(w));
    this.split(t.family).forEach(w => raw.push(w));
    this.split(t.friends).forEach(w => raw.push(w));
    this.split(t.celebrity).forEach(w => raw.push(w));
    this.split(t.sportsTeam).forEach(w => raw.push(w));
    this.split(t.favoriteWords).forEach(w => raw.push(w));
    return [...new Set(raw.filter(w => w && w.length >= 2))];
  }

  caseVars(w) {
    const lo = w.toLowerCase(), up = w.toUpperCase();
    const ti = lo[0].toUpperCase() + lo.slice(1);
    const s = new Set([lo, up, ti]);
    if (lo.length >= 4) s.add(lo[0] + lo.slice(1, -1) + lo.slice(-1).toUpperCase());
    return [...s];
  }

  leet(w) {
    return w.toLowerCase()
      .replace(/a/g,'@').replace(/e/g,'3').replace(/i/g,'1')
      .replace(/o/g,'0').replace(/s/g,'$').replace(/l/g,'1').replace(/t/g,'7');
  }

  wordVars(w) {
    const s = new Set(this.caseVars(w));
    if (this.o.leet) { const l = this.leet(w); if (l !== w.toLowerCase()) s.add(l); }
    if (this.o.reverse) {
      const r = w.toLowerCase().split('').reverse().join('');
      s.add(r);
      if (r.length > 0) s.add(r[0].toUpperCase() + r.slice(1));
    }
    return [...s];
  }

  dateCombos() {
    const { birthDay: bD, birthMonth: bM, birthYear: bY } = this.t;
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
    if (DD && MM && YYYY) { c.add(DD+MM+YYYY); c.add(MM+DD+YYYY); c.add(YYYY+MM+DD); c.add(YYYY+DD+MM); }
    if (DD && MM && YY) { c.add(DD+MM+YY); c.add(MM+DD+YY); }
    if (YYYY && MM) { c.add(YYYY+MM); c.add(MM+YYYY); }
    if (YYYY && DD) { c.add(YYYY+DD); c.add(DD+YYYY); }
    return [...c];
  }

  nums() {
    const s = new Set(this.dateCombos());
    const ph = (this.t.phoneLast4 || '').replace(/\D/g,'');
    if (ph) s.add(ph);
    this.split(this.t.commonNumbers).forEach(n => s.add(n));
    ['123','1234','12345','123456','321','007','000','111','1111','786','99','69','100'].forEach(n => s.add(n));
    if (this.o.years) {
      ['2024','2025','2026','2023','2022','2021','2020','2019','2018','2017'].forEach(n => s.add(n));
    }
    return [...s];
  }

  syms() {
    if (!this.o.suffix) return [''];
    const s = new Set(['','!','@','#','.','_','-','*','!!','!@','123!','@123','1','12']);
    this.split(this.t.commonSymbols)
      .filter(sym => sym.length <= 3 && /[^a-zA-Z0-9]/.test(sym))
      .forEach(sym => s.add(sym));
    return [...s];
  }

  keyboardWalks() {
    return ['qwerty','asdf','asdfgh','zxcvbn','qwertyuiop','1234qwer',
            'qwerty123','password','passw0rd','letmein','iloveyou','abc123'];
  }

  commonPwdList() {
    return ['password','password123','123456','12345678','111111','1234567890',
            'sunshine','princess','dragon','master','login','welcome','monkey',
            'shadow','superman','batman','letmein','trustno1','abc123','pass123',
            'admin','test','secret','india123','india@123'];
  }

  patternOf(pw) {
    const hasUp = /[A-Z]/.test(pw), hasLo = /[a-z]/.test(pw);
    const hasNum = /\d/.test(pw), hasSym = /[^a-zA-Z0-9]/.test(pw);
    const isLeet = /[@$1037]/.test(pw);
    if (isLeet && hasNum) return 'Leet+num';
    if (isLeet) return 'Leet';
    if (hasUp && hasNum && hasSym) return 'Mix+sym';
    if (hasUp && hasNum) return 'Word+num';
    if (hasLo && hasNum && hasSym) return 'lower+sym';
    if (hasLo && hasNum) return 'lower+num';
    if (!hasLo && !hasUp && hasNum) return 'Numbers';
    if (!hasUp) return 'lowercase';
    if (!hasLo) return 'UPPER';
    return 'Mix';
  }

  score(pw) {
    let s = 0;
    const pl = pw.toLowerCase(), t = this.t;
    if (t.firstName && pl.includes(t.firstName.toLowerCase())) s += 10;
    if (t.lastName  && pl.includes(t.lastName.toLowerCase()))  s += 8;
    this.split(t.nickname).forEach(n => { if (pl.includes(n.toLowerCase())) s += 9; });
    this.split(t.pets).forEach(p => { if (pl.includes(p.toLowerCase())) s += 7; });
    this.split(t.partner).forEach(p => { if (pl.includes(p.toLowerCase())) s += 6; });
    this.split(t.celebrity).forEach(p => { if (pl.includes(p.toLowerCase())) s += 5; });
    if (t.birthYear) {
      if (pl.includes(String(t.birthYear))) s += 9;
      if (pl.endsWith(String(t.birthYear).slice(-2))) s += 4;
    }
    if (t.birthDay && t.birthMonth) {
      const dd = String(t.birthDay).padStart(2,'0') + String(t.birthMonth).padStart(2,'0');
      if (pl.includes(dd)) s += 6;
    }
    const ph = (t.phoneLast4 || '').replace(/\D/g,'');
    if (ph && pl.includes(ph)) s += 6;
    if (/123$/.test(pw)) s += 5;
    if (/[!@#]$/.test(pw)) s += 4;
    if (/\d{4}$/.test(pw)) s += 3;
    if (pw.length >= 6 && pw.length <= 12) s += 2;
    s -= Math.max(0, pw.length - 14) * 2;
    this.split(t.knownPasswords).forEach(kp => {
      if (pl === kp.toLowerCase()) s += 25;
      else if (pl.startsWith(kp.toLowerCase())) s += 15;
    });
    if (t.startsWithField && pl.startsWith(t.startsWithField.toLowerCase())) s += 12;
    if (t.containsField  && pl.includes(t.containsField.toLowerCase()))      s += 10;
    if (t.endsWithField  && pl.endsWith(t.endsWithField.toLowerCase()))       s += 12;
    return s;
  }

  matchesPartial(pw) {
    const pl = pw.toLowerCase(), t = this.t;
    if (t.startsWithField && !pl.startsWith(t.startsWithField.toLowerCase())) return false;
    if (t.containsField   && !pl.includes(t.containsField.toLowerCase()))     return false;
    if (t.endsWithField   && !pl.endsWith(t.endsWithField.toLowerCase()))     return false;
    return true;
  }

  generate() {
    const bases = this.bases();
    const nums = this.nums();
    const syms = this.syms();
    const { minLen, maxLen } = this.o;
    const seen = new Set();
    const hasPartial = this.t.startsWithField || this.t.containsField || this.t.endsWithField;

    const add = pw => {
      if (pw.length >= minLen && pw.length <= maxLen && !seen.has(pw)) {
        if (!hasPartial || this.matchesPartial(pw)) seen.add(pw);
      }
    };

    const lN = nums.slice(0, 45);
    const lS = syms.slice(0, 14);

    for (const base of bases) {
      for (const v of this.wordVars(base)) {
        add(v);
        for (const n of lN) {
          add(v + n); add(n + v);
          for (const s of lS) { if (s) { add(v + n + s); add(v + s + n); } }
        }
        for (const s of lS) { if (s) add(v + s); }
      }
    }

    if (this.o.twoWord && bases.length >= 2) {
      const cb = bases.slice(0, 8);
      for (let i = 0; i < cb.length; i++) {
        for (let j = 0; j < cb.length; j++) {
          if (i === j) continue;
          const a = cb[i], b = cb[j];
          const lo = a.toLowerCase() + b.toLowerCase();
          const ti = (a[0].toUpperCase()+a.slice(1).toLowerCase()) + (b[0].toUpperCase()+b.slice(1).toLowerCase());
          add(lo); add(ti);
          lN.slice(0,20).forEach(n => { add(lo+n); add(ti+n); });
          lS.slice(0,6).forEach(s => { if(s) { add(ti+s); add(lo+s); } });
        }
      }
    }

    this.split(this.t.knownPasswords).forEach(kp => {
      add(kp);
      lN.slice(0,18).forEach(n => {
        add(kp + n);
        const stripped = kp.replace(/\d+$/, '');
        if (stripped && stripped !== kp) add(stripped + n);
      });
      lS.slice(0,8).forEach(s => { if(s) add(kp + s); });
    });

    if (this.o.keyboard) {
      this.keyboardWalks().forEach(w => {
        add(w);
        lN.slice(0,10).forEach(n => { add(w+n); add(n+w); });
        lS.slice(0,4).forEach(s => { if(s) add(w+s); });
      });
    }

    if (this.o.commonPwds) {
      this.commonPwdList().forEach(w => {
        add(w);
        lN.slice(0,8).forEach(n => add(w+n));
      });
    }

    const arr = [...seen];
    const scored = arr.map(pw => ({ pw, score: this.score(pw), pattern: this.patternOf(pw) }));
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
}

// ===== Strength =====
function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  if (s <= 2) return { label: 'Weak', cls: 'str-weak' };
  if (s <= 3) return { label: 'Fair', cls: 'str-fair' };
  if (s <= 4) return { label: 'Good', cls: 'str-good' };
  return { label: 'Strong', cls: 'str-strong' };
}

// ===== Generate =====
async function runGenerate() {
  if (S.running) return;
  S.running = true;

  const traits = collectTraits();
  const opts = collectOptions();

  if (!Object.values(traits).some(v => v && v.length)) {
    toast('Fill in at least one field to generate passwords.', 'error');
    S.running = false;
    return;
  }

  saveSession();

  document.querySelector('.step-tabs')?.classList.add('hidden');
  document.querySelector('.step-panels')?.classList.add('hidden');
  document.getElementById('resultsWrap')?.classList.add('hidden');
  const genEl = document.getElementById('genState');
  genEl?.classList.remove('hidden');

  const label = document.getElementById('genLabel');
  const bar = document.getElementById('genBarFill');
  const steps = [
    [20, 'Collecting personal patterns…'],
    [45, 'Building word combinations…'],
    [65, 'Generating date & number combos…'],
    [82, 'Applying symbol & case variants…'],
    [95, 'Ranking by likelihood…'],
  ];
  for (const [w, msg] of steps) {
    if (bar) bar.style.width = w + '%';
    if (label) label.textContent = msg;
    await wait(230);
  }

  const engine = new PasswordEngine(traits, opts);
  const scored = engine.generate();

  if (bar) bar.style.width = '100%';
  if (label) label.textContent = 'Done!';
  await wait(220);

  genEl?.classList.add('hidden');
  document.querySelector('.step-tabs')?.classList.remove('hidden');
  document.querySelector('.step-panels')?.classList.remove('hidden');

  S.scored = scored;
  S.filtered = scored;
  S.page = 1;
  S.sortMode = 'likely';
  S.filterMode = 'all';
  S.showAll = false;

  const rw = document.getElementById('resultsWrap');
  rw?.classList.remove('hidden');

  const countEl = document.getElementById('resultsCount');
  if (countEl) animateCount(countEl, scored.length);

  document.querySelectorAll('#sortChips .chip').forEach(c => c.classList.toggle('active', c.dataset.sort === 'likely'));
  document.querySelectorAll('#filterChips .chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
  const searchEl = document.getElementById('searchInp');
  if (searchEl) searchEl.value = '';

  renderBreakdown(scored);
  renderTable();
  renderPagination();
  updatePlatformNote(document.getElementById('serviceSelect')?.value || '');

  rw?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  S.running = false;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function animateCount(el, target) {
  if (S.counterId) clearInterval(S.counterId);
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 60));
  S.counterId = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur.toLocaleString();
    if (cur >= target) { clearInterval(S.counterId); S.counterId = null; }
  }, 16);
}

// ===== Breakdown =====
function renderBreakdown(scored) {
  const bar = document.getElementById('breakdownBar');
  if (!bar) return;
  const counts = {};
  scored.forEach(({ pattern }) => { counts[pattern] = (counts[pattern] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 6);
  bar.innerHTML = sorted.map(([p, n]) =>
    `<span class="breakdown-tag">${escHtml(p)}: ${n.toLocaleString()}</span>`
  ).join('');
}

// ===== Table =====
function renderTable() {
  const tbody = document.getElementById('pwTableBody');
  if (!tbody) return;
  const start = (S.page - 1) * S.perPage;
  const page = S.filtered.slice(start, start + S.perPage);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No passwords match your filter.</td></tr>`;
    return;
  }

  const copyIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  tbody.innerHTML = page.map(({ pw, pattern }, i) => {
    const rank = start + i + 1;
    const str = strength(pw);
    const vis = S.showAll ? ' vis' : '';
    return `<tr data-pw="${escAttr(pw)}" style="--i:${i}">
      <td class="pw-rank-cell">${rank}</td>
      <td><span class="pw-cell${vis}">${escHtml(pw)}</span></td>
      <td class="pattern-cell">${escHtml(pattern)}</td>
      <td class="strength-cell"><span class="${str.cls}">${str.label}</span></td>
      <td><button class="copy-cell-btn" title="Copy" aria-label="Copy password">${copyIcon}</button></td>
    </tr>`;
  }).join('');
}

// ===== Filters =====
function applyFilters() {
  let list = [...S.scored];
  const q = (document.getElementById('searchInp')?.value || '').toLowerCase();
  if (q) list = list.filter(item => item.pw.toLowerCase().includes(q));
  if (S.filterMode === 'num') list = list.filter(item => /\d/.test(item.pw));
  if (S.filterMode === 'sym') list = list.filter(item => /[^a-zA-Z0-9]/.test(item.pw));
  if (S.sortMode === 'length') list.sort((a,b) => a.pw.length - b.pw.length);
  else if (S.sortMode === 'alpha') list.sort((a,b) => a.pw.localeCompare(b.pw));
  S.filtered = list;
  S.page = 1;
  renderTable();
  renderPagination();
}

// ===== Pagination =====
function renderPagination() {
  const wrap = document.getElementById('pagination');
  if (!wrap) return;
  const total = Math.ceil(S.filtered.length / S.perPage);
  if (total <= 1) { wrap.innerHTML = ''; return; }
  const range = pgRange(S.page, total);
  let html = `<button class="pg-btn" data-page="${S.page-1}" ${S.page===1?'disabled':''}>← Prev</button>`;
  range.forEach(p => {
    if (p === '...') html += `<span class="pg-ellipsis">…</span>`;
    else html += `<button class="pg-btn${p===S.page?' active':''}" data-page="${p}">${p}</button>`;
  });
  html += `<button class="pg-btn" data-page="${S.page+1}" ${S.page===total?'disabled':''}>Next →</button>`;
  wrap.innerHTML = html;
}

function pgRange(cur, total) {
  if (total <= 7) return Array.from({length: total}, (_,i) => i+1);
  if (cur <= 4) return [...Array.from({length:5},(_,i)=>i+1), '...', total];
  if (cur >= total-3) return [1, '...', ...Array.from({length:5},(_,i)=>total-4+i)];
  return [1, '...', cur-1, cur, cur+1, '...', total];
}

function changePage(p) {
  const total = Math.ceil(S.filtered.length / S.perPage);
  if (p < 1 || p > total) return;
  S.page = p;
  renderTable();
  renderPagination();
  document.getElementById('pwTableBody')?.closest('.pw-table-wrap')
    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ===== Visibility =====
function toggleVisibility() {
  S.showAll = !S.showAll;
  const btn = document.getElementById('toggleVis');
  if (btn) {
    btn.querySelector('.eye-show')?.classList.toggle('hidden', S.showAll);
    btn.querySelector('.eye-hide')?.classList.toggle('hidden', !S.showAll);
    const textNodes = [...btn.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    if (textNodes.length) textNodes[textNodes.length-1].textContent = S.showAll ? ' Hide' : ' Show';
  }
  document.querySelectorAll('.pw-cell').forEach(el => el.classList.toggle('vis', S.showAll));
}

// ===== Copy / Export =====
function copyPw(pw) {
  navigator.clipboard.writeText(pw)
    .then(() => toast('Copied to clipboard', 'success'))
    .catch(() => toast('Copy failed', 'error'));
}

function copyAll() {
  const text = S.filtered.map(i => i.pw).join('\n');
  navigator.clipboard.writeText(text)
    .then(() => toast(`Copied ${S.filtered.length.toLocaleString()} passwords`, 'success'))
    .catch(() => toast('Copy failed', 'error'));
}

function exportFile(format) {
  if (!S.filtered.length) return;
  let content, filename, mime;
  if (format === 'csv') {
    const rows = [['#','Password','Pattern','Length','Strength']];
    S.filtered.forEach(({ pw, pattern }, i) => {
      const str = strength(pw);
      rows.push([i+1, `"${pw.replace(/"/g,'""')}"`, pattern, pw.length, str.label]);
    });
    content = rows.map(r => r.join(',')).join('\n');
    filename = 'pass-predictor-results.csv';
    mime = 'text/csv';
  } else {
    content = `Password Recovery Results\nGenerated: ${new Date().toLocaleString()}\nTotal: ${S.filtered.length}\n\n` +
              S.filtered.map(i => i.pw).join('\n');
    filename = 'pass-predictor-results.txt';
    mime = 'text/plain';
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast(`Downloaded ${S.filtered.length.toLocaleString()} passwords`, 'success');
}

// ===== Reset =====
function resetTool() {
  if (S.counterId) { clearInterval(S.counterId); S.counterId = null; }
  S.scored = []; S.filtered = []; S.running = false;
  document.getElementById('resultsWrap')?.classList.add('hidden');
  document.getElementById('genState')?.classList.add('hidden');
  document.querySelector('.step-tabs')?.classList.remove('hidden');
  document.querySelector('.step-panels')?.classList.remove('hidden');
  switchTab(0);
  document.getElementById('toolSection')?.scrollIntoView({ behavior: 'smooth' });
}

// ===== Platform Note =====
function updatePlatformNote(service) {
  const el = document.getElementById('platformNote');
  if (!el) return;
  const notes = {
    gmail:     '<strong>Gmail tip:</strong> Google allows roughly 5 attempts before triggering account verification. Start with the official recovery at <strong>accounts.google.com/signin/recovery</strong> — a trusted device or phone still signed in gives the best chance.',
    instagram: '<strong>Instagram tip:</strong> After several failed attempts the login form locks for up to 1 hour. Use the <em>Get more help</em> link below the sign-in form. The video selfie option has the highest success rate if your face appears in account photos.',
    facebook:  '<strong>Facebook tip:</strong> Start at <strong>facebook.com/login/identify</strong>. If the linked email and phone are no longer accessible, Facebook may ask you to identify friends in photos to verify your identity.',
    snapchat:  '<strong>Snapchat tip:</strong> Multiple failed attempts trigger CAPTCHA verification. Check your linked email for a reset link before trying passwords manually.',
    twitter:   '<strong>Twitter / X tip:</strong> Rate limits apply after repeated failures. Request an official password reset email or SMS from the login page first.',
    discord:   '<strong>Discord tip:</strong> Discord rate-limits login attempts aggressively. Request a password reset to your email address if that option is still available.',
  };
  el.innerHTML = notes[service] || '';
}

// ===== Toast =====
function toast(msg, type = '') {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 250);
  }, 2500);
}

// ===== Utils =====
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(s) {
  return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
