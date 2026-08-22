function interp(data,v){for(let i=0;i<data.length-1;i++){let a=data[i],b=data[i+1];if(v==a[0])return a[1];if(v>=a[0]&&v<=b[0])return a[1]+(v-a[0])*(b[1]-a[1])/(b[0]-a[0]);}return null;}

function formatLiters(x){
  return x.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})+' L';
}

/* ---------- Animated counter (smooth count-up for result values) ---------- */
function animateCounter(el, toValue, formatFn, duration){
  formatFn = formatFn || formatLiters;
  duration = duration || 450;
  const fromValue = parseFloat(el.dataset.rawValue);
  const start = isNaN(fromValue) ? 0 : fromValue;

  if(el._counterRaf) cancelAnimationFrame(el._counterRaf);
  el.dataset.rawValue = toValue;

  if(Math.abs(toValue - start) < 0.05){
    el.innerText = formatFn(toValue);
    return;
  }

  const startTime = performance.now();
  function step(now){
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = start + (toValue - start) * eased;
    el.innerText = formatFn(current);
    if(t < 1){
      el._counterRaf = requestAnimationFrame(step);
    }
  }
  el._counterRaf = requestAnimationFrame(step);
}

function calc(id,data,res){
  const v=parseFloat(document.getElementById(id).value);
  const r=document.getElementById(res);
  const gaugeId='g'+id.slice(1);
  const pctId='p'+id.slice(1);
  const remId='rem'+id.slice(1);
  const gauge=document.getElementById(gaugeId);
  const pctEl=document.getElementById(pctId);
  const remEl=document.getElementById(remId);
  const readout=document.getElementById('readout'+id.slice(1));
  const maxLitres=data[data.length-1][1];

  r.classList.remove('is-error');

  if(isNaN(v)){
    if(r._counterRaf) cancelAnimationFrame(r._counterRaf);
    r.innerText=formatLiters(0);
    r.dataset.rawValue=0;
    if(gauge) gauge.style.height='0%';
    if(pctEl) pctEl.innerText='0% full';
    if(remEl) remEl.innerText='Rem. '+maxLitres.toLocaleString('en-US')+' L';
    if(readout) readout.classList.remove('has-value');
    return;
  }

  const x=interp(data,v);

  if(x==null){
    if(r._counterRaf) cancelAnimationFrame(r._counterRaf);
    r.innerText='Out of range';
    r.classList.add('is-error');
    r.dataset.rawValue=0;
    if(gauge) gauge.style.height='0%';
    if(pctEl) pctEl.innerText='check reading';
    if(remEl) remEl.innerText='Rem. —';
    if(readout) readout.classList.remove('has-value');
    return;
  }

  animateCounter(r, x);
  const pct=Math.max(0,Math.min(100,(x/maxLitres)*100));
  if(gauge) gauge.style.height=pct.toFixed(1)+'%';
  if(pctEl) pctEl.innerText=pct.toFixed(0)+'% full';
  if(remEl){
    const remaining=Math.max(0,maxLitres-x);
    remEl.innerText='Rem. '+remaining.toLocaleString('en-US',{maximumFractionDigits:0})+' L';
  }

  if(readout){
    readout.classList.remove('has-value');
    void readout.offsetWidth; /* restart pop animation */
    readout.classList.add('has-value');
  }
}

/* ---------- Clear a single tank's input ---------- */
function clearInput(inputId,data,res){
  const input=document.getElementById(inputId);
  input.value='';
  input.focus();
  calc(inputId,data,res);
}

/* ---------- Reverse lookup: litres -> dip (mm) ---------- */
function reverseCalc(inputId,data,resId,readoutId){
  const input=document.getElementById(inputId);
  const r=document.getElementById(resId);
  const readout=readoutId?document.getElementById(readoutId):null;
  const v=parseFloat(input.value);
  const minL=data[0][1];
  const maxL=data[data.length-1][1];

  r.classList.remove('is-error');

  if(isNaN(v)){
    if(r._counterRaf) cancelAnimationFrame(r._counterRaf);
    r.innerText='0.0 mm';
    r.dataset.rawValue=0;
    if(readout) readout.classList.remove('has-value');
    return;
  }

  if(v<minL||v>maxL){
    if(r._counterRaf) cancelAnimationFrame(r._counterRaf);
    r.innerText='Out of range';
    r.classList.add('is-error');
    r.dataset.rawValue=0;
    if(readout) readout.classList.remove('has-value');
    return;
  }

  const reversed=data.map(function(p){ return [p[1],p[0]]; });
  const mm=interp(reversed,v);

  if(mm==null){
    if(r._counterRaf) cancelAnimationFrame(r._counterRaf);
    r.innerText='Out of range';
    r.classList.add('is-error');
    r.dataset.rawValue=0;
    if(readout) readout.classList.remove('has-value');
    return;
  }

  animateCounter(r, mm, function(x){ return x.toFixed(1)+' mm'; });
  if(readout){
    readout.classList.remove('has-value');
    void readout.offsetWidth;
    readout.classList.add('has-value');
  }
}

/* ---------- Live clock ---------- */
function tickClock(){
  const el=document.getElementById('clock');
  if(!el) return;
  const now=new Date();
  const dayStr=now.toLocaleDateString(undefined,{weekday:'short'});
  const dateStr=now.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});
  const timeStr=now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  el.innerText=dayStr+', '+dateStr+'  •  '+timeStr;
}
setInterval(tickClock,1000);
tickClock();

/* ---------- Reading history (persisted in localStorage) ---------- */
const HISTORY_KEY='fuelDipHistory';
const HISTORY_LIMIT=200;

function loadHistory(){
  try{
    return JSON.parse(localStorage.getItem(HISTORY_KEY))||[];
  }catch(e){
    return [];
  }
}

function persistHistory(list){
  try{
    localStorage.setItem(HISTORY_KEY,JSON.stringify(list));
  }catch(e){ /* storage unavailable, ignore */ }
}

function saveReading(inputId,tankLabel){
  const input=document.getElementById(inputId);
  const resultEl=document.getElementById('r'+inputId.slice(1));
  const noteInput=document.getElementById('note'+inputId.slice(1));
  const dip=input.value;
  const volumeText=resultEl.innerText;

  if(dip===''||isNaN(parseFloat(dip))){
    resultEl.classList.add('is-error');
    return;
  }
  if(volumeText.toLowerCase().includes('out of range')) return;

  const now=new Date();
  const entry={
    tank:tankLabel,
    dip:parseFloat(dip),
    volume:volumeText,
    note:noteInput?noteInput.value.trim():'',
    day:now.toLocaleDateString(undefined,{weekday:'short'}),
    time:now.toLocaleString(undefined,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
  };

  const list=loadHistory();
  list.unshift(entry);
  if(list.length>HISTORY_LIMIT) list.length=HISTORY_LIMIT;
  persistHistory(list);
  if(noteInput) noteInput.value='';
  renderHistory();
}

function clearHistory(){
  const list=loadHistory();
  if(list.length===0) return;
  if(!confirm('Clear all '+list.length+' saved readings?\n\nThis cannot be undone.')) return;
  persistHistory([]);
  renderHistory();
}

function deleteReading(index){
  const list=loadHistory();
  if(index<0||index>=list.length) return;
  const e=list[index];
  const label=e.tank+' — '+e.dip+'mm ('+(e.day?e.day+', ':'')+e.time+')'+(e.note?'\nNote: '+e.note:'');
  if(!confirm('Delete this reading?\n\n'+label)) return;
  list.splice(index,1);
  persistHistory(list);
  renderHistory();
}

function escapeHtml(str){
  return String(str==null?'':str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function renderHistory(){
  const container=document.getElementById('historyList');
  if(!container) return;
  const list=loadHistory();

  if(list.length===0){
    container.innerHTML='<div class="history-empty">No readings saved yet.</div>';
    return;
  }

  container.innerHTML=list.map((e,i)=>
    '<div class="history-row'+(e.note?' has-note':'')+'">'+
      '<span class="history-tank">'+e.tank+'</span>'+
      '<span class="history-dip">'+e.dip+' mm</span>'+
      '<span class="history-vol">'+e.volume+'</span>'+
      '<span class="history-time">'+(e.day?e.day+', ':'')+e.time+'</span>'+
      '<button type="button" class="history-delete" onclick="deleteReading('+i+')" aria-label="Delete this reading">✕</button>'+
      (e.note?'<span class="history-note">📝 '+escapeHtml(e.note)+'</span>':'')+
    '</div>'
  ).join('');
}

renderHistory();

/* ---------- Share or download helper ---------- */
async function shareOrDownloadBlob(blob,filename,mime){
  try{
    if(navigator.canShare && navigator.share){
      const file=new File([blob],filename,{type:mime});
      if(navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:filename});
        return;
      }
    }
  }catch(e){ /* user cancelled or share unsupported — fall back to download */ }

  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Export CSV ---------- */
function csvEscape(val){
  const s=String(val==null?'':val);
  if(/[",\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}

function exportHistoryCSV(){
  const list=loadHistory();
  if(list.length===0){
    alert('No readings saved yet — nothing to export.');
    return;
  }

  const rows=[['Tank','Dip (mm)','Volume','Day','Date & Time','Note']];
  list.forEach(e=>{
    rows.push([e.tank,e.dip,e.volume,e.day||'',e.time,e.note||'']);
  });

  const csvContent=rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csvContent],{type:'text/csv;charset=utf-8;'});
  const stamp=new Date().toISOString().slice(0,10);
  shareOrDownloadBlob(blob,'fuel-dip-history-'+stamp+'.csv','text/csv');
}

/* ---------- Export PDF ---------- */
function exportHistoryPDF(){
  const list=loadHistory();
  if(list.length===0){
    alert('No readings saved yet — nothing to export.');
    return;
  }
  if(!window.jspdf || !window.jspdf.jsPDF){
    alert('PDF export needs an internet connection to load the first time. Please check your connection and try again.');
    return;
  }

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(37,99,235);
  doc.text('Al Mukhtar Petroleum',14,18);
  doc.setFontSize(11);
  doc.setTextColor(100,100,100);
  doc.text('Fuel Dip Reading Report',14,25);
  doc.setFontSize(9);
  doc.text('Generated: '+new Date().toLocaleString(),14,31);

  const rows=list.map(e=>[e.tank,e.dip+' mm',e.volume,e.day||'',e.time,e.note||'']);

  doc.autoTable({
    startY:36,
    head:[['Tank','Dip','Volume','Day','Date & Time','Note']],
    body:rows,
    headStyles:{fillColor:[37,99,235]},
    styles:{fontSize:9}
  });

  const stamp=new Date().toISOString().slice(0,10);
  const blob=doc.output('blob');
  shareOrDownloadBlob(blob,'fuel-dip-history-'+stamp+'.pdf','application/pdf');
}

/* ---------- Export Excel ---------- */
function exportHistoryExcel(){
  const list=loadHistory();
  if(list.length===0){
    alert('No readings saved yet — nothing to export.');
    return;
  }
  if(!window.XLSX){
    alert('Excel export needs an internet connection to load the first time. Please check your connection and try again.');
    return;
  }

  const rows=[['Tank','Dip (mm)','Volume','Day','Date & Time','Note']];
  list.forEach(e=>rows.push([e.tank,e.dip,e.volume,e.day||'',e.time,e.note||'']));

  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:10},{wch:10},{wch:14},{wch:8},{wch:20},{wch:28}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Dip History');

  const stamp=new Date().toISOString().slice(0,10);
  const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  const blob=new Blob([wbout],{type:'application/octet-stream'});
  shareOrDownloadBlob(blob,'fuel-dip-history-'+stamp+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ---------- WhatsApp share ---------- */
function shareHistoryWhatsApp(){
  const list=loadHistory();
  if(list.length===0){
    alert('No readings saved yet — nothing to share.');
    return;
  }

  const recent=list.slice(0,20);
  let msg='*Al Mukhtar Petroleum — Fuel Dip Readings*\n\n';
  recent.forEach(e=>{
    const dayPart=e.day?e.day+', ':'';
    const notePart=e.note?' — 📝 '+e.note:'';
    msg+='• '+e.tank+' — '+e.dip+'mm → '+e.volume+' ('+dayPart+e.time+')'+notePart+'\n';
  });
  msg+='\nSent from Fuel Dip Calculator app.';

  const url='https://api.whatsapp.com/send?text='+encodeURIComponent(msg);
  window.open(url,'_blank','noopener');
}

/* ---------- Color scheme (Shell / Classic Blue / Premium Dark) — controlled from Settings ---------- */
const SCHEME_KEY='fuelDipColorScheme';

const SCHEME_ICONS={
  shell:   { 192:'icon-192-shell.png',   512:'icon-512-shell.png' },
  classic: { 192:'icon-192-classic.png', 512:'icon-512-classic.png' },
  v1:      { 192:'icon-192-v1.png',      512:'icon-512-v1.png' },
  win11:   { 192:'icon-192-win11.png',   512:'icon-512-win11.png' }
};

function applyScheme(scheme){
  const valid=['shell','classic','v1','win11'];
  const s = valid.includes(scheme) ? scheme : 'shell';
  document.body.classList.toggle('theme-shell', s==='shell');
  document.body.classList.toggle('theme-classic', s==='classic');
  document.body.classList.toggle('theme-v1', s==='v1');
  document.body.classList.toggle('theme-win11', s==='win11');

  const sel=document.getElementById('colorSchemeSelect');
  if(sel) sel.value=s;

  document.querySelectorAll('.theme-preview-card').forEach(function(card){
    card.classList.toggle('is-selected', card.dataset.scheme===s);
  });

  const icons=SCHEME_ICONS[s];
  if(icons){
    const favicon=document.getElementById('faviconLink');
    const appleIcon=document.getElementById('appleIconLink');
    if(favicon) favicon.setAttribute('href', icons[192]);
    if(appleIcon) appleIcon.setAttribute('href', icons[192]);
  }
}

function onSchemeChange(value){
  applyScheme(value);
  try{ localStorage.setItem(SCHEME_KEY,value); }catch(e){}
}

(function initScheme(){
  let saved='shell';
  try{ saved=localStorage.getItem(SCHEME_KEY)||'shell'; }catch(e){}
  applyScheme(saved);
})();

/* ---------- View Settings (Mobile View / Desktop View) ---------- */
const VIEW_KEY='fuelDipViewMode';

function applyViewMode(mode){
  const valid=['mobile','desktop'];
  const m = valid.includes(mode) ? mode : 'mobile';
  document.body.classList.toggle('view-mobile', m==='mobile');
  document.body.classList.toggle('view-desktop', m==='desktop');
  document.querySelectorAll('.view-toggle-btn').forEach(function(btn){
    btn.classList.toggle('is-selected', btn.dataset.view===m);
  });
}

function onViewModeChange(value){
  applyViewMode(value);
  try{ localStorage.setItem(VIEW_KEY,value); }catch(e){}
}

(function initViewMode(){
  let saved='mobile';
  try{ saved=localStorage.getItem(VIEW_KEY)||'mobile'; }catch(e){}
  applyViewMode(saved);
})();

/* ---------- Language (English / Urdu / Roman Urdu) ---------- */
const LANG_KEY='fuelDipLanguage';

const I18N={
  en:{
    'nav.home':'Home', 'nav.tanks':'Tanks', 'nav.reports':'Reports', 'nav.chart':'Dip Chart', 'nav.settings':'Settings',
    'tank.dipReading':'📏 Dip reading', 'tank.availableFuel':'⛽ Available Fuel', 'tank.note':'📝 Note (optional)',
    'tank.save':'💾 Save reading', 'tank.copy':'📋 Copy Result', 'tank.clear':'✕ Clear',
    'tank.reverseLookup':'🔄 Reverse Lookup — Litres → Dip', 'tank.enterLitres':'⛽ Enter litres', 'tank.estimatedDip':'📏 Estimated Dip',
    'settings.title':'⚙️ App Settings', 'settings.colorScheme':'🎨 Color Scheme', 'settings.language':'🌐 Language',
    'settings.pinLock':'🔒 PIN Lock', 'settings.about':'ℹ️ About Application', 'settings.viewMode':'📐 View Settings'
  },
  ru:{
    'nav.home':'Home', 'nav.tanks':'Tanks', 'nav.reports':'Reports', 'nav.chart':'Dip Chart', 'nav.settings':'Settings',
    'tank.dipReading':'📏 Dip Reading', 'tank.availableFuel':'⛽ Available Fuel', 'tank.note':'📝 Note (optional)',
    'tank.save':'💾 Reading Save Karein', 'tank.copy':'📋 Result Copy Karein', 'tank.clear':'✕ Clear Karein',
    'tank.reverseLookup':'🔄 Reverse Lookup — Litres → Dip', 'tank.enterLitres':'⛽ Litres Darj Karein', 'tank.estimatedDip':'📏 Takhmeeni Dip',
    'settings.title':'⚙️ App Settings', 'settings.colorScheme':'🎨 Color Theme', 'settings.language':'🌐 Zabaan',
    'settings.pinLock':'🔒 PIN Lock', 'settings.about':'ℹ️ App Ke Baare Mein', 'settings.viewMode':'📐 View Settings'
  }
};

function applyLanguage(lang){
  const valid=['en','ru'];
  const l = valid.includes(lang) ? lang : 'en';
  const dict = I18N[l];

  document.querySelectorAll('[data-i18n]').forEach(function(el){
    const key=el.getAttribute('data-i18n');
    if(dict[key]) el.textContent=dict[key];
  });

  document.documentElement.setAttribute('dir', l==='ur' ? 'rtl' : 'ltr');
  document.body.classList.toggle('lang-urdu', l==='ur');

  const sel=document.getElementById('languageSelect');
  if(sel) sel.value=l;
}

function onLanguageChange(value){
  applyLanguage(value);
  try{ localStorage.setItem(LANG_KEY,value); }catch(e){}
}

(function initLanguage(){
  let saved='en';
  try{ saved=localStorage.getItem(LANG_KEY)||'en'; }catch(e){}
  applyLanguage(saved);
})();

/* ---------- PIN Lock ---------- */
const PIN_ENABLED_KEY='fuelDipPinEnabled';
const PIN_VALUE_KEY='fuelDipPinValue';

function getPinEnabled(){
  try{ return localStorage.getItem(PIN_ENABLED_KEY)==='1'; }catch(e){ return false; }
}
function getPinValue(){
  try{ return localStorage.getItem(PIN_VALUE_KEY)||''; }catch(e){ return ''; }
}

function checkLockOnLoad(){
  const enabled=getPinEnabled();
  const pin=getPinValue();
  const lockScreen=document.getElementById('lockScreen');
  const appContent=document.getElementById('appContent');
  if(enabled && pin){
    lockScreen.style.display='flex';
    appContent.style.display='none';
    setTimeout(()=>{ const inp=document.getElementById('lockInput'); if(inp) inp.focus(); },100);
  }else{
    lockScreen.style.display='none';
    appContent.style.display='block';
  }
}

function attemptUnlock(){
  const input=document.getElementById('lockInput');
  const err=document.getElementById('lockError');
  const entered=input.value;
  const correct=getPinValue();
  if(entered===correct && entered!==''){
    document.getElementById('lockScreen').style.display='none';
    document.getElementById('appContent').style.display='block';
    err.innerText='';
    input.value='';
  }else{
    err.innerText='Incorrect PIN. Try again.';
    input.value='';
    input.focus();
  }
}

// allow Enter key to submit PIN
(function(){
  const lockInput=document.getElementById('lockInput');
  if(lockInput){
    lockInput.addEventListener('keydown',function(e){
      if(e.key==='Enter') attemptUnlock();
    });
  }
})();

/* ---------- Settings modal ---------- */
function openSettings(){
  const modal=document.getElementById('settingsModal');
  const toggle=document.getElementById('pinEnabledToggle');
  toggle.checked=getPinEnabled();
  updatePinSetupVisibility();
  document.getElementById('pinSetupMsg').innerText='';
  document.getElementById('newPin').value='';
  document.getElementById('confirmPin').value='';

  const currentScheme = document.body.classList.contains('theme-v1') ? 'v1'
    : document.body.classList.contains('theme-classic') ? 'classic'
    : document.body.classList.contains('theme-win11') ? 'win11'
    : 'shell';
  document.querySelectorAll('.theme-preview-card').forEach(function(card){
    card.classList.toggle('is-selected', card.dataset.scheme===currentScheme);
  });

  const currentView = document.body.classList.contains('view-desktop') ? 'desktop' : 'mobile';
  document.querySelectorAll('.view-toggle-btn').forEach(function(btn){
    btn.classList.toggle('is-selected', btn.dataset.view===currentView);
  });

  const langSel=document.getElementById('languageSelect');
  if(langSel){
    let savedLang='en';
    try{ savedLang=localStorage.getItem(LANG_KEY)||'en'; }catch(e){}
    langSel.value=savedLang;
  }

  renderLastBackupInfo();
  loadSiteDetailsIntoSettings();

  modal.style.display='flex';
}

function closeSettings(){
  document.getElementById('settingsModal').style.display='none';
}

function closeSettingsOnBg(e){
  if(e.target.id==='settingsModal') closeSettings();
}

function openAbout(){
  document.getElementById('aboutModal').style.display='flex';
}

function closeAbout(){
  document.getElementById('aboutModal').style.display='none';
}

function closeAboutOnBg(e){
  if(e.target.id==='aboutModal') closeAbout();
}

function updatePinSetupVisibility(){
  const enabled=document.getElementById('pinEnabledToggle').checked;
  document.getElementById('pinSetupBlock').setAttribute('data-hidden', enabled ? 'false' : 'true');
}

function togglePinEnabled(){
  const enabled=document.getElementById('pinEnabledToggle').checked;
  const existingPin=getPinValue();

  if(enabled && !existingPin){
    // no pin set yet — force setup, don't enable until a PIN is saved
    updatePinSetupVisibility();
    document.getElementById('pinSetupMsg').innerText='Please set a PIN below to enable lock.';
    document.getElementById('pinSetupMsg').className='pin-setup-msg';
    return;
  }

  try{ localStorage.setItem(PIN_ENABLED_KEY, enabled ? '1' : '0'); }catch(e){}
  updatePinSetupVisibility();
}

function savePin(){
  const newPin=document.getElementById('newPin').value;
  const confirmPin=document.getElementById('confirmPin').value;
  const msg=document.getElementById('pinSetupMsg');

  if(newPin===''){
    msg.innerText='PIN cannot be empty.';
    msg.className='pin-setup-msg err';
    return;
  }
  if(newPin!==confirmPin){
    msg.innerText='PINs do not match.';
    msg.className='pin-setup-msg err';
    return;
  }

  try{
    localStorage.setItem(PIN_VALUE_KEY, newPin);
    localStorage.setItem(PIN_ENABLED_KEY, '1');
  }catch(e){}

  document.getElementById('pinEnabledToggle').checked=true;
  msg.innerText='PIN saved. Lock is now enabled.';
  msg.className='pin-setup-msg ok';
  document.getElementById('newPin').value='';
  document.getElementById('confirmPin').value='';
}

/* ---------- Backup & Restore ---------- */
const BACKUP_TIME_KEY='fuelDipLastBackup';

function formatBackupDate(ts){
  if(!ts) return null;
  try{
    const d=new Date(Number(ts));
    if(isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined,{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }catch(e){ return null; }
}

function renderLastBackupInfo(){
  const el=document.getElementById('lastBackupInfo');
  if(!el) return;
  let ts=null;
  try{ ts=localStorage.getItem(BACKUP_TIME_KEY); }catch(e){}
  const formatted=formatBackupDate(ts);
  el.innerText='Last backup: '+(formatted || 'Never');
}

function downloadBackup(){
  try{
    const data={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      data[k]=localStorage.getItem(k);
    }
    const nowTs=Date.now();
    const backup={
      app:'Fuel Dip Calculator',
      exportedAt:new Date(nowTs).toISOString(),
      data:data
    };
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const stamp=new Date(nowTs).toISOString().slice(0,19).replace(/[:T]/g,'-');
    const a=document.createElement('a');
    a.href=url;
    a.download='fuel-dip-backup-'+stamp+'.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); },1000);

    try{ localStorage.setItem(BACKUP_TIME_KEY,String(nowTs)); }catch(e){}
    renderLastBackupInfo();
  }catch(e){
    alert('Backup download nahi ho saka. Dobara koshish karein.');
  }
}

function triggerRestoreFile(){
  const input=document.getElementById('restoreFileInput');
  if(input) input.click();
}

function restoreBackupFile(input){
  const file=input.files && input.files[0];
  if(!file) return;

  const reader=new FileReader();
  reader.onload=function(e){
    let parsed;
    try{
      parsed=JSON.parse(e.target.result);
    }catch(err){
      alert('Ye sahi backup file nahi hai.');
      input.value='';
      return;
    }

    if(!parsed || typeof parsed.data!=='object' || parsed.data===null){
      alert('Ye sahi backup file nahi hai.');
      input.value='';
      return;
    }

    const itemCount=Object.keys(parsed.data).length;
    const whenText=parsed.exportedAt ? (formatBackupDate(new Date(parsed.exportedAt).getTime())||parsed.exportedAt) : 'unknown date';
    const ok=confirm('Backup file mili — '+whenText+' ki ('+itemCount+' items).\n\nYe maujooda data ko replace kar dega. Continue karein?');
    if(!ok){
      input.value='';
      return;
    }

    try{
      Object.keys(parsed.data).forEach(function(k){
        localStorage.setItem(k,parsed.data[k]);
      });
      alert('Backup restore ho gayi! App ab reload ho raha hai.');
      location.reload();
    }catch(err){
      alert('Restore karte waqt masla hua. Dobara koshish karein.');
    }
    input.value='';
  };
  reader.onerror=function(){
    alert('File parh nahi saki. Dobara koshish karein.');
    input.value='';
  };
  reader.readAsText(file);
}

/* ---------- Site Name & Address ---------- */
const SITE_NAME_KEY='fuelDipSiteName';
const SITE_ADDRESS_KEY='fuelDipSiteAddress';

function applySiteDetails(){
  let name='', address='';
  try{
    name=localStorage.getItem(SITE_NAME_KEY)||'';
    address=localStorage.getItem(SITE_ADDRESS_KEY)||'';
  }catch(e){}

  const nameEl=document.getElementById('customerNameDisplay');
  if(nameEl && name){ nameEl.textContent=name; }

  const addrEl=document.getElementById('plateAddress');
  if(addrEl){
    if(address){
      addrEl.textContent=address;
      addrEl.style.display='block';
    }else{
      addrEl.style.display='none';
    }
  }
}

function loadSiteDetailsIntoSettings(){
  const nameInput=document.getElementById('siteNameInput');
  const addrInput=document.getElementById('siteAddressInput');
  if(!nameInput || !addrInput) return;

  let savedName='', savedAddress='';
  try{
    savedName=localStorage.getItem(SITE_NAME_KEY)||'';
    savedAddress=localStorage.getItem(SITE_ADDRESS_KEY)||'';
  }catch(e){}

  const nameEl=document.getElementById('customerNameDisplay');
  nameInput.value=savedName || (nameEl ? nameEl.textContent.trim() : '');
  addrInput.value=savedAddress;

  const msg=document.getElementById('siteDetailsMsg');
  if(msg){ msg.innerText=''; msg.className='pin-setup-msg'; }
}

function saveSiteDetails(){
  const nameInput=document.getElementById('siteNameInput');
  const addrInput=document.getElementById('siteAddressInput');
  const msg=document.getElementById('siteDetailsMsg');

  const name=nameInput.value.trim();
  const address=addrInput.value.trim();

  if(name===''){
    msg.innerText='Site name khali nahi ho sakta.';
    msg.className='pin-setup-msg err';
    return;
  }

  try{
    localStorage.setItem(SITE_NAME_KEY,name);
    localStorage.setItem(SITE_ADDRESS_KEY,address);
  }catch(e){}

  applySiteDetails();
  msg.innerText='Site details save ho gayi.';
  msg.className='pin-setup-msg ok';
}

/* ---------- Bismillah splash screen ---------- */
function hideSplashAndReveal(){
  const splash=document.getElementById('splashScreen');
  applySiteDetails();
  checkLockOnLoad();
  if(!splash) return;
  splash.classList.add('splash-hide');
  setTimeout(function(){ splash.style.display='none'; },650);
}
applySiteDetails();
setTimeout(hideSplashAndReveal,4800);

/* ---------- Dip Chart page (multi-tank calibration reference table) ---------- */
const CHART_TANKS={ t50:{data:tank50,label:'50-KL Tank'}, t25:{data:tank25,label:'25-KL Tank'} };
let chartActiveTank='t50';
let chartSearchMode='mm';

function renderChartTable(data,containerId,numCols){
  const container=document.getElementById(containerId);
  if(!container) return;

  numCols=numCols||2;
  const perCol=Math.ceil(data.length/numCols);
  const chunks=[];
  for(let c=0;c<numCols;c++){
    chunks.push(data.slice(c*perCol,c*perCol+perCol));
  }

  let html='<table class="chart-table"><thead><tr>';
  for(let c=0;c<numCols;c++){
    html+='<th>Fill (mm)</th><th>Volume (L)</th>';
  }
  html+='</tr></thead><tbody>';

  for(let row=0;row<perCol;row++){
    html+='<tr>';
    for(let c=0;c<numCols;c++){
      const pair=chunks[c][row];
      if(pair){
        html+='<td data-mm="'+pair[0]+'">'+pair[0]+'</td><td>'+pair[1].toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>';
      }else{
        html+='<td></td><td></td>';
      }
    }
    html+='</tr>';
  }
  html+='</tbody></table>';

  container.innerHTML=html;
}

function setChartTank(tankId){
  if(!CHART_TANKS[tankId]) return;
  chartActiveTank=tankId;

  document.querySelectorAll('.chart-tank-toggle .mode-btn').forEach(function(b){
    b.classList.toggle('is-active', b.dataset.tank===tankId);
  });

  renderChartTable(CHART_TANKS[tankId].data,'chartTableWrap',2);
  document.getElementById('chartSearchInput').value='';
  document.getElementById('chartSearchResult').innerHTML='';
  clearChartHighlight();
}

function setChartSearchMode(mode){
  chartSearchMode=mode;
  document.querySelectorAll('.chart-search-toggle .mode-btn').forEach(function(b){
    b.classList.toggle('is-active', b.dataset.mode===mode);
  });

  const input=document.getElementById('chartSearchInput');
  const icon=document.getElementById('chartSearchIcon');
  const suffix=document.getElementById('chartSearchSuffix');

  if(mode==='mm'){
    input.placeholder='Enter dip in mm';
    icon.innerText='📏';
    suffix.innerText='mm';
  }else{
    input.placeholder='Enter litres';
    icon.innerText='⛽';
    suffix.innerText='L';
  }

  input.value='';
  document.getElementById('chartSearchResult').innerHTML='';
  clearChartHighlight();
  input.focus();
}

function onChartSearch(){
  const data=CHART_TANKS[chartActiveTank].data;
  const input=document.getElementById('chartSearchInput');
  const resultEl=document.getElementById('chartSearchResult');
  const v=parseFloat(input.value);

  clearChartHighlight();

  if(isNaN(v)){
    resultEl.innerHTML='';
    return;
  }

  if(chartSearchMode==='mm'){
    const minMm=data[0][0], maxMm=data[data.length-1][0];
    if(v<minMm||v>maxMm){
      resultEl.innerHTML='<span class="chart-search-error">Out of range</span>';
      return;
    }
    const litres=interp(data,v);
    resultEl.innerHTML='📏 '+v+' mm&nbsp;→&nbsp;<strong>'+litres.toFixed(2)+' L</strong>';
    highlightNearestMm(v);
  }else{
    const minL=data[0][1], maxL=data[data.length-1][1];
    if(v<minL||v>maxL){
      resultEl.innerHTML='<span class="chart-search-error">Out of range</span>';
      return;
    }
    const reversed=data.map(function(p){ return [p[1],p[0]]; });
    const mm=interp(reversed,v);
    resultEl.innerHTML='⛽ '+v+' L&nbsp;→&nbsp;<strong>'+mm.toFixed(1)+' mm</strong>';
    highlightNearestMm(mm);
  }
}

function highlightNearestMm(mmValue){
  const wrap=document.getElementById('chartTableWrap');
  if(!wrap) return;

  let nearestTd=null, nearestDiff=Infinity;
  wrap.querySelectorAll('td[data-mm]').forEach(function(td){
    const diff=Math.abs(parseFloat(td.dataset.mm)-mmValue);
    if(diff<nearestDiff){ nearestDiff=diff; nearestTd=td; }
  });

  if(nearestTd){
    const tr=nearestTd.closest('tr');
    tr.classList.add('row-highlight');
    tr.scrollIntoView({block:'center',behavior:'smooth'});
  }
}

function clearChartHighlight(){
  document.querySelectorAll('.chart-table tr.row-highlight').forEach(function(tr){
    tr.classList.remove('row-highlight');
  });
}

renderChartTable(tank50,'chartTableWrap',2);

/* ---------- Copy Result to clipboard ---------- */
function copyResult(dipId, valueId, noteId, btnId, tankLabel){
  const dipEl = document.getElementById(dipId);
  const el = document.getElementById(valueId);
  const noteEl = noteId ? document.getElementById(noteId) : null;
  const btn = document.getElementById(btnId);
  if(!el) return;

  const dip = dipEl ? dipEl.value.trim() : '';
  const volume = el.textContent.trim();
  const note = noteEl ? noteEl.value.trim() : '';
  const now = new Date();
  const dayStr = now.toLocaleDateString(undefined,{weekday:'short'});
  const dateTimeStr = now.toLocaleString(undefined,{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

  let text = 'Tank: '+(tankLabel||'')+'\n'+
    'Dip: '+(dip!==''?dip+' mm':'—')+'\n'+
    'Available Fuel: '+volume+'\n'+
    'Note: '+(note!==''?note:'—')+'\n'+
    'Date & Time: '+dayStr+', '+dateTimeStr;

  const showCopied = function(){
    if(!btn) return;
    if(!btn.dataset.label) btn.dataset.label = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.classList.add('is-copied');
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(function(){
      btn.innerHTML = btn.dataset.label;
      btn.classList.remove('is-copied');
    }, 1500);
  };

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(showCopied).catch(function(){
      fallbackCopy(text, showCopied);
    });
  } else {
    fallbackCopy(text, showCopied);
  }
}

function fallbackCopy(text, done){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
  if(done) done();
}

/* ---------- Bottom nav — tab panel switcher ---------- */
function showPanel(navId){
  document.querySelectorAll('.app-panel[data-panel]').forEach(function(panel){
    panel.style.display=(panel.dataset.panel===navId)?'flex':'none';
  });
  document.querySelectorAll('.bottom-nav .nav-item[data-nav]').forEach(function(item){
    item.classList.toggle('is-active', item.dataset.nav===navId);
  });
}

/* ================= Fuel Tanker Unloading Status ================= */
const UNLOAD_TANKS={ t50:{data:tank50,label:'50-KL Tank'}, t25:{data:tank25,label:'25-KL Tank'} };
const UNLOAD_HISTORY_KEY='fuelTankerUnloadHistory';
const UNLOAD_HISTORY_LIMIT=200;

function fmtNum(x){
  if(x==null||isNaN(x)) return '0.00';
  return x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function calcUnload(){
  const tankSel=document.getElementById('ul_tank').value;
  const tank=UNLOAD_TANKS[tankSel];
  const curDip=parseFloat(document.getElementById('ul_curDip').value);
  const prvDip=parseFloat(document.getElementById('ul_prvDip').value);
  const saleInput=parseFloat(document.getElementById('ul_sale').value);
  const invInput=parseFloat(document.getElementById('ul_invStock').value);

  const curLtrs = isNaN(curDip)?null:interp(tank.data,curDip);
  const prvLtrs = isNaN(prvDip)?null:interp(tank.data,prvDip);

  document.getElementById('ul_curLtrs').innerText = curLtrs!=null ? fmtNum(curLtrs)+' L' : '— L';
  document.getElementById('ul_prvLtrs').innerText = prvLtrs!=null ? fmtNum(prvLtrs)+' L' : '— L';

  let balance=null;
  if(curLtrs!=null && prvLtrs!=null) balance=curLtrs-prvLtrs;
  document.getElementById('ul_balance').innerText = fmtNum(balance);

  const sale = isNaN(saleInput)?0:saleInput;
  const totalLiters = balance!=null ? balance+sale : null;
  document.getElementById('ul_totalLiters').innerText = fmtNum(totalLiters);
  document.getElementById('ul_totalStock').innerText = fmtNum(totalLiters);

  const invStock = isNaN(invInput)?null:invInput;
  let stEx=null;
  if(totalLiters!=null && invStock!=null) stEx = totalLiters - invStock;
  const stExEl=document.getElementById('ul_stEx');
  stExEl.innerText = stEx!=null ? (stEx>=0?'+':'')+fmtNum(stEx) : '0.00';
  stExEl.classList.toggle('is-excess', stEx!=null && stEx>0);
  stExEl.classList.toggle('is-short', stEx!=null && stEx<0);

  updateUnloadReceipt();
}

function gatherUnloadData(){
  const tankSel=document.getElementById('ul_tank').value;
  const tank=UNLOAD_TANKS[tankSel];
  return {
    date: document.getElementById('ul_date').value || new Date().toISOString().slice(0,10),
    vendor: document.getElementById('ul_vendor').value.trim(),
    vehicle: document.getElementById('ul_vehicle').value.trim(),
    driver: document.getElementById('ul_driver').value.trim(),
    contact: document.getElementById('ul_contact').value.trim(),
    tankLabel: tank.label,
    curDip: document.getElementById('ul_curDip').value,
    curLtrs: document.getElementById('ul_curLtrs').innerText,
    prvDip: document.getElementById('ul_prvDip').value,
    prvLtrs: document.getElementById('ul_prvLtrs').innerText,
    balance: document.getElementById('ul_balance').innerText,
    sale: document.getElementById('ul_sale').value || '0',
    totalLiters: document.getElementById('ul_totalLiters').innerText,
    totalStock: document.getElementById('ul_totalStock').innerText,
    invStock: document.getElementById('ul_invStock').value,
    stEx: document.getElementById('ul_stEx').innerText,
    savedAt: new Date().toLocaleString(undefined,{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  };
}

function updateUnloadReceipt(){
  const d=gatherUnloadData();
  document.getElementById('rc_date').innerText = d.date || '-';
  document.getElementById('rc_vendor').innerText = d.vendor || '-';
  document.getElementById('rc_vehicle').innerText = d.vehicle || '-';
  document.getElementById('rc_driver').innerText = d.driver || '-';
  document.getElementById('rc_contact').innerText = d.contact || '-';
  document.getElementById('rc_tank').innerText = d.tankLabel || '-';
  document.getElementById('rc_curDip').innerText = d.curDip? d.curDip+' mm':'-';
  document.getElementById('rc_curLtrs').innerText = d.curLtrs || '-';
  document.getElementById('rc_prvDip').innerText = d.prvDip? d.prvDip+' mm':'-';
  document.getElementById('rc_prvLtrs').innerText = d.prvLtrs || '-';
  document.getElementById('rc_balance').innerText = d.balance;
  document.getElementById('rc_sale').innerText = d.sale;
  document.getElementById('rc_totalLiters').innerText = d.totalLiters;
  document.getElementById('rc_totalStock').innerText = d.totalStock;
  document.getElementById('rc_invStock').innerText = d.invStock || '-';
  document.getElementById('rc_stEx').innerText = d.stEx;
  const footer=document.getElementById('rc_footer');
  if(footer) footer.innerText='Generated: '+new Date().toLocaleString();
}

/* ---------- Unload history (save / render / delete / clear) ---------- */
function loadUnloadHistory(){
  try{ return JSON.parse(localStorage.getItem(UNLOAD_HISTORY_KEY))||[]; }catch(e){ return []; }
}
function persistUnloadHistory(list){
  try{ localStorage.setItem(UNLOAD_HISTORY_KEY,JSON.stringify(list)); }catch(e){}
}

function saveUnloadEntry(){
  calcUnload();
  const d=gatherUnloadData();
  if(!d.vendor && !d.vehicle){
    alert('Vendor Name ya Vehicle No zaroor darj karein.');
    return;
  }
  const list=loadUnloadHistory();
  list.unshift(d);
  if(list.length>UNLOAD_HISTORY_LIMIT) list.length=UNLOAD_HISTORY_LIMIT;
  persistUnloadHistory(list);
  renderUnloadHistory();
  alert('Unloading record save ho gaya.');
}

function clearUnloadHistory(){
  const list=loadUnloadHistory();
  if(list.length===0) return;
  if(!confirm('Clear all '+list.length+' unloading records?\n\nThis cannot be undone.')) return;
  persistUnloadHistory([]);
  renderUnloadHistory();
}

function deleteUnloadEntry(index){
  const list=loadUnloadHistory();
  if(index<0||index>=list.length) return;
  const e=list[index];
  if(!confirm('Delete this unloading record?\n\n'+(e.vehicle||e.vendor||'')+' — '+e.date)) return;
  list.splice(index,1);
  persistUnloadHistory(list);
  renderUnloadHistory();
}

function renderUnloadHistory(){
  const container=document.getElementById('unloadHistoryList');
  if(!container) return;
  const list=loadUnloadHistory();

  if(list.length===0){
    container.innerHTML='<div class="history-empty">No unloading records saved yet.</div>';
    return;
  }

  container.innerHTML=list.map((e,i)=>
    '<div class="history-row">'+
      '<span class="history-tank">'+escapeHtml(e.vehicle||e.vendor||'—')+'</span>'+
      '<span class="history-dip">'+escapeHtml(e.tankLabel||'')+'</span>'+
      '<span class="history-vol">'+escapeHtml(e.totalLiters||'0.00')+' L</span>'+
      '<span class="history-time">'+escapeHtml(e.date||'')+'</span>'+
      '<button type="button" class="history-delete" onclick="deleteUnloadEntry('+i+')" aria-label="Delete this record">✕</button>'+
    '</div>'
  ).join('');
}

/* ---------- Print unloading status (opens print-ready window) ---------- */
function printUnload(){
  calcUnload();
  const d=gatherUnloadData();
  const w=window.open('','_blank');
  if(!w){ alert('Popup blocked. Please allow popups to print.'); return; }

  const html='<!doctype html><html><head><meta charset="utf-8"><title>Unloading Status</title>'+
    '<style>'+
    'body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#1a1a1a;}'+
    'h2{background:#37474f;color:#fff;padding:12px 14px;margin:0 0 16px;border-radius:6px;font-size:18px;}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:16px;}'+
    'td,th{border:1px solid #999;padding:8px 10px;font-size:14px;}'+
    'td:first-child{font-weight:700;background:#f3f3f3;width:42%;}'+
    'th{background:#eceff1;font-weight:700;}'+
    '.total-row td{font-weight:800;background:#fff8e1;}'+
    'p.foot{font-size:11px;color:#777;margin-top:20px;}'+
    '</style></head><body>'+
    '<h2>Vehicle Unloading Tank Status</h2>'+
    '<table>'+
      '<tr><td>Date</td><td>'+escapeHtml(d.date)+'</td></tr>'+
      '<tr><td>Vendor Name</td><td>'+escapeHtml(d.vendor||'-')+'</td></tr>'+
      '<tr><td>Vehicle No</td><td>'+escapeHtml(d.vehicle||'-')+'</td></tr>'+
      '<tr><td>Driver Name</td><td>'+escapeHtml(d.driver||'-')+'</td></tr>'+
      '<tr><td>Contact No</td><td>'+escapeHtml(d.contact||'-')+'</td></tr>'+
      '<tr><td>Unloading Tank</td><td>'+escapeHtml(d.tankLabel)+'</td></tr>'+
    '</table>'+
    '<table>'+
      '<tr><th>Description</th><th>Dips</th><th>Ltrs</th></tr>'+
      '<tr><td>Current Dip &amp; Ltrs</td><td>'+(d.curDip?d.curDip+' mm':'-')+'</td><td>'+d.curLtrs+'</td></tr>'+
      '<tr><td>Prv Dip &amp; Ltrs</td><td>'+(d.prvDip?d.prvDip+' mm':'-')+'</td><td>'+d.prvLtrs+'</td></tr>'+
      '<tr><td colspan="2">Balance Liters</td><td>'+d.balance+'</td></tr>'+
      '<tr><td colspan="2">Sale Liters</td><td>'+d.sale+'</td></tr>'+
      '<tr class="total-row"><td colspan="2">TOTAL LITERS</td><td>'+d.totalLiters+'</td></tr>'+
    '</table>'+
    '<table>'+
      '<tr><td>TOTAL STOCK</td><td>'+d.totalStock+'</td></tr>'+
      '<tr><td>INV STOCK</td><td>'+(d.invStock||'-')+'</td></tr>'+
      '<tr><td>ST / EX LITER</td><td>'+d.stEx+'</td></tr>'+
    '</table>'+
    '<p class="foot">Generated: '+new Date().toLocaleString()+'</p>'+
    '</body></html>';

  w.document.write(html);
  w.document.close();
  w.onload=function(){ w.focus(); w.print(); };
}

/* ---------- Share unloading status as image (PNG) ---------- */
async function shareUnloadImage(){
  calcUnload();
  if(!window.html2canvas){
    alert('Image share needs an internet connection to load the first time. Please check your connection and try again.');
    return;
  }
  const el=document.getElementById('unloadReceipt');
  try{
    const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff'});
    canvas.toBlob(function(blob){
      if(!blob) return;
      const stamp=new Date().toISOString().slice(0,10);
      shareOrDownloadBlob(blob,'unloading-status-'+stamp+'.png','image/png');
    },'image/png');
  }catch(e){
    alert('Image banate waqt masla hua. Dobara koshish karein.');
  }
}

/* ---------- Init ---------- */
(function initUnload(){
  const dateInput=document.getElementById('ul_date');
  if(dateInput && !dateInput.value){
    dateInput.value=new Date().toISOString().slice(0,10);
  }
  calcUnload();
  renderUnloadHistory();
})();
