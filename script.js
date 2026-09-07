function interp(data,v){for(let i=0;i<data.length-1;i++){let a=data[i],b=data[i+1];if(v==a[0])return a[1];if(v>=a[0]&&v<=b[0])return a[1]+(v-a[0])*(b[1]-a[1])/(b[0]-a[0]);}return null;}

function formatLiters(x){
  return x.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})+' L';
}

/* ---------- Consistent Date & Time format (user-configurable via Settings) ---------- */
const MONTHS_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DATE_FORMAT_KEY='fuelDipDateFormat';
const TIME_FORMAT_KEY='fuelDipTimeFormat';

function getDateFormat(){
  try{ return localStorage.getItem(DATE_FORMAT_KEY)||'dmy'; }catch(e){ return 'dmy'; }
}
function getTimeFormat(){
  try{ return localStorage.getItem(TIME_FORMAT_KEY)||'24'; }catch(e){ return '24'; }
}

function formatDateDMY(d){
  if(!(d instanceof Date) || isNaN(d.getTime())) d=new Date();
  const day=String(d.getDate()).padStart(2,'0');
  const month=MONTHS_SHORT[d.getMonth()];
  const year=d.getFullYear();
  const fmt=getDateFormat();
  if(fmt==='mdy') return month+'-'+day+'-'+year;
  if(fmt==='ymd') return year+'-'+month+'-'+day;
  return day+'-'+month+'-'+year;
}
function formatDateTimeDMY(d){
  if(!(d instanceof Date) || isNaN(d.getTime())) d=new Date();
  const datePart=formatDateDMY(d);
  return datePart+'  '+formatTimeHM(d,true);
}
function formatTimeHM(d,withSeconds){
  if(!(d instanceof Date) || isNaN(d.getTime())) d=new Date();
  const fmt=getTimeFormat();
  let h=d.getHours();
  const m=String(d.getMinutes()).padStart(2,'0');
  const s=String(d.getSeconds()).padStart(2,'0');
  if(fmt==='12'){
    const ampm=h>=12?'PM':'AM';
    h=h%12; if(h===0) h=12;
    return String(h).padStart(2,'0')+':'+m+(withSeconds?':'+s:'')+' '+ampm;
  }
  return String(h).padStart(2,'0')+':'+m+(withSeconds?':'+s:'');
}
function formatDayShort(d){
  if(!(d instanceof Date) || isNaN(d.getTime())) d=new Date();
  return d.toLocaleDateString(undefined,{weekday:'short'});
}

function onDateFormatChange(value){
  const valid=['dmy','mdy','ymd'];
  const v=valid.includes(value)?value:'dmy';
  try{ localStorage.setItem(DATE_FORMAT_KEY,v); }catch(e){}
  tickClock();
}
function onTimeFormatChange(value){
  const v=(value==='12')?'12':'24';
  try{ localStorage.setItem(TIME_FORMAT_KEY,v); }catch(e){}
  tickClock();
}
(function initDateTimeFormat(){
  const dSel=document.getElementById('dateFormatSelect');
  if(dSel) dSel.value=getDateFormat();
  const tSel=document.getElementById('timeFormatSelect');
  if(tSel) tSel.value=getTimeFormat();
})();
const SITE_NAME_KEY='fuelDipSiteName';
const SITE_ADDRESS_KEY='fuelDipSiteAddress';
function getSiteName(){
  try{ return localStorage.getItem(SITE_NAME_KEY)||''; }catch(e){ return ''; }
}
function getSiteAddress(){
  try{ return localStorage.getItem(SITE_ADDRESS_KEY)||''; }catch(e){ return ''; }
}
function getSiteHeaderText(){
  const name=getSiteName() || (document.getElementById('customerNameDisplay')?document.getElementById('customerNameDisplay').textContent.trim():'') || 'Fuel Dip Calculator';
  const addr=getSiteAddress();
  return {name:name, address:addr};
}

/* ---------- Live saved-entry counts (Reading / Stock / Unload) ---------- */
function renderEntryCounts(){
  let readingCount=0, stockCount=0, unloadCount=0;
  try{ readingCount=loadHistory().length; }catch(e){}
  try{ stockCount=(typeof loadStockHistory==='function')?loadStockHistory().length:0; }catch(e){}
  try{ unloadCount=(typeof loadUnloadHistory==='function')?loadUnloadHistory().length:0; }catch(e){}

  ['countReading','countReadingAbout'].forEach(function(id){
    const el=document.getElementById(id); if(el) el.textContent=readingCount;
  });
  ['countStock','countStockAbout'].forEach(function(id){
    const el=document.getElementById(id); if(el) el.textContent=stockCount;
  });
  ['countUnload','countUnloadAbout'].forEach(function(id){
    const el=document.getElementById(id); if(el) el.textContent=unloadCount;
  });
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
  const dayStr=formatDayShort(now);
  const dateStr=formatDateDMY(now);
  const timeStr=formatTimeHM(now,true);
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
    day:formatDayShort(now),
    time:formatDateDMY(now)+' '+formatTimeHM(now),
    ts:now.getTime()
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

/* ---------- Edit a saved reading entry ---------- */
let editingReadingIndex=-1;

function openEditReading(index){
  const list=loadHistory();
  const e=list[index];
  if(!e) return;
  editingReadingIndex=index;
  document.getElementById('editReadingTank').textContent=e.tank;
  document.getElementById('editReadingDip').value=e.dip;
  document.getElementById('editReadingNote').value=e.note||'';
  const msg=document.getElementById('editReadingMsg');
  if(msg) msg.textContent='';
  document.getElementById('editReadingModal').style.display='flex';
}
function closeEditReading(){
  document.getElementById('editReadingModal').style.display='none';
  editingReadingIndex=-1;
}
function closeEditReadingOnBg(evt){
  if(evt.target && evt.target.id==='editReadingModal') closeEditReading();
}
function saveEditReading(){
  if(editingReadingIndex<0) return;
  const list=loadHistory();
  const e=list[editingReadingIndex];
  if(!e) return;

  const newDipRaw=document.getElementById('editReadingDip').value;
  const newDip=parseFloat(newDipRaw);
  const newNote=document.getElementById('editReadingNote').value.trim();
  const msg=document.getElementById('editReadingMsg');

  if(newDipRaw===''||isNaN(newDip)){
    if(msg) msg.textContent='Sahi dip value darj karein.';
    return;
  }

  const tankData = (e.tank||'').indexOf('50')!==-1 ? tank50 : tank25;
  const newVolNum = interp(tankData,newDip);
  if(newVolNum==null){
    if(msg) msg.textContent='Ye dip value tank ki range se bahar hai.';
    return;
  }
  const newVolume = formatLiters(newVolNum);

  const changes=[];
  if(newDip!==e.dip) changes.push('Dip '+e.dip+'mm → '+newDip+'mm');
  if(newNote!==(e.note||'')) changes.push('Note updated');

  e.dip=newDip;
  e.volume=newVolume;
  e.note=newNote;

  if(changes.length){
    e.editedAt=formatDateDMY(new Date())+' '+formatTimeHM(new Date());
    e.editSummary=changes.join('; ');
  }

  persistHistory(list);
  renderHistory();
  closeEditReading();
}

function escapeHtml(str){
  return String(str==null?'':str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function renderHistory(){
  renderEntryCounts();
  const container=document.getElementById('historyList');
  if(!container) return;
  const list=loadHistory();

  if(list.length===0){
    container.innerHTML='<div class="history-empty">No readings saved yet.</div>';
    return;
  }

  container.innerHTML=list.map((e,i)=>
    '<div class="history-row history-row-clickable'+(e.note?' has-note':'')+'" onclick="viewReadingAsImage('+i+')" title="Tap to view as image">'+
      '<span class="history-tank">'+escapeHtml(e.tank)+'</span>'+
      '<span class="history-dip">'+e.dip+' mm</span>'+
      '<span class="history-vol">'+escapeHtml(e.volume)+'</span>'+
      '<span class="history-time">'+(e.day?e.day+', ':'')+escapeHtml(e.time)+'</span>'+
      '<button type="button" class="history-edit" onclick="event.stopPropagation();openEditReading('+i+')" aria-label="Edit this reading">✏️</button>'+
      '<button type="button" class="history-delete" onclick="event.stopPropagation();deleteReading('+i+')" aria-label="Delete this reading">✕</button>'+
      (e.note?'<span class="history-note">📝 '+escapeHtml(e.note)+'</span>':'')+
      (e.editedAt?'<span class="history-edited">✏️ Edited: '+escapeHtml(e.editSummary||'')+' — '+escapeHtml(e.editedAt)+'</span>':'')+
    '</div>'
  ).join('');
}

/* ---------- View reading history entry as image ---------- */
async function viewReadingAsImage(index){
  const list=loadHistory();
  if(index<0||index>=list.length) return;
  const e=list[index];
  const site=getSiteHeaderText();

  let card=document.getElementById('readingDetailCard');
  if(!card){
    card=document.createElement('div');
    card.id='readingDetailCard';
    card.className='unload-receipt reading-detail-card';
    document.body.appendChild(card);
  }

  card.innerHTML=
    '<div class="unload-receipt-head">'+(escapeHtml(site.name)||'Fuel Dip Reading')+'</div>'+
    (site.address?'<div class="reading-detail-addr">'+escapeHtml(site.address)+'</div>':'')+
    '<table class="unload-receipt-table">'+
      '<tr><td>Tank</td><td>'+escapeHtml(e.tank)+'</td></tr>'+
      '<tr><td>Dip</td><td>'+e.dip+' mm</td></tr>'+
      '<tr><td>Volume</td><td>'+escapeHtml(e.volume)+'</td></tr>'+
      '<tr><td>Date & Time</td><td>'+(e.day?e.day+', ':'')+escapeHtml(e.time)+'</td></tr>'+
      (e.note?'<tr><td>Note</td><td>'+escapeHtml(e.note)+'</td></tr>':'')+
    '</table>'+
    '<div class="unload-receipt-footer">Generated: '+formatDateTimeDMY(new Date())+'</div>';

  if(!window.html2canvas){
    alert('Image view needs an internet connection to load the first time. Please check your connection and try again.');
    return;
  }
  try{
    const canvas=await html2canvas(card,{scale:2,backgroundColor:'#ffffff'});
    canvas.toBlob(function(blob){
      if(!blob) return;
      const url=URL.createObjectURL(blob);
      const w=window.open('','_blank');
      if(w){
        w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reading Detail</title>'+
          '<style>body{margin:0;padding:16px;background:#111;display:flex;flex-direction:column;align-items:center;min-height:100vh;box-sizing:border-box;font-family:system-ui,sans-serif;}'+
          'img{max-width:100%;height:auto;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.4);}'+
          '.actions{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}'+
          'a,button{padding:10px 18px;border-radius:8px;border:none;font-size:15px;cursor:pointer;text-decoration:none;color:#fff;}'+
          '.dl{background:#2563eb;} .cl{background:#64748b;}</style></head><body>'+
          '<img src="'+url+'" alt="Reading detail">'+
          '<div class="actions"><a class="dl" download="dip-reading-'+formatDateDMY(new Date())+'.png" href="'+url+'">⬇️ Download Image</a>'+
          '<button class="cl" onclick="window.close()">Close</button></div></body></html>');
        w.document.close();
      }else{
        shareOrDownloadBlob(blob,'dip-reading-'+formatDateDMY(new Date())+'.png','image/png');
      }
    },'image/png');
  }catch(err){
    alert('Image banate waqt masla hua. Dobara koshish karein.');
  }
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
  const site=getSiteHeaderText();
  const headerRows=[];
  headerRows.push(['Site Name',site.name]);
  if(site.address) headerRows.push(['Address',site.address]);
  headerRows.push(['Report Date',formatDateDMY(new Date())]);
  headerRows.push([]);
  const rows=headerRows.concat([['Tank','Dip (mm)','Volume','Day','Date & Time','Note']]);
  list.forEach(e=>{
    rows.push([e.tank,e.dip,e.volume,e.day||'',e.time,e.note||'']);
  });

  const csvContent=rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csvContent],{type:'text/csv;charset=utf-8;'});
  const stamp=formatDateDMY(new Date()).replace(/-/g,'');
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
  const site=getSiteHeaderText();

  let y=18;
  doc.setFontSize(16);
  doc.setTextColor(37,99,235);
  doc.text(site.name || 'Fuel Dip Calculator',14,y);
  y+=7;
  if(site.address){
    doc.setFontSize(10);
    doc.setTextColor(80,80,80);
    doc.text(site.address,14,y);
    y+=6;
  }
  doc.setFontSize(11);
  doc.setTextColor(100,100,100);
  doc.text('Fuel Dip Reading Report',14,y);
  y+=6;
  doc.setFontSize(9);
  doc.text('Generated: '+formatDateTimeDMY(new Date()),14,y);
  y+=8;

  const rows=list.map(e=>[e.tank,e.dip+' mm',e.volume,e.day||'',e.time,e.note||'']);

  doc.autoTable({
    startY:y,
    head:[['Tank','Dip','Volume','Day','Date & Time','Note']],
    body:rows,
    headStyles:{fillColor:[37,99,235]},
    styles:{fontSize:9}
  });

  const stamp=formatDateDMY(new Date()).replace(/-/g,'');
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
  const site=getSiteHeaderText();
  const rows=[];
  rows.push(['Site Name',site.name]);
  if(site.address) rows.push(['Address',site.address]);
  rows.push(['Report Date',formatDateDMY(new Date())]);
  rows.push([]);
  rows.push(['Tank','Dip (mm)','Volume','Day','Date & Time','Note']);
  list.forEach(e=>rows.push([e.tank,e.dip,e.volume,e.day||'',e.time,e.note||'']));

  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:14},{wch:12},{wch:14},{wch:8},{wch:22},{wch:28}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Dip History');

  const stamp=formatDateDMY(new Date()).replace(/-/g,'');
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
  const site=getSiteHeaderText();
  const recent=list.slice(0,20);
  let msg='*'+site.name+' — Fuel Dip Readings*\n';
  if(site.address) msg+=site.address+'\n';
  msg+='Report: '+formatDateDMY(new Date())+'\n\n';
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
    'settings.pinLock':'🔒 PIN Lock', 'settings.pinLockSub':'Require a PIN to open this app',
    'settings.about':'ℹ️ About Application', 'settings.viewMode':'📐 View Settings',
    'settings.mobileView':'Mobile View', 'settings.desktopView':'Desktop View',
    'settings.dateFormat':'🗓️ Date Format', 'settings.dateFormatSub':'Choose the order dates are shown in',
    'settings.timeFormat':'🕐 Time Format', 'settings.timeFormatSub':'12-Hour or 24-Hour clock',
    'settings.siteName':'Site Name & Address', 'settings.siteNameSub':'Name & address shown on the header',
    'settings.siteNameField':'Site Name', 'settings.addressField':'Address',
    'settings.newPin':'New PIN', 'settings.confirmPin':'Confirm PIN', 'settings.savePin':'Save PIN',
    'settings.backupRestore':'Backup & Restore', 'settings.lastBackup':'Last backup: Never',
    'settings.downloadBackup':'⬇ Download backup', 'settings.restoreBackup':'⬆ Restore from backup',
    'common.save':'Save',
    'home.tanksOverview':'🛢 Storage Tanks — Overview', 'home.tagline':'Fuel Dip Calculator',
    'home.footNote':'Results are based on the uploaded calibration chart. Always verify before final fuel dispatch.',
    'reports.title':'📊 Reading History', 'reports.noReadings':'No readings saved yet. Tap any saved entry to view as image.',
    'chart.title':'📋 Dip Calibration Chart', 'chart.note':'Full reference table',
    'chart.searchMm':'📏 Search Dip (mm)', 'chart.searchL':'⛽ Search Litres (L)',
    'unload.title':'🚛 Fuel Tanker Unloading Status', 'unload.note':'Vehicle unloading tank check',
    'unload.date':'📅 Date', 'unload.vendor':'Vendor Name', 'unload.vehicle':'Vehicle No',
    'unload.driver':'Driver Name', 'unload.contact':'Contact No', 'unload.tank':'Unloading Tank',
    'unload.dipReadings':'Dip Readings', 'unload.curDipLtrs':'Current Dip & Ltrs', 'unload.prvDipLtrs':'Prv Dip & Ltrs',
    'unload.balanceLiters':'Balance Liters', 'unload.saleLiters':'Sale Liters',
    'unload.totalLiters':'TOTAL LITERS', 'unload.totalStock':'TOTAL STOCK', 'unload.invStock':'Inv Stock', 'unload.stEx':'ST / EX Liter',
    'unload.save':'💾 Save', 'unload.print':'🖨️ Print', 'unload.shareImage':'📤 Share Image',
    'unload.historyTitle':'📜 Unloading History', 'unload.clearAll':'Clear',
    'unload.noRecords':'No unloading records saved yet. Tap any saved entry to view as image.',
    'edit.readingTitle':'✏️ Edit Reading', 'edit.unloadTitle':'✏️ Edit Unloading Record',
    'edit.dip':'📏 Dip (mm)', 'edit.saveChanges':'Save Changes',
    'lock.title':'Enter PIN', 'lock.sub':'This app is protected. Enter PIN to continue.', 'lock.unlock':'Unlock',
    'about.title':'ℹ️ About Application'
  },
  ru:{
    'nav.home':'Home', 'nav.tanks':'Tanks', 'nav.reports':'Reports', 'nav.chart':'Dip Chart', 'nav.settings':'Settings',
    'tank.dipReading':'📏 Dip Reading', 'tank.availableFuel':'⛽ Available Fuel', 'tank.note':'📝 Note (optional)',
    'tank.save':'💾 Reading Save Karein', 'tank.copy':'📋 Result Copy Karein', 'tank.clear':'✕ Clear Karein',
    'tank.reverseLookup':'🔄 Reverse Lookup — Litres → Dip', 'tank.enterLitres':'⛽ Litres Darj Karein', 'tank.estimatedDip':'📏 Takhmeeni Dip',
    'settings.title':'⚙️ App Settings', 'settings.colorScheme':'🎨 Color Theme', 'settings.language':'🌐 Zabaan',
    'settings.pinLock':'🔒 PIN Lock', 'settings.pinLockSub':'App kholne ke liye PIN zaroori karein',
    'settings.about':'ℹ️ App Ke Baare Mein', 'settings.viewMode':'📐 View Settings',
    'settings.mobileView':'Mobile View', 'settings.desktopView':'Desktop View',
    'settings.dateFormat':'🗓️ Date Format', 'settings.dateFormatSub':'Kis tarteeb mein date dikhani hai',
    'settings.timeFormat':'🕐 Time Format', 'settings.timeFormatSub':'12-Hour ya 24-Hour clock',
    'settings.siteName':'Site Ka Naam & Address', 'settings.siteNameSub':'Header par dikhne wala site ka naam aur address',
    'settings.siteNameField':'Site Ka Naam', 'settings.addressField':'Address',
    'settings.newPin':'Naya PIN', 'settings.confirmPin':'PIN Dobara Darj Karein', 'settings.savePin':'PIN Save Karein',
    'settings.backupRestore':'Backup & Restore', 'settings.lastBackup':'Aakhri backup: Kabhi Nahi',
    'settings.downloadBackup':'⬇ Backup Download Karein', 'settings.restoreBackup':'⬆ Backup Se Restore Karein',
    'common.save':'Save Karein',
    'home.tanksOverview':'🛢 Storage Tanks — Ijmali Jaeza', 'home.tagline':'Fuel Dip Calculator',
    'home.footNote':'Results uploaded calibration chart ke mutabiq hain. Fuel dispatch se pehle hamesha tasdeeq karein.',
    'reports.title':'📊 Reading History', 'reports.noReadings':'Abhi tak koi reading save nahi hui. Image dekhne ke liye entry par tap karein.',
    'chart.title':'📋 Dip Calibration Chart', 'chart.note':'Poori reference table',
    'chart.searchMm':'📏 Dip Talash Karein (mm)', 'chart.searchL':'⛽ Litres Talash Karein (L)',
    'unload.title':'🚛 Fuel Tanker Unloading Status', 'unload.note':'Vehicle unloading tank check',
    'unload.date':'📅 Tareekh', 'unload.vendor':'Vendor Ka Naam', 'unload.vehicle':'Vehicle No',
    'unload.driver':'Driver Ka Naam', 'unload.contact':'Contact No', 'unload.tank':'Unloading Tank',
    'unload.dipReadings':'Dip Readings', 'unload.curDipLtrs':'Current Dip & Ltrs', 'unload.prvDipLtrs':'Prv Dip & Ltrs',
    'unload.balanceLiters':'Balance Liters', 'unload.saleLiters':'Sale Liters',
    'unload.totalLiters':'TOTAL LITERS', 'unload.totalStock':'TOTAL STOCK', 'unload.invStock':'Inv Stock', 'unload.stEx':'ST / EX Liter',
    'unload.save':'💾 Save Karein', 'unload.print':'🖨️ Print Karein', 'unload.shareImage':'📤 Image Share Karein',
    'unload.historyTitle':'📜 Unloading History', 'unload.clearAll':'Clear Karein',
    'unload.noRecords':'Abhi tak koi unloading record save nahi hua. Image dekhne ke liye entry par tap karein.',
    'edit.readingTitle':'✏️ Reading Edit Karein', 'edit.unloadTitle':'✏️ Unloading Record Edit Karein',
    'edit.dip':'📏 Dip (mm)', 'edit.saveChanges':'Tabdeeliyan Save Karein',
    'lock.title':'PIN Darj Karein', 'lock.sub':'Ye app protected hai. Jari rakhne ke liye PIN darj karein.', 'lock.unlock':'Unlock Karein',
    'about.title':'ℹ️ App Ke Baare Mein'
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
  renderEntryCounts();
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
  renderEntryCounts();
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
    return formatDateDMY(d)+' '+formatTimeHM(d);
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

  // Reports panel top header
  const rName=document.getElementById('reportsSiteName');
  const rAddr=document.getElementById('reportsSiteAddress');
  if(rName){
    rName.textContent = name || (nameEl ? nameEl.textContent.trim() : '') || 'Fuel Dip Calculator';
  }
  if(rAddr){
    if(address){
      rAddr.textContent=address;
      rAddr.style.display='block';
    }else{
      rAddr.textContent='';
      rAddr.style.display='none';
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
  const dayStr = formatDayShort(now);
  const dateTimeStr = formatDateDMY(now)+' '+formatTimeHM(now);

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
  if(navId==='navReports') applySiteDetails();
}

/* ================= Stock Management ================= */
const STOCK_HISTORY_KEY='fuelStockHistory';
const STOCK_HISTORY_LIMIT=500;

function fmtStockNum(x){
  if(x==null||isNaN(x)) return '0.00';
  return x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function calcStock(){
  const opening=parseFloat(document.getElementById('sk_opening').value)||0;
  const arrival=parseFloat(document.getElementById('sk_arrival').value)||0;
  const sale=parseFloat(document.getElementById('sk_sale').value)||0;
  const dipInput=parseFloat(document.getElementById('sk_dipStock').value);

  const total=opening+arrival;
  const balance=total-sale;
  const dipStock=isNaN(dipInput)?null:dipInput;
  const stEx=dipStock!=null?(dipStock-balance):null;

  document.getElementById('sk_total').innerText=fmtStockNum(total);
  document.getElementById('sk_balance').innerText=fmtStockNum(balance);
  const stExEl=document.getElementById('sk_stEx');
  stExEl.innerText=stEx!=null?(stEx>=0?'+':'')+fmtStockNum(stEx):'0.00';
  stExEl.classList.toggle('is-excess', stEx!=null && stEx>0);
  stExEl.classList.toggle('is-short', stEx!=null && stEx<0);
}

function gatherStockData(){
  return {
    date: document.getElementById('sk_date').value || new Date().toISOString().slice(0,10),
    product: document.getElementById('sk_product').value.trim(),
    desc: document.getElementById('sk_desc').value.trim(),
    opening: document.getElementById('sk_opening').value || '0',
    arrival: document.getElementById('sk_arrival').value || '0',
    total: document.getElementById('sk_total').innerText,
    sale: document.getElementById('sk_sale').value || '0',
    balance: document.getElementById('sk_balance').innerText,
    dipStock: document.getElementById('sk_dipStock').value || '',
    stEx: document.getElementById('sk_stEx').innerText,
    savedAt: formatDateDMY(new Date())+' '+formatTimeHM(new Date())
  };
}

function clearStockForm(){
  document.getElementById('sk_date').value=new Date().toISOString().slice(0,10);
  document.getElementById('sk_desc').value='';
  document.getElementById('sk_opening').value='';
  document.getElementById('sk_arrival').value='';
  document.getElementById('sk_sale').value='';
  document.getElementById('sk_dipStock').value='';
  document.getElementById('sk_dipMM').value='';
  calcStock();
  autoFillOpeningFromLastBalance();
}

function loadStockHistory(){
  try{ return JSON.parse(localStorage.getItem(STOCK_HISTORY_KEY))||[]; }catch(e){ return []; }
}
function persistStockHistory(list){
  try{ localStorage.setItem(STOCK_HISTORY_KEY,JSON.stringify(list)); }catch(e){}
}

function saveStockEntry(){
  calcStock();
  const d=gatherStockData();
  if(!d.product){
    alert('Product ka naam zaroor darj karein.');
    return;
  }
  const list=loadStockHistory();
  list.unshift(d);
  if(list.length>STOCK_HISTORY_LIMIT) list.length=STOCK_HISTORY_LIMIT;
  persistStockHistory(list);
  renderStockHistory();
  alert('Stock entry save ho gayi.');
}

function clearStockHistory(){
  const list=loadStockHistory();
  if(list.length===0) return;
  if(!confirm('Clear all '+list.length+' stock entries?\n\nThis cannot be undone.')) return;
  persistStockHistory([]);
  renderStockHistory();
}

function deleteStockEntry(index){
  const list=loadStockHistory();
  if(index<0||index>=list.length) return;
  const e=list[index];
  if(!confirm('Delete this stock entry?\n\n'+(e.product||'')+' — '+e.date)) return;
  list.splice(index,1);
  persistStockHistory(list);
  renderStockHistory();
}

function renderStockHistory(){
  renderEntryCounts();
  const container=document.getElementById('stockHistoryList');
  if(!container) return;
  const list=loadStockHistory();

  if(list.length===0){
    container.innerHTML='<div class="history-empty">No stock entries saved yet.</div>';
    return;
  }

  container.innerHTML=list.map((e,i)=>{
    const isShort=(e.stEx||'').trim().startsWith('-');
    return '<div class="history-row" onclick="showStockImage('+i+')" role="button" tabindex="0" aria-label="View this stock entry as image">'+
      '<span class="history-tank">'+escapeHtml(e.product||'—')+'</span>'+
      '<span class="history-dip">Bal: '+escapeHtml(e.balance||'0.00')+'</span>'+
      '<span class="history-vol'+(isShort?' is-short-text':' is-excess-text')+'">'+escapeHtml(e.stEx||'0.00')+'</span>'+
      '<span class="history-time">'+escapeHtml(e.date||'')+'</span>'+
      '<button type="button" class="history-edit" onclick="event.stopPropagation();openEditStock('+i+')" aria-label="Edit this entry">✏️</button>'+
      '<button type="button" class="history-delete" onclick="event.stopPropagation();deleteStockEntry('+i+')" aria-label="Delete this entry">✕</button>'+
      (e.editedAt?'<span class="history-edited">✏️ Edited: '+escapeHtml(e.editSummary||'')+' — '+escapeHtml(e.editedAt)+'</span>':'')+
    '</div>';
  }).join('');
  renderEntryCounts();
}

/* ---------- Edit a saved stock entry ---------- */
let editingStockIndex=-1;

function openEditStock(index){
  const list=loadStockHistory();
  const e=list[index];
  if(!e) return;
  editingStockIndex=index;
  document.getElementById('es_date').value=e.date||'';
  const prodSel=document.getElementById('es_product');
  if(e.product && ![...prodSel.options].some(function(o){return o.value===e.product;})){
    const opt=document.createElement('option');
    opt.value=e.product; opt.textContent=e.product+' (removed)';
    prodSel.appendChild(opt);
  }
  prodSel.value=e.product||'';
  document.getElementById('es_desc').value=e.desc||'';
  document.getElementById('es_opening').value=(e.opening||'0').toString().replace(/,/g,'');
  document.getElementById('es_arrival').value=(e.arrival||'0').toString().replace(/,/g,'');
  document.getElementById('es_sale').value=(e.sale||'0').toString().replace(/,/g,'');
  document.getElementById('es_dipStock').value=(e.dipStock||'').toString().replace(/,/g,'');
  document.getElementById('es_dipMM').value='';
  const msg=document.getElementById('editStockMsg');
  if(msg) msg.textContent='';
  document.getElementById('editStockModal').style.display='flex';
}
function closeEditStock(){
  document.getElementById('editStockModal').style.display='none';
  editingStockIndex=-1;
}
function closeEditStockOnBg(evt){
  if(evt.target && evt.target.id==='editStockModal') closeEditStock();
}
function saveEditStock(){
  if(editingStockIndex<0) return;
  const list=loadStockHistory();
  const old=list[editingStockIndex];
  if(!old) return;

  const rawDate=document.getElementById('es_date').value;
  const product=document.getElementById('es_product').value.trim();
  const desc=document.getElementById('es_desc').value.trim();
  const opening=parseFloat(document.getElementById('es_opening').value)||0;
  const arrival=parseFloat(document.getElementById('es_arrival').value)||0;
  const sale=parseFloat(document.getElementById('es_sale').value)||0;
  const dipInput=parseFloat(document.getElementById('es_dipStock').value);
  const msg=document.getElementById('editStockMsg');

  if(!product){
    if(msg) msg.textContent='Product ka naam zaroor darj karein.';
    return;
  }

  const total=opening+arrival;
  const balance=total-sale;
  const dipStock=isNaN(dipInput)?null:dipInput;
  const stEx=dipStock!=null?(dipStock-balance):null;

  const updated={
    date: rawDate||old.date,
    product: product,
    desc: desc,
    opening: document.getElementById('es_opening').value||'0',
    arrival: document.getElementById('es_arrival').value||'0',
    total: fmtStockNum(total),
    sale: document.getElementById('es_sale').value||'0',
    balance: fmtStockNum(balance),
    dipStock: document.getElementById('es_dipStock').value||'',
    stEx: stEx!=null?(stEx>=0?'+':'')+fmtStockNum(stEx):'0.00',
    savedAt: old.savedAt
  };

  const changedFields=[];
  const labels={date:'Date',product:'Product',desc:'Description',opening:'Opening',arrival:'Arrival',sale:'Sale',dipStock:'Dip Stock'};
  Object.keys(labels).forEach(function(k){
    if(String(old[k]||'')!==String(updated[k]||'')) changedFields.push(labels[k]);
  });

  if(changedFields.length){
    updated.editedAt=formatDateDMY(new Date())+' '+formatTimeHM(new Date());
    updated.editSummary='Updated: '+changedFields.join(', ');
  }else{
    updated.editedAt=old.editedAt;
    updated.editSummary=old.editSummary;
  }

  list[editingStockIndex]=updated;
  persistStockHistory(list);
  renderStockHistory();
  closeEditStock();
}

/* ---------- Stock exports (CSV / PDF / Excel / WhatsApp) ---------- */
function exportStockCSV(){
  const list=loadStockHistory();
  if(list.length===0){ alert('No stock entries saved yet — nothing to export.'); return; }

  const rows=[['Date','Product','Description','Opening','Arrival','Total','Sale','Balance','Dip Stock','Short/Excess']];
  list.forEach(e=>rows.push([e.date,e.product,e.desc||'',e.opening,e.arrival,e.total,e.sale,e.balance,e.dipStock,e.stEx]));

  const csvContent=rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csvContent],{type:'text/csv;charset=utf-8;'});
  const stamp=new Date().toISOString().slice(0,10);
  shareOrDownloadBlob(blob,'stock-register-'+stamp+'.csv','text/csv');
}

function exportStockPDF(){
  const list=loadStockHistory();
  if(list.length===0){ alert('No stock entries saved yet — nothing to export.'); return; }
  if(!window.jspdf || !window.jspdf.jsPDF){
    alert('PDF export needs an internet connection to load the first time. Please check your connection and try again.');
    return;
  }

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(37,99,235);
  doc.text(getSiteName(),14,18);
  doc.setFontSize(11);
  doc.setTextColor(100,100,100);
  doc.text('Stock Management Register',14,25);
  doc.setFontSize(9);
  doc.text('Generated: '+formatDateTimeDMY(new Date()),14,31);

  const rows=list.map(e=>[e.date,e.product,e.desc||'',e.opening,e.arrival,e.total,e.sale,e.balance,e.dipStock,e.stEx]);

  doc.autoTable({
    startY:36,
    head:[['Date','Product','Description','Opening','Arrival','Total','Sale','Balance','Dip Stock','Sh/Ex']],
    body:rows,
    headStyles:{fillColor:[37,99,235]},
    styles:{fontSize:8}
  });

  const stamp=new Date().toISOString().slice(0,10);
  const blob=doc.output('blob');
  shareOrDownloadBlob(blob,'stock-register-'+stamp+'.pdf','application/pdf');
}

function exportStockExcel(){
  const list=loadStockHistory();
  if(list.length===0){ alert('No stock entries saved yet — nothing to export.'); return; }
  if(!window.XLSX){
    alert('Excel export needs an internet connection to load the first time. Please check your connection and try again.');
    return;
  }

  const rows=[['Date','Product','Description','Opening','Arrival','Total','Sale','Balance','Dip Stock','Short/Excess']];
  list.forEach(e=>rows.push([e.date,e.product,e.desc||'',e.opening,e.arrival,e.total,e.sale,e.balance,e.dipStock,e.stEx]));

  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:12},{wch:16},{wch:16},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Stock Register');

  const stamp=new Date().toISOString().slice(0,10);
  const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  const blob=new Blob([wbout],{type:'application/octet-stream'});
  shareOrDownloadBlob(blob,'stock-register-'+stamp+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function shareStockWhatsApp(){
  const list=loadStockHistory();
  if(list.length===0){ alert('No stock entries saved yet — nothing to share.'); return; }

  const recent=list.slice(0,20);
  let msg='*'+getSiteName()+' — Stock Register*\n\n';
  recent.forEach(e=>{
    msg+='• '+e.product+' ('+e.date+') — Bal: '+e.balance+' | Dip: '+(e.dipStock||'-')+' | Sh/Ex: '+e.stEx+'\n';
  });
  msg+='\nSent from Fuel Dip Calculator app.';

  const url='https://api.whatsapp.com/send?text='+encodeURIComponent(msg);
  window.open(url,'_blank','noopener');
}

/* ---------- Print stock entry ---------- */
function printStock(){
  calcStock();
  const d=gatherStockData();
  const w=window.open('','_blank');
  if(!w){ alert('Popup blocked. Please allow popups to print.'); return; }

  const html='<!doctype html><html><head><meta charset="utf-8"><title>Stock Entry</title>'+
    '<style>'+
    'body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#1a1a1a;}'+
    'h2{background:#37474f;color:#fff;padding:12px 14px;margin:0 0 16px;border-radius:6px;font-size:18px;}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:16px;}'+
    'td,th{border:1px solid #999;padding:8px 10px;font-size:14px;}'+
    'td:first-child{font-weight:700;background:#f3f3f3;width:42%;}'+
    '.total-row td{font-weight:800;background:#fff8e1;}'+
    'p.foot{font-size:11px;color:#777;margin-top:20px;}'+
    '</style></head><body>'+
    '<h2>Stock Management Entry</h2>'+
    '<table>'+
      '<tr><td>Date</td><td>'+escapeHtml(isoToDMY(d.date))+'</td></tr>'+
      '<tr><td>Product</td><td>'+escapeHtml(d.product||'-')+'</td></tr>'+
      '<tr><td>Description</td><td>'+escapeHtml(d.desc||'-')+'</td></tr>'+
    '</table>'+
    '<table>'+
      '<tr><td>Opening</td><td>'+d.opening+'</td></tr>'+
      '<tr><td>Arrival</td><td>'+d.arrival+'</td></tr>'+
      '<tr class="total-row"><td>TOTAL</td><td>'+d.total+'</td></tr>'+
      '<tr><td>Sale</td><td>'+d.sale+'</td></tr>'+
      '<tr class="total-row"><td>BALANCE</td><td>'+d.balance+'</td></tr>'+
      '<tr><td>Dip Stock (Ltrs)</td><td>'+(d.dipStock||'-')+'</td></tr>'+
      '<tr class="total-row"><td>SHORT / EXCESS</td><td>'+d.stEx+'</td></tr>'+
    '</table>'+
    '<p class="foot">Generated: '+formatDateTimeDMY(new Date())+'</p>'+
    '</body></html>';

  w.document.write(html);
  w.document.close();
  w.onload=function(){ w.focus(); w.print(); };
}

function isoToDMY(iso){
  if(!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso||'-';
  const p=iso.split('-');
  const dd=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  return isNaN(dd.getTime()) ? iso : formatDateDMY(dd);
}

/* ---------- Share stock entry as image (thermal-invoice style, drawn on canvas) ---------- */
function buildStockReceiptCanvas(dataOverride){
  const d=dataOverride||gatherStockData();
  const isShort=(d.stEx||'').trim().startsWith('-');

  const W=576;
  const PAD=26;
  const rowH=32;

  const headRows=[
    ['Date', isoToDMY(d.date)],
    ['Product', d.product||'-'],
    ['Description', d.desc||'-']
  ];
  const figRows=[
    ['Opening', d.opening],
    ['Arrival', d.arrival],
    ['TOTAL', d.total],
    ['Sale', d.sale],
    ['BALANCE', d.balance],
    ['Dip Stock (Ltrs)', d.dipStock||'-'],
    ['SHORT / EXCESS', d.stEx]
  ];

  let H=PAD;
  H+=34;
  H+=16; H+=54;
  H+=16;
  H+=headRows.length*rowH;
  H+=16;
  H+=figRows.length*rowH;
  H+=16;
  H+=48+PAD;

  const scale=2;
  const canvas=document.createElement('canvas');
  canvas.width=W*scale;
  canvas.height=H*scale;
  const ctx=canvas.getContext('2d');
  ctx.scale(scale,scale);

  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#1a1a1a';
  ctx.textBaseline='alphabetic';

  let y=PAD;
  ctx.textAlign='center';
  ctx.font='800 21px Arial, Helvetica, sans-serif';
  ctx.fillText(getSiteName(), W/2, y);
  y+=20;
  drawDashedLine(ctx,PAD,W-PAD,y);
  y+=30;
  ctx.font='800 17px Arial, Helvetica, sans-serif';
  ctx.fillText('STOCK MANAGEMENT ENTRY', W/2, y);
  y+=24;
  drawDashedLine(ctx,PAD,W-PAD,y);
  y+=26;

  ctx.textAlign='left';
  ctx.font='600 14.5px Arial, Helvetica, sans-serif';
  headRows.forEach(function(r){
    ctx.fillStyle='#5f6368';
    ctx.fillText(r[0], PAD, y);
    ctx.fillStyle='#1a1a1a';
    ctx.textAlign='right';
    ctx.fillText(String(r[1]), W-PAD, y);
    ctx.textAlign='left';
    y+=rowH;
  });

  drawDashedLine(ctx,PAD,W-PAD,y-10);
  y+=18;

  figRows.forEach(function(r,i){
    const isFinal=i===figRows.length-1;
    const isTotalLike = r[0]==='TOTAL' || r[0]==='BALANCE';
    ctx.font=(isFinal||isTotalLike?'800 15.5px Arial, Helvetica, sans-serif':'500 14.5px Arial, Helvetica, sans-serif');
    ctx.fillStyle = isFinal ? (isShort?'#dc2626':'#16a34a') : '#1a1a1a';
    ctx.fillText(r[0], PAD, y);
    ctx.textAlign='right';
    ctx.fillText(String(r[1]), W-PAD, y);
    ctx.textAlign='left';
    ctx.fillStyle='#1a1a1a';
    y+=rowH;
  });

  y+=6;
  drawDashedLine(ctx,PAD,W-PAD,y);
  y+=26;

  ctx.textAlign='center';
  ctx.font='400 12px Arial, Helvetica, sans-serif';
  ctx.fillStyle='#777';
  ctx.fillText('Generated: '+(d.savedAt||formatDateTimeDMY(new Date())), W/2, y);
  y+=18;
  ctx.fillText(d.editedAt?('Edited: '+(d.editSummary||'')+' — '+d.editedAt):(getSiteName()+' Fuel Dip Calculator'), W/2, y);

  return canvas;
}

function shareStockImage(){
  calcStock();
  try{
    const canvas=buildStockReceiptCanvas();
    canvas.toBlob(function(blob){
      if(!blob){ alert('Image nahi ban saki. Dobara koshish karein.'); return; }
      const stamp=formatDateDMY(new Date()).replace(/-/g,'');
      shareOrDownloadBlob(blob,'stock-entry-'+stamp+'.png','image/png');
    },'image/png');
  }catch(e){
    alert('Image banate waqt masla hua. Dobara koshish karein.');
  }
}

/* ---------- View a saved stock entry as an image (click on history row) ---------- */
function showStockImage(index){
  const list=loadStockHistory();
  const e=list[index];
  if(!e) return;
  try{
    const canvas=buildStockReceiptCanvas(e);
    const stamp=(e.date||formatDateDMY(new Date())).toString().replace(/[^0-9A-Za-z]/g,'');
    openImagePreview(canvas,'stock-entry-'+stamp+'.png');
  }catch(err){
    alert('Image banate waqt masla hua. Dobara koshish karein.');
  }
}

/* ---------- Build a receipt-style image for a saved reading (Tank dip) entry ---------- */
function buildReadingReceiptCanvas(e){
  const W=576;
  const PAD=26;
  const rowH=32;

  const rows=[
    ['Tank', e.tank||'-'],
    ['Dip', e.dip+' mm'],
    ['Available Fuel', e.volume||'-'],
    ['Day', e.day||'-'],
    ['Date & Time', e.time||'-']
  ];
  if(e.note) rows.push(['Note', e.note]);

  let H=PAD;
  H+=34;
  H+=16; H+=54;
  H+=16;
  H+=rows.length*rowH;
  H+=16;
  H+=48+PAD;
  if(e.editedAt) H+=18;

  const scale=2;
  const canvas=document.createElement('canvas');
  canvas.width=W*scale;
  canvas.height=H*scale;
  const ctx=canvas.getContext('2d');
  ctx.scale(scale,scale);

  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#1a1a1a';
  ctx.textBaseline='alphabetic';

  let y=PAD;
  ctx.textAlign='center';
  ctx.font='800 21px Arial, Helvetica, sans-serif';
  ctx.fillText(getSiteName(), W/2, y);
  y+=20;
  drawDashedLine(ctx,PAD,W-PAD,y);
  y+=30;
  ctx.font='800 17px Arial, Helvetica, sans-serif';
  ctx.fillText('DIP READING ENTRY', W/2, y);
  y+=24;
  drawDashedLine(ctx,PAD,W-PAD,y);
  y+=26;

  ctx.textAlign='left';
  rows.forEach(function(r,i){
    const isVol = r[0]==='Available Fuel';
    ctx.font=(isVol?'800 15.5px Arial, Helvetica, sans-serif':'600 14.5px Arial, Helvetica, sans-serif');
    ctx.fillStyle = isVol ? '#16a34a' : '#5f6368';
    ctx.fillText(r[0], PAD, y);
    ctx.fillStyle = isVol ? '#16a34a' : '#1a1a1a';
    ctx.textAlign='right';
    const maxW=W-PAD*2-140;
    let val=String(r[1]);
    while(ctx.measureText(val).width>maxW && val.length>3){ val=val.slice(0,-1); }
    if(val!==String(r[1])) val=val.replace(/\s*$/,'')+'…';
    ctx.fillText(val, W-PAD, y);
    ctx.textAlign='left';
    y+=rowH;
  });

  y+=6;
  drawDashedLine(ctx,PAD,W-PAD,y);
  y+=26;

  ctx.textAlign='center';
  ctx.font='400 12px Arial, Helvetica, sans-serif';
  ctx.fillStyle='#777';
  ctx.fillText('Saved: '+(e.day?e.day+', ':'')+(e.time||''), W/2, y);
  y+=18;
  ctx.fillText(getSiteName()+' Fuel Dip Calculator', W/2, y);
  if(e.editedAt){
    y+=18;
    ctx.fillText('✏️ Edited: '+(e.editSummary||'')+' — '+e.editedAt, W/2, y);
  }

  return canvas;
}

/* ---------- View a saved reading entry as an image (click on history row) ---------- */
function showReadingImage(index){
  const list=loadHistory();
  const e=list[index];
  if(!e) return;
  try{
    const canvas=buildReadingReceiptCanvas(e);
    const stamp=(e.time||formatDateDMY(new Date())).toString().replace(/[^0-9A-Za-z]/g,'');
    openImagePreview(canvas,'reading-'+stamp+'.png');
  }catch(err){
    alert('Image banate waqt masla hua. Dobara koshish karein.');
  }
}

/* ---------- Generic image preview modal ---------- */
let previewImageBlob=null;
let previewImageFilename='entry.png';

function openImagePreview(canvas,filename){
  previewImageFilename=filename||'entry.png';
  canvas.toBlob(function(blob){
    if(!blob){ alert('Image nahi ban saki. Dobara koshish karein.'); return; }
    previewImageBlob=blob;
    const url=URL.createObjectURL(blob);
    const img=document.getElementById('imagePreviewImg');
    if(img){
      if(img.dataset.prevUrl) URL.revokeObjectURL(img.dataset.prevUrl);
      img.src=url;
      img.dataset.prevUrl=url;
    }
    const modal=document.getElementById('imagePreviewModal');
    if(modal) modal.style.display='flex';
  },'image/png');
}

function closeImagePreview(evt){
  if(evt && evt.target && evt.target.id!=='imagePreviewModal') return;
  const modal=document.getElementById('imagePreviewModal');
  if(modal) modal.style.display='none';
}

function downloadPreviewImage(){
  if(!previewImageBlob) return;
  const url=URL.createObjectURL(previewImageBlob);
  const a=document.createElement('a');
  a.href=url;
  a.download=previewImageFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sharePreviewImage(){
  if(!previewImageBlob) return;
  shareOrDownloadBlob(previewImageBlob,previewImageFilename,'image/png');
}

/* ---------- Init ---------- */
(function initStock(){
  const dateInput=document.getElementById('sk_date');
  if(dateInput && !dateInput.value){
    dateInput.value=new Date().toISOString().slice(0,10);
  }
  calcStock();
  renderStockHistory();
})();

/* ================= Stock Product List (Add / Edit / Remove) ================= */
const PRODUCT_LIST_KEY='stockProductList';
const DEFAULT_PRODUCTS=['Diesel Ultra','Diesel Storage','Super Plus'];

function loadProductList(){
  try{
    const list=JSON.parse(localStorage.getItem(PRODUCT_LIST_KEY));
    if(Array.isArray(list) && list.length) return list;
  }catch(e){}
  return DEFAULT_PRODUCTS.slice();
}
function persistProductList(list){
  try{ localStorage.setItem(PRODUCT_LIST_KEY,JSON.stringify(list)); }catch(e){}
}

function populateProductSelects(selectedValue){
  const list=loadProductList();
  ['sk_product','es_product'].forEach(function(id){
    const sel=document.getElementById(id);
    if(!sel) return;
    const prev=selectedValue!==undefined?selectedValue:sel.value;
    sel.innerHTML=list.map(function(p){ return '<option value="'+escapeHtml(p)+'">'+escapeHtml(p)+'</option>'; }).join('');
    if(list.indexOf(prev)!==-1) sel.value=prev;
  });
}

function openManageProducts(){
  renderProductManageList();
  const msg=document.getElementById('manageProductsMsg');
  if(msg) msg.textContent='';
  document.getElementById('newProductInput').value='';
  document.getElementById('manageProductsModal').style.display='flex';
}
function closeManageProducts(){
  document.getElementById('manageProductsModal').style.display='none';
  populateProductSelects();
  calcStock();
}
function closeManageProductsOnBg(evt){
  if(evt.target && evt.target.id==='manageProductsModal') closeManageProducts();
}

function renderProductManageList(){
  const container=document.getElementById('productManageList');
  if(!container) return;
  const list=loadProductList();

  if(list.length===0){
    container.innerHTML='<div class="history-empty">No products added yet.</div>';
    return;
  }

  container.innerHTML=list.map(function(p,i){
    return '<div class="product-manage-row">'+
      '<input type="text" class="settings-input product-edit-input" value="'+escapeHtml(p)+'" onchange="renameProduct('+i+',this.value)">'+
      '<button type="button" class="history-delete" onclick="removeProduct('+i+')" aria-label="Remove product">✕</button>'+
    '</div>';
  }).join('');
}

function addNewProduct(){
  const input=document.getElementById('newProductInput');
  const name=input.value.trim();
  const msg=document.getElementById('manageProductsMsg');
  if(!name){
    if(msg) msg.textContent='Product ka naam darj karein.';
    return;
  }
  const list=loadProductList();
  if(list.some(function(p){ return p.toLowerCase()===name.toLowerCase(); })){
    if(msg) msg.textContent='Ye product pehle se list mein maujood hai.';
    return;
  }
  list.push(name);
  persistProductList(list);
  input.value='';
  if(msg) msg.textContent='';
  renderProductManageList();
}

function renameProduct(index,newName){
  const name=newName.trim();
  const list=loadProductList();
  if(index<0||index>=list.length) return;
  if(!name){ renderProductManageList(); return; }
  list[index]=name;
  persistProductList(list);
}

function removeProduct(index){
  const list=loadProductList();
  if(index<0||index>=list.length) return;
  if(!confirm('Remove product "'+list[index]+'" from the list?\n\n(Saved stock entries won\'t be affected.)')) return;
  list.splice(index,1);
  persistProductList(list);
  renderProductManageList();
}

/* ---------- Dip (mm) → auto Dip Stock (Ltrs) ---------- */
function onStockDipMM(){
  const mmRaw=document.getElementById('sk_dipMM').value;
  const mm=parseFloat(mmRaw);
  if(mmRaw!=='' && !isNaN(mm)){
    const ltrs=interp(tank50,mm);
    if(ltrs!=null) document.getElementById('sk_dipStock').value=ltrs.toFixed(2);
  }
  calcStock();
}
function onEditStockDipMM(){
  const mmRaw=document.getElementById('es_dipMM').value;
  const mm=parseFloat(mmRaw);
  if(mmRaw!=='' && !isNaN(mm)){
    const ltrs=interp(tank50,mm);
    if(ltrs!=null) document.getElementById('es_dipStock').value=ltrs.toFixed(2);
  }
}

(function initStockProducts(){
  populateProductSelects();
  autoFillOpeningFromLastBalance();
})();

/* ================= Stock: auto-fill Opening from last saved Balance ================= */
function getStockOpeningHintEl(){
  return document.getElementById('sk_openingHint');
}

function autoFillOpeningFromLastBalance(){
  const productSel=document.getElementById('sk_product');
  const openingInput=document.getElementById('sk_opening');
  if(!productSel||!openingInput) return;
  const product=productSel.value;
  const hint=getStockOpeningHintEl();
  if(!product){ if(hint) hint.textContent=''; return; }
  const list=loadStockHistory();
  const last=list.find(function(e){ return e.product===product; });
  if(last){
    const bal=parseFloat(String(last.balance||'').replace(/,/g,''));
    if(!isNaN(bal) && openingInput.value===''){
      openingInput.value=bal.toFixed(2);
      calcStock();
      if(hint) hint.textContent='Auto-filled from last balance ('+(last.date||'')+')';
      return;
    }
  }
  if(hint) hint.textContent='';
}

function onStockProductChange(){
  const openingInput=document.getElementById('sk_opening');
  if(openingInput) openingInput.value='';
  autoFillOpeningFromLastBalance();
  calcStock();
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

function clearUnloadForm(){
  if(!confirm('Sabhi fields clear kar dein?')) return;
  document.getElementById('ul_date').value=new Date().toISOString().slice(0,10);
  document.getElementById('ul_vendor').value='';
  document.getElementById('ul_vehicle').value='';
  document.getElementById('ul_driver').value='';
  document.getElementById('ul_contact').value='';
  document.getElementById('ul_tank').value='t50';
  document.getElementById('ul_curDip').value='';
  document.getElementById('ul_prvDip').value='';
  document.getElementById('ul_sale').value='';
  document.getElementById('ul_invStock').value='';
  calcUnload();
}

function gatherUnloadData(){
  const tankSel=document.getElementById('ul_tank').value;
  const tank=UNLOAD_TANKS[tankSel];
  const rawDate=document.getElementById('ul_date').value;
  let dateDisplay=rawDate || formatDateDMY(new Date());
  if(rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)){
    const parts=rawDate.split('-');
    const d=new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2]));
    if(!isNaN(d.getTime())) dateDisplay=formatDateDMY(d);
  }
  return {
    date: dateDisplay,
    dateRaw: rawDate || new Date().toISOString().slice(0,10),
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
    savedAt: formatDateDMY(new Date())+' '+formatTimeHM(new Date())
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
  if(footer) footer.innerText='Generated: '+formatDateTimeDMY(new Date());
  const site=getSiteHeaderText();
  const headEl=document.querySelector('#unloadReceipt .unload-receipt-head');
  if(headEl){
    headEl.innerText = (site.name ? site.name+' — ' : '') + 'Vehicle Unloading Tank Status';
  }
  let addrEl=document.getElementById('rc_site_address');
  if(!addrEl){
    addrEl=document.createElement('div');
    addrEl.id='rc_site_address';
    addrEl.className='reading-detail-addr';
    const head=document.querySelector('#unloadReceipt .unload-receipt-head');
    if(head && head.nextSibling) head.parentNode.insertBefore(addrEl, head.nextSibling);
    else if(head) head.parentNode.appendChild(addrEl);
  }
  if(site.address){ addrEl.textContent=site.address; addrEl.style.display='block'; }
  else { addrEl.textContent=''; addrEl.style.display='none'; }
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

/* ---------- Edit a saved unloading record ---------- */
let editingUnloadIndex=-1;

function openEditUnload(index){
  const list=loadUnloadHistory();
  const e=list[index];
  if(!e) return;
  editingUnloadIndex=index;
  document.getElementById('eu_vendor').value=e.vendor||'';
  document.getElementById('eu_vehicle').value=e.vehicle||'';
  document.getElementById('eu_driver').value=e.driver||'';
  document.getElementById('eu_contact').value=e.contact||'';
  document.getElementById('eu_tank').value=(e.tankLabel||'').indexOf('50')!==-1?'t50':'t25';
  document.getElementById('eu_curDip').value=e.curDip||'';
  document.getElementById('eu_prvDip').value=e.prvDip||'';
  document.getElementById('eu_sale').value=(e.sale||'0').toString().replace(/,/g,'');
  document.getElementById('eu_invStock').value=(e.invStock||'').toString().replace(/,/g,'');
  document.getElementById('eu_date').value=e.dateRaw||'';
  const msg=document.getElementById('editUnloadMsg');
  if(msg) msg.textContent='';
  document.getElementById('editUnloadModal').style.display='flex';
}
function closeEditUnload(){
  document.getElementById('editUnloadModal').style.display='none';
  editingUnloadIndex=-1;
}
function closeEditUnloadOnBg(evt){
  if(evt.target && evt.target.id==='editUnloadModal') closeEditUnload();
}
function saveEditUnload(){
  if(editingUnloadIndex<0) return;
  const list=loadUnloadHistory();
  const old=list[editingUnloadIndex];
  if(!old) return;

  const tankSel=document.getElementById('eu_tank').value;
  const tank=UNLOAD_TANKS[tankSel];
  const curDip=parseFloat(document.getElementById('eu_curDip').value);
  const prvDip=parseFloat(document.getElementById('eu_prvDip').value);
  const sale=parseFloat(document.getElementById('eu_sale').value)||0;
  const invInput=parseFloat(document.getElementById('eu_invStock').value);
  const rawDate=document.getElementById('eu_date').value;

  const curLtrs=isNaN(curDip)?null:interp(tank.data,curDip);
  const prvLtrs=isNaN(prvDip)?null:interp(tank.data,prvDip);
  const balance=(curLtrs!=null&&prvLtrs!=null)?curLtrs-prvLtrs:null;
  const totalLiters=balance!=null?balance+sale:null;
  const invStock=isNaN(invInput)?null:invInput;
  const stEx=(totalLiters!=null&&invStock!=null)?totalLiters-invStock:null;

  let dateDisplay=rawDate||old.date;
  if(rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)){
    const parts=rawDate.split('-');
    const dd=new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2]));
    if(!isNaN(dd.getTime())) dateDisplay=formatDateDMY(dd);
  }

  const updated={
    date:dateDisplay,
    dateRaw:rawDate||old.dateRaw,
    vendor:document.getElementById('eu_vendor').value.trim(),
    vehicle:document.getElementById('eu_vehicle').value.trim(),
    driver:document.getElementById('eu_driver').value.trim(),
    contact:document.getElementById('eu_contact').value.trim(),
    tankLabel:tank.label,
    curDip:document.getElementById('eu_curDip').value,
    curLtrs:curLtrs!=null?fmtNum(curLtrs)+' L':'— L',
    prvDip:document.getElementById('eu_prvDip').value,
    prvLtrs:prvLtrs!=null?fmtNum(prvLtrs)+' L':'— L',
    balance:fmtNum(balance),
    sale:document.getElementById('eu_sale').value||'0',
    totalLiters:fmtNum(totalLiters),
    totalStock:fmtNum(totalLiters),
    invStock:document.getElementById('eu_invStock').value,
    stEx:stEx!=null?(stEx>=0?'+':'')+fmtNum(stEx):'0.00',
    savedAt:old.savedAt
  };

  const changedFields=[];
  const labels={vendor:'Vendor',vehicle:'Vehicle No',driver:'Driver',contact:'Contact',tankLabel:'Tank',curDip:'Current Dip',prvDip:'Prv Dip',sale:'Sale Liters',invStock:'Inv Stock',date:'Date'};
  Object.keys(labels).forEach(function(k){
    if(String(old[k]||'')!==String(updated[k]||'')) changedFields.push(labels[k]);
  });

  if(changedFields.length){
    updated.editedAt=formatDateDMY(new Date())+' '+formatTimeHM(new Date());
    updated.editSummary='Updated: '+changedFields.join(', ');
  }else{
    updated.editedAt=old.editedAt;
    updated.editSummary=old.editSummary;
  }

  list[editingUnloadIndex]=updated;
  persistUnloadHistory(list);
  renderUnloadHistory();
  closeEditUnload();
}

function renderUnloadHistory(){
  renderEntryCounts();
  const container=document.getElementById('unloadHistoryList');
  if(!container) return;
  const list=loadUnloadHistory();

  if(list.length===0){
    container.innerHTML='<div class="history-empty">No unloading records saved yet.</div>';
    return;
  }

  container.innerHTML=list.map((e,i)=>
    '<div class="history-row history-row-clickable" onclick="viewUnloadAsImage('+i+')" title="Tap to view as image">'+
      '<span class="history-tank">'+escapeHtml(e.vehicle||e.vendor||'—')+'</span>'+
      '<span class="history-dip">'+escapeHtml(e.tankLabel||'')+'</span>'+
      '<span class="history-vol">'+escapeHtml(e.totalLiters||'0.00')+' L</span>'+
      '<span class="history-time">'+escapeHtml(e.date||'')+'</span>'+
      '<button type="button" class="history-edit" onclick="event.stopPropagation();openEditUnload('+i+')" aria-label="Edit this record">✏️</button>'+
      '<button type="button" class="history-delete" onclick="event.stopPropagation();deleteUnloadEntry('+i+')" aria-label="Delete this record">✕</button>'+
      (e.editedAt?'<span class="history-edited">✏️ Edited: '+escapeHtml(e.editSummary||'')+' — '+escapeHtml(e.editedAt)+'</span>':'')+
    '</div>'
  ).join('');
}

/* ---------- View unloading history entry as image ---------- */
async function viewUnloadAsImage(index){
  const list=loadUnloadHistory();
  if(index<0||index>=list.length) return;
  const e=list[index];
  const site=getSiteHeaderText();

  // Temporarily fill receipt with saved entry
  document.getElementById('rc_date').innerText = e.date || '-';
  document.getElementById('rc_vendor').innerText = e.vendor || '-';
  document.getElementById('rc_vehicle').innerText = e.vehicle || '-';
  document.getElementById('rc_driver').innerText = e.driver || '-';
  document.getElementById('rc_contact').innerText = e.contact || '-';
  document.getElementById('rc_tank').innerText = e.tankLabel || '-';
  document.getElementById('rc_curDip').innerText = e.curDip? e.curDip+' mm':'-';
  document.getElementById('rc_curLtrs').innerText = e.curLtrs || '-';
  document.getElementById('rc_prvDip').innerText = e.prvDip? e.prvDip+' mm':'-';
  document.getElementById('rc_prvLtrs').innerText = e.prvLtrs || '-';
  document.getElementById('rc_balance').innerText = e.balance || '-';
  document.getElementById('rc_sale').innerText = e.sale || '-';
  document.getElementById('rc_totalLiters').innerText = e.totalLiters || '-';
  document.getElementById('rc_totalStock').innerText = e.totalStock || '-';
  document.getElementById('rc_invStock').innerText = e.invStock || '-';
  document.getElementById('rc_stEx').innerText = e.stEx || '-';
  const footer=document.getElementById('rc_footer');
  if(footer) footer.innerText='Saved: '+(e.savedAt||'')+' | Viewed: '+formatDateTimeDMY(new Date());
  const headEl=document.querySelector('#unloadReceipt .unload-receipt-head');
  if(headEl) headEl.innerText = (site.name ? site.name+' — ' : '') + 'Vehicle Unloading Tank Status';
  let addrEl=document.getElementById('rc_site_address');
  if(!addrEl){
    addrEl=document.createElement('div');
    addrEl.id='rc_site_address';
    addrEl.className='reading-detail-addr';
    if(headEl && headEl.nextSibling) headEl.parentNode.insertBefore(addrEl, headEl.nextSibling);
    else if(headEl) headEl.parentNode.appendChild(addrEl);
  }
  if(site.address){ addrEl.textContent=site.address; addrEl.style.display='block'; }
  else { addrEl.textContent=''; addrEl.style.display='none'; }

  if(!window.html2canvas){
    alert('Image view needs an internet connection to load the first time. Please check your connection and try again.');
    return;
  }
  const el=document.getElementById('unloadReceipt');
  try{
    const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff'});
    canvas.toBlob(function(blob){
      if(!blob) return;
      const url=URL.createObjectURL(blob);
      const w=window.open('','_blank');
      if(w){
        w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unloading Detail</title>'+
          '<style>body{margin:0;padding:16px;background:#111;display:flex;flex-direction:column;align-items:center;min-height:100vh;box-sizing:border-box;font-family:system-ui,sans-serif;}'+
          'img{max-width:100%;height:auto;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.4);}'+
          '.actions{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}'+
          'a,button{padding:10px 18px;border-radius:8px;border:none;font-size:15px;cursor:pointer;text-decoration:none;color:#fff;}'+
          '.dl{background:#2563eb;} .cl{background:#64748b;}</style></head><body>'+
          '<img src="'+url+'" alt="Unloading detail">'+
          '<div class="actions"><a class="dl" download="unloading-'+formatDateDMY(new Date())+'.png" href="'+url+'">⬇️ Download Image</a>'+
          '<button class="cl" onclick="window.close()">Close</button></div></body></html>');
        w.document.close();
      }else{
        shareOrDownloadBlob(blob,'unloading-'+formatDateDMY(new Date())+'.png','image/png');
      }
      // restore live receipt
      updateUnloadReceipt();
    },'image/png');
  }catch(err){
    alert('Image banate waqt masla hua. Dobara koshish karein.');
    updateUnloadReceipt();
  }
}

/* ---------- Print unloading status (opens print-ready window) ---------- */
function printUnload(){
  calcUnload();
  const d=gatherUnloadData();
  const w=window.open('','_blank');
  if(!w){ alert('Popup blocked. Please allow popups to print.'); return; }

  const site=getSiteHeaderText();
  const html='<!doctype html><html><head><meta charset="utf-8"><title>Unloading Status</title>'+
    '<style>'+
    'body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#1a1a1a;}'+
    'h2{background:#37474f;color:#fff;padding:12px 14px;margin:0 0 6px;border-radius:6px;font-size:18px;}'+
    '.site-addr{font-size:13px;color:#555;margin:0 0 14px;}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:16px;}'+
    'td,th{border:1px solid #999;padding:8px 10px;font-size:14px;}'+
    'td:first-child{font-weight:700;background:#f3f3f3;width:42%;}'+
    'th{background:#eceff1;font-weight:700;}'+
    '.total-row td{font-weight:800;background:#fff8e1;}'+
    'p.foot{font-size:11px;color:#777;margin-top:20px;}'+
    '</style></head><body>'+
    '<h2>'+escapeHtml(site.name ? site.name+' — ' : '')+'Vehicle Unloading Tank Status</h2>'+
    (site.address?'<p class="site-addr">'+escapeHtml(site.address)+'</p>':'')+
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
      '<tr><td>Current Dip & Ltrs</td><td>'+(d.curDip?d.curDip+' mm':'-')+'</td><td>'+d.curLtrs+'</td></tr>'+
      '<tr><td>Prv Dip & Ltrs</td><td>'+(d.prvDip?d.prvDip+' mm':'-')+'</td><td>'+d.prvLtrs+'</td></tr>'+
      '<tr><td colspan="2">Balance Liters</td><td>'+d.balance+'</td></tr>'+
      '<tr><td colspan="2">Sale Liters</td><td>'+d.sale+'</td></tr>'+
      '<tr class="total-row"><td colspan="2">TOTAL LITERS</td><td>'+d.totalLiters+'</td></tr>'+
    '</table>'+
    '<table>'+
      '<tr><td>TOTAL STOCK</td><td>'+d.totalStock+'</td></tr>'+
      '<tr><td>INV STOCK</td><td>'+(d.invStock||'-')+'</td></tr>'+
      '<tr><td>ST / EX LITER</td><td>'+d.stEx+'</td></tr>'+
    '</table>'+
    '<p class="foot">Generated: '+formatDateTimeDMY(new Date())+'</p>'+
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
      const stamp=formatDateDMY(new Date()).replace(/-/g,'');
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
