// BitBaby - Professional Logic (Final)
// 注意：按你的要求，不改任何显示效果/主题/交互/逻辑，只新增“收益”列 + 必要bug修复 + 新增“进行中”状态选项

const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function normalizeNumericString(v){
  if (v === null || v === undefined) return '';
  let s = String(v).replace(/[\s,]/g, '').trim();
  if (!s) return '';
  s = s.replace(/[^\d.\-]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
  if (s.indexOf('-') > 0) s = s.replace(/-/g, '');
  return s;
}

function parseAmountToCents(v){
  const s = normalizeNumericString(v);
  if (!s || s === '-' || s === '.') return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToNumber(cents){ return cents / 100; }

function setTodayIfEmpty(){
  const el = document.getElementById('tradeDate');
  if (!el.value){
    const d = new Date();
    el.value = d.toISOString().split('T')[0];
  }
}

// === 状态文案：新增“进行中” ===
const STATUS = {
  hit:      { label: '达到预计收益', cls: 'status-hit'  },
  progress: { label: '进行中',       cls: 'status-progress' }, // ✅ 新增
  miss:     { label: '未达到预计收益', cls: 'status-miss' },
  over:     { label: '超额完成收益', cls: 'status-over' },
};

function statusOptions(selected){
  return Object.entries(STATUS).map(([key, meta])=>{
    return `<option value="${key}" ${key === selected ? 'selected' : ''}>${meta.label}</option>`;
  }).join('');
}

function applyStatusClass(selectEl){
  selectEl.classList.remove('status-hit','status-progress','status-miss','status-over');
  const meta = STATUS[selectEl.value] || STATUS.hit;
  selectEl.classList.add(meta.cls);
}

function classifyCell(el){
  const val = parseFloat(normalizeNumericString(el.value));
  el.classList.remove('pos','neg','muted');
  if (val > 0) el.classList.add('pos');
  else if (val < 0) el.classList.add('neg');
  else el.classList.add('muted');
}

function computeFeesForRow(row){
  const amountCents = parseAmountToCents(row.querySelector('.amount-input')?.value);

  const l1 = centsToNumber(Math.round(amountCents * 0.02));
  const l2 = centsToNumber(Math.round(amountCents * 0.01));
  const l3 = centsToNumber(Math.round(amountCents * 0.005));

  const update = (cls, val) => {
    const el = row.querySelector(cls);
    if(el) {
      el.value = fmt.format(val);
      classifyCell(el);
    }
  };

  update('.fee-l1', l1);
  update('.fee-l2', l2);
  update('.fee-l3', l3);
}

// === Bug Fix #1：防止 innerHTML 注入/破坏DOM（不改变UI，只转义用户值） ===
function escapeHTML(v){
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}



// === 批量粘贴解析（Excel/表格复制） ===
// 支持：Tab / 多空格 / 逗号 分列；允许首行表头（包含“交易对/币种/金额/收益/状态”会自动跳过）
// 列顺序：交易对/币种, 金额(USDT), 收益, 状态(可选；默认“达到预计收益”)
function normalizeStatusFromText(v){
  const s = String(v ?? '').trim();
  if(!s) return 'hit';

  // 允许直接给 key
  if (STATUS[s]) return s;

  // 允许中文
  if (s.includes('达到')) return 'hit';
  if (s.includes('进行')) return 'progress';
  if (s.includes('未达到') || s.includes('未达')) return 'miss';
  if (s.includes('超额')) return 'over';

  return 'hit';
}

function splitBulkCols(line){
  return String(line ?? '')
    .trim()
    .split(/[\t,]+|\s+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function parseBulkRows(text){
  const raw = String(text ?? '').replace(/\r/g, '\n');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if(!lines.length) return [];

  let start = 0;
  const head = splitBulkCols(lines[0]).join('');
  if(head.includes('交易对') || head.includes('币种') || head.includes('金额') || head.includes('收益') || head.includes('状态')){
    start = 1;
  }

  const out = [];
  for(let i=start;i<lines.length;i++){
    const cols = splitBulkCols(lines[i]);
    if(cols.length < 3){
      throw new Error(`第 ${i+1} 行列数不足（至少需要：交易对/币种、金额、收益）`);
    }
    const pair = cols[0];
    const amount = cols[1];
    const profit = cols[2];
    const status = normalizeStatusFromText(cols[3]);
    out.push({ pair, amount, profit, status });
  }
  return out;
}

function applyBulkToTable(rows){
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  if(!rows.length){
    tbody.appendChild(rowTemplate({ status:'hit' }));
    refreshTotals();
    return;
  }
  rows.forEach(r => tbody.appendChild(rowTemplate(r)));
  refreshTotals();
}
function rowTemplate(data = {}){
  const { pair='', amount='', profit='', status='hit' } = data;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="cell-input pair-input" placeholder="BTC/USDT" value="${escapeHTML(pair)}"></td>
    <td><input class="cell-input amount-input" inputmode="decimal" placeholder="0.00" value="${escapeHTML(amount)}"></td>
    <td><input class="cell-input fee-input fee-l1" readonly tabindex="-1" value="0.00"></td>
    <td><input class="cell-input fee-input fee-l2" readonly tabindex="-1" value="0.00"></td>
    <td><input class="cell-input fee-input fee-l3" readonly tabindex="-1" value="0.00"></td>
    <td><input class="cell-input profit-input" inputmode="decimal" placeholder="0.00" value="${escapeHTML(profit)}"></td>
    <td class="status-col">
      <select class="status-select status-input">
        ${statusOptions(status)}
      </select>
    </td>
    <td class="action-col">
      <button class="btn small danger del-btn" tabindex="-1">×</button>
    </td>
  `;

  const sel = tr.querySelector('.status-input');
  applyStatusClass(sel);

  computeFeesForRow(tr);

  return tr;
}

function refreshTotals(){
  const rows = [...document.querySelectorAll('#tbody tr')];
  let s1=0, s2=0, s3=0;

  rows.forEach(r=>{
    s1 += parseAmountToCents(r.querySelector('.fee-l1')?.value);
    s2 += parseAmountToCents(r.querySelector('.fee-l2')?.value);
    s3 += parseAmountToCents(r.querySelector('.fee-l3')?.value);
  });

  const updateSum = (id, cents) => {
    const val = centsToNumber(cents);
    const el = document.getElementById(id);
    if(el) {
      el.textContent = `${fmt.format(val)} U`;
      el.className = `footer-value ${val > 0 ? 'pos' : (val < 0 ? 'neg' : 'muted')}`;
    }
  };

  updateSum('bottomL1', s1);
  updateSum('bottomL2', s2);
  updateSum('bottomL3', s3);

  debouncedAutoSave();
}

let timeout;
function debouncedAutoSave(){
  clearTimeout(timeout);
  timeout = setTimeout(autoSave, 500);
}

function bindEvents(){
  const tbody = document.getElementById('tbody');

  tbody.addEventListener('input', (e)=>{
    if (e.target.classList.contains('amount-input')){
      computeFeesForRow(e.target.closest('tr'));
      refreshTotals();
    } else {
      debouncedAutoSave();
    }
  });

  tbody.addEventListener('change', (e)=>{
    if (e.target.classList.contains('status-input')){
      applyStatusClass(e.target);
      debouncedAutoSave();
    }
  });

  tbody.addEventListener('click', (e)=>{
    if(e.target.classList.contains('del-btn')){
      e.target.closest('tr').remove();
      refreshTotals();
    }
  });

  document.getElementById('addRow').addEventListener('click', ()=>{
    tbody.appendChild(rowTemplate());
    refreshTotals();
  });

  // 批量解析
  const parseBtn = document.getElementById('parseBulk');
  const clearBtn = document.getElementById('clearBulk');
  const bulkInput = document.getElementById('bulkInput');

  if(parseBtn && bulkInput){
    parseBtn.addEventListener('click', ()=>{
      try{
        const rows = parseBulkRows(bulkInput.value);
        applyBulkToTable(rows);
      }catch(err){
        alert(err?.message || String(err));
      }
    });
  }
  if(clearBtn && bulkInput){
    clearBtn.addEventListener('click', ()=>{ bulkInput.value=''; bulkInput.focus(); });
  }
  document.getElementById('savePNG').addEventListener('click', savePNG);
  document.getElementById('tradeDate').addEventListener('input', debouncedAutoSave);
}

function replaceInputsForExport(root){
  root.querySelectorAll('input.cell-input').forEach(inp=>{
    const div = document.createElement('div');
    div.className = inp.className.replace('cell-input', 'export-text');
    div.textContent = inp.value || '—';
    if(inp.classList.contains('pos')) div.classList.add('pos');
    if(inp.classList.contains('neg')) div.classList.add('neg');
    div.style.justifyContent = 'center';
    div.style.textAlign = 'center';
    inp.replaceWith(div);
  });

  root.querySelectorAll('select.status-input').forEach(sel=>{
    const meta = STATUS[sel.value] || STATUS.hit;
    const div = document.createElement('div');
    div.className = `status-select ${meta.cls} status-export`;
    div.textContent = meta.label;
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    sel.replaceWith(div);
  });

  const dateInp = root.querySelector('#tradeDate');
  if(dateInp){
    const div = document.createElement('div');
    div.className = 'bb-date-input-v8';
    div.textContent = dateInp.value || 'DATE';
    div.style.display = 'flex';
    div.style.justifyContent = 'center';
    div.style.alignItems = 'center';
    div.style.border = '1px solid rgba(255,255,255,0.1)';
    dateInp.replaceWith(div);
  }
}

async function savePNG(){
  const panel = document.getElementById('capturePanel');
  if (!window.html2canvas) return alert('Library Missing');

  const clone = panel.cloneNode(true);

  const srcInputs = panel.querySelectorAll('input, select');
  const dstInputs = clone.querySelectorAll('input, select');
  srcInputs.forEach((el, i) => { if(dstInputs[i]) dstInputs[i].value = el.value; });

  clone.querySelectorAll('button').forEach(b=>b.remove());
  const ths = clone.querySelectorAll('th');
  if(ths.length) ths[ths.length-1].remove();
  clone.querySelectorAll('tr').forEach(tr=>{
    const tds = tr.querySelectorAll('td');
    if(tds.length) tds[tds.length-1].remove();
  });

  replaceInputsForExport(clone);

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed; top:0; left:-9999px; width:${panel.offsetWidth}px`;
  wrap.appendChild(clone);
  document.body.appendChild(wrap);

  try{
    const canvas = await html2canvas(clone, {
      backgroundColor: '#101010',
      scale: 3,
      useCORS: true
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `BitBaby_PnL_${new Date().getTime()}.png`;
    a.click();
  }finally{
    wrap.remove();
  }
}



function autoSave(){
  const rows = [...document.querySelectorAll('#tbody tr')].map(r=>({
    pair: r.querySelector('.pair-input')?.value || '',
    amount: r.querySelector('.amount-input')?.value || '',
    profit: r.querySelector('.profit-input')?.value || '',
    status: r.querySelector('.status-input')?.value || 'hit'
  }));
  localStorage.setItem('bb_v7', JSON.stringify({
    date: document.getElementById('tradeDate').value,
    rows
  }));
}

function init(){
  setTodayIfEmpty();
  bindEvents();

  const raw = localStorage.getItem('bb_v7');
  if(raw){
    try{
      const d = JSON.parse(raw);
      if(d.date) document.getElementById('tradeDate').value = d.date;

      const tbody = document.getElementById('tbody');
      tbody.innerHTML = '';

      const rows = Array.isArray(d?.rows) ? d.rows : [];
      rows.forEach(r => {
        if (r && typeof r === 'object' && !('profit' in r)) r.profit = '';
        tbody.appendChild(rowTemplate(r || {}));
      });

      refreshTotals();
    }catch(e){
      const tbody = document.getElementById('tbody');
      tbody.innerHTML = '';
      tbody.appendChild(rowTemplate({ status:'hit' }));
      refreshTotals();
    }
  }
  else {
      const tbody = document.getElementById('tbody');
      tbody.innerHTML = '';
      tbody.appendChild(rowTemplate({ status:'hit' }));
      refreshTotals();
  }
}

document.addEventListener('DOMContentLoaded', init);
