(function () {
// Golden Buzzer — shared module (connection, game rules helpers, sounds, CSV)
const CONFIG = {
  apiKey: "AIzaSyDEUcCWOcA91JxRlfqMgDjCnIJxZFu1Okg",
  authDomain: "golden-buzzer-c46cd.firebaseapp.com",
  projectId: "golden-buzzer-c46cd",
  storageBucket: "golden-buzzer-c46cd.firebasestorage.app",
  messagingSenderId: "161306774153",
  appId: "1:161306774153:web:0d4effa81afc082955d458"
};
const FB = 'https://www.gstatic.com/firebasejs/13.4.0/';

const params = new URLSearchParams(location.search);
const GAME = params.get('g') || 'live';
const LOCAL = params.has('local');            // ?local = offline mode (all tabs on one computer)
const Q_TIME = 20, A_TIME = 10, AUD_TIME = 25; // seconds
const SLOTS = ['options', 'audience', 'options', 'audience'];
const other = t => (t === 'A' ? 'B' : 'A');
const points = round => (round === 2 ? 2 : 1);

function blankState(nameA = 'Team A', nameB = 'Team B', match = '') {
  return {
    match, round: 0, qi: 0, q: null, phase: 'lobby',
    teams: { A: { name: nameA, score: 0, joker: true }, B: { name: nameB, score: 0, joker: true } },
    armed: false, buzz: null, answering: null, locked: [], timer: null,
    wheel: null, showOptions: false, audience: false, verdict: null, reveal: false,
    winner: null, music: true, v: Date.now()
  };
}

// ---------- connection ----------
async function connect() { return LOCAL ? localStore() : firebaseStore(); }

async function firebaseStore() {
  const { initializeApp } = await import(FB + 'firebase-app.js');
  const fs = await import(FB + 'firebase-firestore.js');
  const db = fs.getFirestore(initializeApp(CONFIG));
  const ref = fs.doc(db, 'gb', GAME);
  return {
    mode: 'online',
    subscribe(cb, onErr) { return fs.onSnapshot(ref, s => cb(s.exists() ? s.data() : null), e => { console.error(e); onErr && onErr(e); }); },
    init: st => fs.setDoc(ref, st),
    patch: p => fs.updateDoc(ref, { ...p, v: Date.now() }),
    tryBuzz: team => fs.runTransaction(db, async tx => {
      const s = await tx.get(ref); const d = s.data();
      if (!d || !d.armed || d.buzz || (d.locked || []).includes(team)) return false;
      tx.update(ref, { buzz: { team, t: Date.now() }, armed: false, v: Date.now() });
      return true;
    })
  };
}

function localStore() {
  const KEY = 'gb_' + GAME, subs = [];
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const put = st => { localStorage.setItem(KEY, JSON.stringify(st)); subs.forEach(cb => cb(st)); };
  addEventListener('storage', e => { if (e.key === KEY) subs.forEach(cb => cb(get())); });
  return {
    mode: 'local',
    subscribe(cb) { subs.push(cb); cb(get()); return () => {}; },
    init: async st => put(st),
    patch: async p => put({ ...(get() || {}), ...p, v: Date.now() }),
    tryBuzz: async team => {
      const d = get();
      if (!d || !d.armed || d.buzz || (d.locked || []).includes(team)) return false;
      put({ ...d, buzz: { team, t: Date.now() }, armed: false, v: Date.now() });
      return true;
    }
  };
}

// ---------- questions (CSV from Google Sheets) ----------
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
  return rows.filter(r => r.some(x => x.trim() !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
function toQuestion(r) {
  const options = [r.option_a, r.option_b, r.option_c, r.option_d].map(x => x || '');
  return {
    cat: r.category || '', en: r.question_en || '', ar: r.question_ar || '',
    answer: r.answer_en || '', answer_ar: r.answer_ar || '',
    options: options.every(Boolean) ? options : null,
    correct: (r.correct || '').trim().toUpperCase()
  };
}
function matchSets(rows) {
  const out = {};
  rows.forEach(r => {
    const m = (r.match || '').trim(); if (!m) return;
    const round = String(r.round || '').trim().toUpperCase();
    out[m] = out[m] || { r1: [], r2: [], sd: [] };
    const k = round === '1' ? 'r1' : round === '2' ? 'r2' : round === 'SD' ? 'sd' : null;
    if (k) out[m][k].push({ ...toQuestion(r), order: +r.order || 0 });
  });
  Object.values(out).forEach(s => ['r1', 'r2', 'sd'].forEach(k => s[k].sort((a, b) => a.order - b.order)));
  return out;
}

// ---------- sounds (generated, no files) ----------
let AC, master;
function audio() {
  if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination); }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, type, t, dur, vol, to) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.linearRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
const SFX = {
  buzz() { const t = audio().currentTime; [[150, 'sawtooth'], [75, 'square'], [151.5, 'sawtooth']].forEach(([f, ty]) => tone(f, ty, t, .75, .16)); },
  right() { const t = audio().currentTime; [784, 988, 1175, 1568].forEach((f, i) => tone(f, 'triangle', t + i * .085, .6, .16)); },
  wrong() { const t = audio().currentTime; tone(240, 'square', t, .22, .1, 180); tone(170, 'square', t + .22, .45, .1, 105); },
  tick() { tone(1700, 'square', audio().currentTime, .04, .06); },
  horn() { const t = audio().currentTime; tone(330, 'sawtooth', t, .9, .1); tone(392, 'sawtooth', t, .9, .07); },
  reveal() { const t = audio().currentTime; [523, 659, 784].forEach((f, i) => tone(f, 'sine', t + i * .07, .5, .12)); },
  steal() { const t = audio().currentTime; [440, 554, 659, 880].forEach((f, i) => tone(f, 'square', t + i * .06, .18, .07)); },
  fanfare() { const t = audio().currentTime; [[523, 0], [659, .15], [784, .3], [1047, .45], [784, .75], [1047, .9]].forEach(([f, d]) => { tone(f, 'triangle', t + d, .5, .16); tone(f / 2, 'sawtooth', t + d, .4, .05); }); },
  whoop() { const t = audio().currentTime; tone(300, 'triangle', t, .35, .1, 900); }
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const DEMO_CSV = "match,round,order,category,question_en,question_ar,answer_en,answer_ar,option_a,option_b,option_c,option_d,correct\n0,1,1,Culture,What is the capital of Algeria?,ما هي عاصمة الجزائر؟,Algiers,الجزائر العاصمة,Oran,Algiers,Constantine,Annaba,B\n0,1,2,Culture,In which year did Algeria gain its independence?,في أي سنة استقلت الجزائر؟,1962,1962,1954,1958,1962,1965,C\n0,1,3,Sports,How many players does a football team have on the pitch?,كم عدد لاعبي فريق كرة القدم داخل الملعب؟,11,11,9,10,11,12,C\n0,1,4,Literature,\"Who wrote the novel \"\"Nedjma\"\"?\",من كتب رواية «نجمة»؟,Kateb Yacine,كاتب ياسين,Mohammed Dib,Kateb Yacine,Assia Djebar,Mouloud Feraoun,B\n0,1,5,Art,Who painted the Mona Lisa?,من رسم لوحة الموناليزا؟,Leonardo da Vinci,ليوناردو دا فينشي,Michelangelo,Raphael,Leonardo da Vinci,Rembrandt,C\n0,2,1,Hydraulics,What is the SI unit of pressure?,ما هي وحدة الضغط في النظام الدولي للوحدات؟,The pascal (Pa),الباسكال,Newton,Pascal,Joule,Bar,B\n0,2,2,Hydraulics,Which dimensionless number tells whether a flow is laminar or turbulent?,ما هو العدد اللابعدي الذي يحدد ما إذا كان الجريان صفائحيًا أو مضطربًا؟,The Reynolds number,عدد رينولدز,Froude,Reynolds,Mach,Weber,B\n0,2,3,Hydraulics,\"What is the density of pure water at 4 °C, in kg/m³?\",ما هي كثافة الماء النقي عند 4 درجات مئوية بوحدة كغ/م³؟,1000 kg/m³,1000 كغ/م³,900,998,1000,1025,C\n0,2,4,Science & tech,What is the chemical symbol of gold?,ما هو الرمز الكيميائي للذهب؟,Au,Au,Ag,Au,Gd,Go,B\n0,2,5,Algeria,What is the largest country in Africa by area?,ما هي أكبر دولة في إفريقيا من حيث المساحة؟,Algeria,الجزائر,Sudan,DR Congo,Algeria,Libya,C\n0,SD,1,Sudden death,\"At what temperature does water boil at sea level, in °C?\",عند أي درجة حرارة يغلي الماء عند مستوى سطح البحر بالدرجة المئوية؟,100 °C,100 درجة مئوية,90,100,110,120,B\n0,SD,2,Sudden death,Which planet is known as the Red Planet?,ما هو الكوكب المعروف بالكوكب الأحمر؟,Mars,المريخ,Venus,Mars,Jupiter,Mercury,B\n";
window.GB = { CONFIG, params, GAME, LOCAL, Q_TIME, A_TIME, AUD_TIME, SLOTS, other, points, blankState, connect, parseCSV, toQuestion, matchSets, audio, SFX, esc, DEMO_CSV };
})();
