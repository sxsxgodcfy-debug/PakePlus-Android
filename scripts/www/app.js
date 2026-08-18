/* ========= 宝宝成长记 · 全前端育儿记录 ========= */
'use strict';

const STORE_KEY = 'babycare.v1';

const TYPES = {
  feeding:    { icon: '🍼', name: '喂奶',   cls: 'feeding' },
  sleep:      { icon: '😴', name: '睡眠',   cls: 'sleep' },
  diaper:     { icon: '💧', name: '排便',   cls: 'diaper' },
  solid:      { icon: '🥣', name: '正餐',   cls: 'solid' },
  supplement: { icon: '💊', name: '补剂',   cls: 'supplement' },
  growth:     { icon: '📏', name: '成长',   cls: 'growth' },
};
const FEED_METHOD = { breast: '亲喂(母乳)', bottle: '瓶喂(母乳)', formula: '配方奶' };
const AVATARS = ['👶','👦','👧','🐥','🐼','🐰','🦁','🐱','🚼','👶🏻'];

let state = { babies: [], records: [], current: null };
let editingId = null;
let feedMethod = 'breast';
let selectedDate = startOfDay(new Date());

/* ---------- 存储 ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) { console.warn('读取数据失败', e); }
  if (!state.babies) state.babies = [];
  if (!state.records) state.records = [];
  if (!state.current || !state.babies.find(b => b.id === state.current)) {
    state.current = state.babies[0] ? state.babies[0].id : null;
  }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('保存失败：存储空间可能已满'); }
}
const curBaby = () => state.babies.find(b => b.id === state.current) || null;
const curRecords = () => state.records.filter(r => r.babyId === state.current);

/* ---------- 工具 ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
function fmtTime(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtMD(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}
function fmtDur(min) {
  min = Math.round(min || 0);
  if (min < 60) return min + '分钟';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}小时${m}分` : `${h}小时`;
}
function calcAge(birthday) {
  if (!birthday) return '';
  const b = new Date(birthday), n = new Date();
  let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  let days = n.getDate() - b.getDate();
  if (days < 0) { months--; const pm = new Date(n.getFullYear(), n.getMonth(), 0); days += pm.getDate(); }
  if (months < 0) return '未出生';
  if (months < 1) return `${days}天`;
  const y = Math.floor(months / 12), m = months % 12;
  if (y < 1) return `${months}个月${days ? days + '天' : ''}`;
  return `${y}岁${m ? m + '个月' : ''}`;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 1800);
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------- 导航 ---------- */
function setPage(p) {
  document.querySelectorAll('.page').forEach(s => s.classList.add('hidden'));
  document.getElementById('page-' + p).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === p));
  if (p === 'stats') renderStats();
  if (p === 'timeline') renderTimeline();
  if (p === 'me') renderMe();
  if (p === 'today') renderToday();
}

/* ---------- 顶部宝宝栏 ---------- */
function renderTop() {
  const b = curBaby();
  document.getElementById('babyAvatar').textContent = b ? (b.avatar || '👶') : '👶';
  document.getElementById('babyName').textContent = b ? b.name : '未设置宝宝';
  document.getElementById('babyAge').textContent = b ? (calcAge(b.birthday) + (b.gender ? ' · ' + b.gender : '')) : '点击下方添加宝宝';
  const d = selectedDate;
  const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  document.getElementById('todayDate').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${wk}`;
  const dp = document.getElementById('datePick');
  if (dp) dp.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ---------- 今日 ---------- */
function renderToday() {
  renderTop();
  const b = curBaby();
  const grid = document.getElementById('summaryGrid');
  const tl = document.getElementById('todayTimeline');
  if (!b) {
    grid.innerHTML = '';
    tl.innerHTML = '<div class="empty">还没有宝宝，点击左上角添加 👶</div>';
    return;
  }
  const recs = curRecords().filter(r => sameDay(r.time, selectedDate));
  const feeds = recs.filter(r => r.type === 'feeding');
  const milk = feeds.filter(f => f.method !== 'breast').reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const breastMin = feeds.filter(f => f.method === 'breast').reduce((s, f) => s + (Number(f.left) || 0) + (Number(f.right) || 0), 0);
  const sleepMin = recs.filter(r => r.type === 'sleep').reduce((s, r) => s + (Number(r.durationMin) || 0), 0);
  const diaper = recs.filter(r => r.type === 'diaper').length;
  const sup = recs.filter(r => r.type === 'supplement').length;
  const food = recs.filter(r => r.type === 'solid').length;

  const cards = [
    { v: feeds.length, l: '喂奶次数', s: '' },
    { v: milk, l: '总奶量', s: 'ml' },
    { v: breastMin ? fmtDur(breastMin) : '0', l: '亲喂时长', s: '' },
    { v: (sleepMin / 60).toFixed(1), l: '睡眠时长', s: 'h' },
    { v: diaper, l: '排便', s: '次' },
    { v: sup + food, l: '补剂/正餐', s: '次' },
  ];
  grid.innerHTML = cards.map(c => `<div class="sum-card"><div class="sum-val">${c.v}${c.s ? `<small>${c.s}</small>` : ''}</div><div class="sum-label">${c.l}</div></div>`).join('');

  const recent = recs.slice().sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 12);
  const isSelToday = sameDay(selectedDate, new Date());
  tl.innerHTML = recent.length ? recent.map(timelineItem).join('') : `<div class="empty">${isSelToday ? '今天还没有记录，点下方按钮开始吧 ✨' : '这一天还没有记录'}</div>`;
}

/* ---------- 时间线 ---------- */
let tlFilter = 'all';
function renderTimeline() {
  const b = curBaby();
  const wrap = document.getElementById('allTimeline');
  if (!b) { wrap.innerHTML = '<div class="empty">请先添加宝宝</div>'; return; }
  let recs = curRecords().slice().sort((a, b) => new Date(b.time) - new Date(a.time));
  if (tlFilter !== 'all') recs = recs.filter(r => r.type === tlFilter);
  wrap.innerHTML = recs.length ? recs.map(timelineItem).join('') : '<div class="empty">暂无记录</div>';
}

function timelineItem(r) {
  const t = TYPES[r.type];
  return `<div class="tl-item" data-id="${r.id}">
    <div class="tl-icon ${t.cls}">${t.icon}</div>
    <div class="tl-main">
      <div class="tl-title">${esc(titleOf(r))}</div>
      <div class="tl-desc">${esc(descOf(r))}${r.note ? ' · ' + esc(r.note) : ''}</div>
    </div>
    <div class="tl-time">${fmtMD(r.time)} ${fmtTime(r.time)}</div>
    <button class="tl-del" data-del="${r.id}">删除</button>
  </div>`;
}
function titleOf(r) {
  if (r.type === 'feeding') return '喂奶 · ' + (FEED_METHOD[r.method] || '');
  return TYPES[r.type].name;
}
function descOf(r) {
  switch (r.type) {
    case 'feeding':
      return r.method === 'breast' ? `左${r.left || 0}分 右${r.right || 0}分` : `${r.amount || 0} ml`;
    case 'sleep': return `共 ${fmtDur(r.durationMin || 0)}`;
    case 'diaper': {
      const m = r.dtype === 'pee' ? '尿' : r.dtype === 'poo' ? '便' : '尿+便';
      return [m, r.color, r.texture].filter(Boolean).join(' · ');
    }
    case 'solid': return `${r.food || '正餐'}${r.amount ? ' · ' + r.amount : ''}`;
    case 'supplement': return `${r.name || '补剂'}${r.dose ? ' · ' + r.dose : ''}`;
    case 'growth': return `体重${r.weight || '-'}kg 身高${r.height || '-'}cm${r.head ? ' 头围' + r.head + 'cm' : ''}`;
    default: return '';
  }
}

/* ---------- 统计 ---------- */
let statRange = 7;
function dayBuckets(n) {
  const arr = [], today = startOfDay(new Date());
  for (let i = n - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); arr.push(d); }
  return arr;
}
function renderStats() {
  const b = curBaby();
  if (!b) { ['chartMilk', 'chartFeed', 'chartSleep', 'chartGrowth', 'chartDiaper'].forEach(id => document.getElementById(id).innerHTML = '<div class="empty">请先添加宝宝</div>'); return; }
  const days = dayBuckets(statRange);
  const recs = curRecords();
  const milk = days.map(d => ({ label: fmtMD(d), value: recs.filter(r => r.type === 'feeding' && r.method !== 'breast' && sameDay(r.time, d)).reduce((s, r) => s + (Number(r.amount) || 0), 0) }));
  const feed = days.map(d => ({ label: fmtMD(d), value: recs.filter(r => r.type === 'feeding' && sameDay(r.time, d)).length }));
  const sleep = days.map(d => ({ label: fmtMD(d), value: +(recs.filter(r => r.type === 'sleep' && sameDay(r.time, d)).reduce((s, r) => s + (Number(r.durationMin) || 0), 0) / 60).toFixed(1) }));
  const diaper = days.map(d => ({ label: fmtMD(d), value: recs.filter(r => r.type === 'diaper' && sameDay(r.time, d)).length }));
  renderBar('chartMilk', milk, '#5aa888');
  renderBar('chartFeed', feed, '#7fc8a9');
  renderBar('chartSleep', sleep, '#6f8fd6');
  renderBar('chartDiaper', diaper, '#9ad0ec');
  renderGrowth('chartGrowth', recs);
}
function renderBar(id, data, color) {
  const el = document.getElementById(id);
  if (!data.some(d => d.value > 0)) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
  const W = 300, H = 130, padB = 22, padT = 16, padL = 6, padR = 6;
  const n = data.length;
  const max = Math.max(...data.map(d => d.value), 1);
  const step = (W - padL - padR) / n, bw = step * 0.58;
  let svg = '';
  data.forEach((d, i) => {
    const h = d.value / max * (H - padT - padB);
    const x = padL + step * i + (step - bw) / 2, y = H - padB - h;
    svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${color}"/>`;
    if (h > 12) svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="9" fill="#8a9893" text-anchor="middle">${d.value}</text>`;
    svg += `<text x="${(padL + step * i + step / 2).toFixed(1)}" y="${H - 7}" font-size="9" fill="#8a9893" text-anchor="middle">${d.label}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${svg}</svg>`;
}
function renderGrowth(id, recs) {
  const el = document.getElementById(id);
  const g = recs.filter(r => r.type === 'growth' && (r.weight || r.height)).sort((a, b) => new Date(a.time) - new Date(b.time));
  if (g.length < 1) { el.innerHTML = '<div class="empty">暂无成长数据</div>'; return; }
  const W = 300, H = 150, padL = 8, padR = 8, padT = 16, padB = 22, n = g.length;
  const xs = i => padL + (n === 1 ? (W - padL - padR) / 2 : (W - padL - padR) * i / (n - 1));
  function series(key, color) {
    const vals = g.map(r => parseFloat(r[key])).filter(v => !isNaN(v));
    if (!vals.length) return '';
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
    const pts = g.map((r, i) => {
      const v = parseFloat(r[key]); if (isNaN(v)) return null;
      const y = padT + (H - padT - padB) * (1 - (v - min) / range);
      return { x: xs(i), y, v };
    }).filter(Boolean);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const dots = pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}"/><text x="${p.x.toFixed(1)}" y="${(p.y - 6).toFixed(1)}" font-size="8" fill="${color}" text-anchor="middle">${p.v}</text>`).join('');
    return `<path d="${line}" fill="none" stroke="${color}" stroke-width="2"/>${dots}`;
  }
  const labels = g.map((r, i) => `<text x="${xs(i).toFixed(1)}" y="${H - 7}" font-size="9" fill="#8a9893" text-anchor="middle">${fmtMD(r.time)}</text>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${series('weight', '#f48e7e')}${series('height', '#9ad0ec')}${labels}</svg>`;
}

/* ---------- 记录表单 ---------- */
const recordModal = () => document.getElementById('recordModal');
let curType = null;
function openRecord(type, record) {
  if (!curBaby()) { toast('请先添加宝宝'); openBabyManager(); return; }
  curType = type; editingId = record ? record.id : null;
  document.getElementById('recordModalTitle').textContent = (record ? '编辑' : '添加') + TYPES[type].name + '记录';
  const f = document.getElementById('recordForm');
  f.innerHTML = buildForm(type, record);
  wireForm(type, record);
  recordModal().classList.remove('hidden');
}
function buildForm(type, r) {
  const time = toLocalInput(r && r.time);
  const note = r ? (r.note || '') : '';
  if (type === 'feeding') {
    const m = (r && r.method) || 'breast'; feedMethod = m;
    return `
      <div class="form-group"><div class="form-label">喂养方式</div>
        <div class="seg" id="feedSeg">
          <button data-m="breast" class="${m === 'breast' ? 'active' : ''}">亲喂</button>
          <button data-m="bottle" class="${m === 'bottle' ? 'active' : ''}">瓶喂母乳</button>
          <button data-m="formula" class="${m === 'formula' ? 'active' : ''}">配方奶</button>
        </div></div>
      <div class="form-group feed-dur" id="feedDur" style="${m === 'breast' ? '' : 'display:none'}">
        <div class="row2">
          <div><div class="form-label">左侧(分)</div><input class="form-input" id="fLeft" type="number" inputmode="numeric" value="${r ? r.left || '' : ''}" placeholder="0"></div>
          <div><div class="form-label">右侧(分)</div><input class="form-input" id="fRight" type="number" inputmode="numeric" value="${r ? r.right || '' : ''}" placeholder="0"></div>
        </div></div>
      <div class="form-group feed-amt" id="feedAmt" style="${m === 'breast' ? 'display:none' : ''}">
        <div class="form-label">奶量(ml)</div><div class="unit" data-unit="ml"><input class="form-input" id="fAmt" type="number" inputmode="decimal" value="${r ? r.amount || '' : ''}" placeholder="如 120"></div></div>
      <div class="form-group"><div class="form-label">时间</div><input class="form-input" id="fTime" type="datetime-local" value="${time}"></div>
      <div class="form-group"><div class="form-label">备注</div><textarea class="form-textarea" id="fNote" placeholder="可选">${esc(note)}</textarea></div>`;
  }
  if (type === 'sleep') {
    return `
      <div class="form-group"><div class="form-label">开始时间</div><input class="form-input" id="sStart" type="datetime-local" value="${toLocalInput(r && r.time)}"></div>
      <div class="form-group"><div class="form-label">结束时间</div><input class="form-input" id="sEnd" type="datetime-local" value="${toLocalInput(r && r.endTime)}"></div>
      <div class="form-group"><div class="form-label">备注</div><textarea class="form-textarea" id="sNote" placeholder="可选">${esc(note)}</textarea></div>`;
  }
  if (type === 'diaper') {
    const dt = (r && r.dtype) || 'pee';
    return `
      <div class="form-group"><div class="form-label">类型</div>
        <div class="seg" id="diaperSeg">
          <button data-d="pee" class="${dt === 'pee' ? 'active' : ''}">尿</button>
          <button data-d="poo" class="${dt === 'poo' ? 'active' : ''}">便</button>
          <button data-d="both" class="${dt === 'both' ? 'active' : ''}">都有</button>
        </div></div>
      <div class="form-group" id="pooBox" style="${dt === 'pee' ? 'display:none' : ''}">
        <div class="form-label">便便性状</div>
        <select class="form-select" id="dTexture"><option ${r && r.texture === '正常' ? 'selected' : ''}>正常</option><option ${r && r.texture === '偏稀' ? 'selected' : ''}>偏稀</option><option ${r && r.texture === '偏干' ? 'selected' : ''}>偏干</option><option ${r && r.texture === '水样' ? 'selected' : ''}>水样</option></select>
        <div class="form-label" style="margin-top:10px">颜色</div>
        <select class="form-select" id="dColor"><option ${r && r.color === '金黄' ? 'selected' : ''}>金黄</option><option ${r && r.color === '黄绿' ? 'selected' : ''}>黄绿</option><option ${r && r.color === '绿色' ? 'selected' : ''}>绿色</option><option ${r && r.color === '棕色' ? 'selected' : ''}>棕色</option><option ${r && r.color === '其他' ? 'selected' : ''}>其他</option></select>
      </div>
      <div class="form-group"><div class="form-label">时间</div><input class="form-input" id="dTime" type="datetime-local" value="${time}"></div>
      <div class="form-group"><div class="form-label">备注</div><textarea class="form-textarea" id="dNote" placeholder="可选">${esc(note)}</textarea></div>`;
  }
  if (type === 'solid') {
    return `
      <div class="form-group"><div class="form-label">食物名称</div><input class="form-input" id="foodName" type="text" value="${r ? esc(r.food) : ''}" placeholder="如 米粉/南瓜泥"></div>
      <div class="form-group"><div class="form-label">用量</div><input class="form-input" id="foodAmt" type="text" value="${r ? esc(r.amount) : ''}" placeholder="如 半碗/30g"></div>
      <div class="form-group"><div class="form-label">时间</div><input class="form-input" id="foodTime" type="datetime-local" value="${time}"></div>
      <div class="form-group"><div class="form-label">备注</div><textarea class="form-textarea" id="foodNote" placeholder="可选">${esc(note)}</textarea></div>`;
  }
  if (type === 'supplement') {
    const nm = (r && r.name) || '维生素D';
    return `
      <div class="form-group"><div class="form-label">补剂名称</div>
        <select class="form-select" id="supName"><option ${nm === '维生素D' ? 'selected' : ''}>维生素D</option><option ${nm === '维生素AD' ? 'selected' : ''}>维生素AD</option><option ${nm === '钙' ? 'selected' : ''}>钙</option><option ${nm === '铁' ? 'selected' : ''}>铁</option><option ${nm === 'DHA' ? 'selected' : ''}>DHA</option><option ${nm === '益生菌' ? 'selected' : ''}>益生菌</option><option ${nm === '其他' ? 'selected' : ''}>其他</option></select></div>
      <div class="form-group"><div class="form-label">剂量</div><input class="form-input" id="supDose" type="text" value="${r ? esc(r.dose) : ''}" placeholder="如 400IU / 1滴"></div>
      <div class="form-group"><div class="form-label">时间</div><input class="form-input" id="supTime" type="datetime-local" value="${time}"></div>
      <div class="form-group"><div class="form-label">备注</div><textarea class="form-textarea" id="supNote" placeholder="可选">${esc(note)}</textarea></div>`;
  }
  if (type === 'growth') {
    return `
      <div class="form-group"><div class="form-label">体重(kg)</div><div class="unit" data-unit="kg"><input class="form-input" id="gWeight" type="number" inputmode="decimal" value="${r ? r.weight || '' : ''}" placeholder="如 6.8"></div></div>
      <div class="form-group"><div class="form-label">身高(cm)</div><div class="unit" data-unit="cm"><input class="form-input" id="gHeight" type="number" inputmode="decimal" value="${r ? r.height || '' : ''}" placeholder="如 65"></div></div>
      <div class="form-group"><div class="form-label">头围(cm)</div><div class="unit" data-unit="cm"><input class="form-input" id="gHead" type="number" inputmode="decimal" value="${r ? r.head || '' : ''}" placeholder="如 42"></div></div>
      <div class="form-group"><div class="form-label">时间</div><input class="form-input" id="gTime" type="datetime-local" value="${time}"></div>
      <div class="form-group"><div class="form-label">备注</div><textarea class="form-textarea" id="gNote" placeholder="可选">${esc(note)}</textarea></div>`;
  }
  return '';
}
function wireForm(type, r) {
  if (type === 'feeding') {
    document.querySelectorAll('#feedSeg button').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('#feedSeg button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); feedMethod = btn.dataset.m;
      document.getElementById('feedDur').style.display = feedMethod === 'breast' ? '' : 'none';
      document.getElementById('feedAmt').style.display = feedMethod === 'breast' ? 'none' : '';
    }));
  }
  if (type === 'diaper') {
    document.querySelectorAll('#diaperSeg button').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('#diaperSeg button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pooBox').style.display = btn.dataset.d === 'pee' ? 'none' : '';
    }));
  }
}
function saveRecord() {
  const type = curType;
  const base = { id: editingId || uid(), babyId: state.current, type, time: new Date().toISOString() };
  let rec;
  if (type === 'feeding') {
    const t = document.getElementById('fTime').value;
    rec = { ...base, method: feedMethod, time: new Date(t || Date.now()).toISOString(),
      left: feedMethod === 'breast' ? +document.getElementById('fLeft').value || 0 : 0,
      right: feedMethod === 'breast' ? +document.getElementById('fRight').value || 0 : 0,
      amount: feedMethod === 'breast' ? 0 : +document.getElementById('fAmt').value || 0,
      note: document.getElementById('fNote').value.trim() };
    if (feedMethod !== 'breast' && !rec.amount) return toast('请填写奶量');
  } else if (type === 'sleep') {
    const s = document.getElementById('sStart').value, e = document.getElementById('sEnd').value;
    const st = new Date(s || Date.now()), et = new Date(e || Date.now());
    if (et <= st) return toast('结束时间需晚于开始时间');
    rec = { ...base, time: st.toISOString(), endTime: et.toISOString(), durationMin: Math.round((et - st) / 60000), note: document.getElementById('sNote').value.trim() };
  } else if (type === 'diaper') {
    const dt = (document.querySelector('#diaperSeg button.active') || {}).dataset?.d || 'pee';
    rec = { ...base, dtype: dt, time: new Date(document.getElementById('dTime').value || Date.now()).toISOString(),
      texture: dt === 'pee' ? '' : document.getElementById('dTexture').value,
      color: dt === 'pee' ? '' : document.getElementById('dColor').value,
      note: document.getElementById('dNote').value.trim() };
  } else if (type === 'solid') {
    if (!document.getElementById('foodName').value.trim()) return toast('请填写食物名称');
    rec = { ...base, food: document.getElementById('foodName').value.trim(), amount: document.getElementById('foodAmt').value.trim(),
      time: new Date(document.getElementById('foodTime').value || Date.now()).toISOString(), note: document.getElementById('foodNote').value.trim() };
  } else if (type === 'supplement') {
    rec = { ...base, name: document.getElementById('supName').value, dose: document.getElementById('supDose').value.trim(),
      time: new Date(document.getElementById('supTime').value || Date.now()).toISOString(), note: document.getElementById('supNote').value.trim() };
  } else if (type === 'growth') {
    rec = { ...base, weight: document.getElementById('gWeight').value || '', height: document.getElementById('gHeight').value || '',
      head: document.getElementById('gHead').value || '', time: new Date(document.getElementById('gTime').value || Date.now()).toISOString(),
      note: document.getElementById('gNote').value.trim() };
  }
  if (editingId) { const i = state.records.findIndex(x => x.id === editingId); if (i >= 0) state.records[i] = rec; }
  else state.records.push(rec);
  save(); recordModal().classList.add('hidden');
  toast(editingId ? '已更新' : '已记录');
  renderToday();
}

/* ---------- 快捷加记录菜单 ---------- */
function openQuickMenu() {
  const items = [
    { type: 'feeding', label: '喂奶', icon: '🍼' },
    { type: 'solid', label: '正餐', icon: '🥣' },
    { type: 'diaper', label: '排便', icon: '💧' },
    { type: 'growth', label: '成长', icon: '📏' },
    { type: 'supplement', label: '补剂', icon: '💊' },
  ];
  const html = items.map(it => `<button class="menu-item" data-q="${it.type}">${it.icon} ${it.label}</button>`).join('');
  showInfo('添加记录', html, '<button class="btn-ghost" id="qmClose">取消</button>');
  items.forEach(it => {
    const el = document.querySelector(`[data-q="${it.type}"]`);
    if (el) el.addEventListener('click', () => { hideInfo(); openRecord(it.type); });
  });
  document.getElementById('qmClose').addEventListener('click', hideInfo);
}
function openBabyManager() {
  const body = document.getElementById('infoBody');
  let html = state.babies.map(b => `<div class="baby-item">
      <div class="bi-avatar">${b.avatar || '👶'}</div>
      <div class="bi-info"><div class="bi-name">${esc(b.name)}</div><div class="bi-sub">${b.birthday || '未设生日'} · ${calcAge(b.birthday)}${b.gender ? ' · ' + b.gender : ''}</div></div>
      <div class="bi-act" data-edit="${b.id}">${b.id === state.current ? '当前' : '切换'}</div>
    </div>`).join('');
  html += `<button class="btn-primary" id="addBabyBtn" style="width:100%;margin-top:6px">＋ 添加宝宝</button>`;
  if (!state.babies.length) html = '<div class="empty">还没有宝宝，点击下方添加 👶</div>' + html;
  showInfo('宝宝管理', html, '');
  document.getElementById('addBabyBtn').addEventListener('click', () => openBabyForm(null));
  body.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.edit;
    if (id === state.current) { openBabyForm(id); }
    else { state.current = id; save(); hideInfo(); renderTop(); renderToday(); renderMe(); toast('已切换到 ' + curBaby().name); }
  }));
}
function openBabyForm(id) {
  const b = id ? state.babies.find(x => x.id === id) : null;
  const formHTML = `
    <div class="form-group"><div class="form-label">昵称</div><input class="form-input" id="bName" type="text" value="${b ? esc(b.name) : ''}" placeholder="宝宝小名"></div>
    <div class="form-group"><div class="form-label">生日</div><input class="form-input" id="bBirth" type="date" value="${b ? b.birthday || '' : ''}"></div>
    <div class="form-group"><div class="form-label">性别</div>
      <div class="seg" id="bGender">
        <button data-g="男" class="${!b || b.gender === '男' ? 'active' : ''}">男</button>
        <button data-g="女" class="${b && b.gender === '女' ? 'active' : ''}">女</button>
      </div></div>
    <div class="form-group"><div class="form-label">头像</div>
      <div class="seg" id="bAvatar" style="flex-wrap:wrap">
        ${AVATARS.map(a => `<button data-a="${a}" style="flex:0 0 18%;font-size:22px" class="${b && b.avatar === a ? 'active' : ''}">${a}</button>`).join('')}
      </div></div>`;
  const footHTML = `<button class="btn-ghost" id="bCancel">取消</button><button class="btn-primary" id="bSave">保存</button>`;
  showInfo(b ? '编辑宝宝' : '添加宝宝', formHTML, footHTML);
  let gender = b ? b.gender || '男' : '男', avatar = b ? b.avatar || '👶' : '👶';
  document.querySelectorAll('#bGender button').forEach(x => x.addEventListener('click', () => { document.querySelectorAll('#bGender button').forEach(z => z.classList.remove('active')); x.classList.add('active'); gender = x.dataset.g; }));
  document.querySelectorAll('#bAvatar button').forEach(x => x.addEventListener('click', () => { document.querySelectorAll('#bAvatar button').forEach(z => z.classList.remove('active')); x.classList.add('active'); avatar = x.dataset.a; }));
  document.getElementById('bCancel').addEventListener('click', () => { if (state.babies.length) openBabyManager(); else hideInfo(); });
  document.getElementById('bSave').addEventListener('click', () => {
    const name = document.getElementById('bName').value.trim();
    if (!name) return toast('请填写昵称');
    const birth = document.getElementById('bBirth').value;
    if (b) { b.name = name; b.birthday = birth; b.gender = gender; b.avatar = avatar; }
    else { const nb = { id: uid(), name, birthday: birth, gender, avatar }; state.babies.push(nb); state.current = nb.id; }
    save(); hideInfo(); renderTop(); renderToday(); renderMe(); toast('已保存');
  });
}

/* ---------- 我的 ---------- */
function renderMe() {
  const b = curBaby();
  document.getElementById('meAvatar').textContent = b ? (b.avatar || '👶') : '👶';
  document.getElementById('meName').textContent = b ? b.name : '未设置';
  document.getElementById('meSub').textContent = b ? (`${calcAge(b.birthday)} · 生日 ${b.birthday || '未设'}${b.gender ? ' · ' + b.gender : ''}`) : '点击「宝宝信息管理」添加';
}
function exportData() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `宝宝记录_${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('已导出');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!confirm('导入将覆盖当前所有数据，确定继续？')) return;
      if (d && d.babies && d.records) { state = d; save(); renderTop(); renderToday(); renderMe(); toast('导入成功'); }
      else toast('文件格式不正确');
    } catch (e) { toast('解析失败'); }
  };
  reader.readAsText(file);
}
function clearData() {
  if (!state.current) return toast('没有可清空的宝宝');
  if (!confirm('将删除当前宝宝的所有记录，且不可恢复，确定？')) return;
  state.records = state.records.filter(r => r.babyId !== state.current);
  save(); renderToday(); renderTimeline(); toast('已清空记录');
}

/* ---------- 通用弹窗 ---------- */
function showInfo(title, bodyHTML, footHTML) {
  document.getElementById('infoModalTitle').textContent = title;
  document.getElementById('infoBody').innerHTML = bodyHTML || '';
  document.getElementById('infoFoot').innerHTML = footHTML || '';
  document.getElementById('infoModal').classList.remove('hidden');
}
function hideInfo() { document.getElementById('infoModal').classList.add('hidden'); }

/* ---------- 事件绑定 ---------- */
function bind() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setPage(t.dataset.page)));
  document.getElementById('fab').addEventListener('click', openQuickMenu);
  document.getElementById('datePick').addEventListener('change', e => {
    if (e.target.value) { selectedDate = startOfDay(new Date(e.target.value + 'T00:00')); renderToday(); }
  });
  document.querySelectorAll('.qbtn').forEach(b => b.addEventListener('click', () => openRecord(b.dataset.type)));
  document.getElementById('babySwitch').addEventListener('click', openBabyManager);
  document.getElementById('recordClose').addEventListener('click', () => recordModal().classList.add('hidden'));
  document.getElementById('recordCancel').addEventListener('click', () => recordModal().classList.add('hidden'));
  document.getElementById('recordSave').addEventListener('click', saveRecord);
  document.getElementById('infoClose').addEventListener('click', hideInfo);

  document.getElementById('filterRow').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    document.querySelectorAll('#filterRow .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active'); tlFilter = c.dataset.filter; renderTimeline();
  });
  document.getElementById('rangeRow').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    document.querySelectorAll('#rangeRow .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active'); statRange = +c.dataset.range; renderStats();
  });
  document.getElementById('allTimeline').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) { if (confirm('删除这条记录？')) { state.records = state.records.filter(r => r.id !== del.dataset.del); save(); renderTimeline(); renderToday(); toast('已删除'); } return; }
    const item = e.target.closest('.tl-item');
    if (item) { const r = state.records.find(x => x.id === item.dataset.id); if (r) openRecord(r.type, r); }
  });

  document.getElementById('btnManageBaby').addEventListener('click', openBabyManager);
  document.getElementById('btnExport').addEventListener('click', exportData);
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
  document.getElementById('btnClear').addEventListener('click', clearData);
  document.getElementById('btnAbout').addEventListener('click', () => {
    const aboutHTML = '<div style="font-size:14px;line-height:1.7">👶 <b>宝宝成长记</b> 是一款纯前端、离线可用的育儿记录工具。<br><br>所有数据仅保存在本机浏览器（localStorage），不上传任何服务器，请放心使用。<br><br>可记录：喂奶（亲喂/瓶喂/配方奶）、正餐、睡眠、排便、补剂、成长（体重身高头围），并查看趋势统计。<br><br>建议定期「导出数据」备份，更换设备或清理浏览器可能导致数据丢失。</div>';
    showInfo('关于', aboutHTML, '<button class="btn-primary" id="aboutOk" style="width:100%">知道了</button>');
    document.getElementById('aboutOk').addEventListener('click', hideInfo);
  });
}

/* ---------- 启动 ---------- */
load();
bind();
renderTop();
renderToday();
