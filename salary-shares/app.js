'use strict';
const $=id=>document.getElementById(id),KEY='salary-shares-iphone-private-v2';
const currencies={OMR:'🇴🇲 OMR',GBP:'🇬🇧 GBP',USD:'🇺🇸 USD',EUR:'🇪🇺 EUR',THB:'🇹🇭 THB'};
const initial=()=>({anchor:0,baisa:null,salaryBaisa:1750000,rentBaisa:435000,spending:[],holdings:[],cashGBP:0,salaryCurrency:'OMR',investCurrency:'GBP'});
let data=initial(),feed=null,checked=0;
function parse(s){try{return JSON.parse(s)}catch{return null}}
let previous=parse(localStorage.getItem(KEY));if(previous&&previous.schema===2)data={...data,...previous.data};
function save(){localStorage.setItem(KEY,JSON.stringify({schema:2,data}))}
function seed(){
 let s=null;
 try{let m=location.hash.match(/(?:^#|&)s=([A-Za-z0-9_-]+)/);if(m){s=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,'+').replace(/_/g,'/')))))} }catch(e){}
 if(s&&data.baisa===null&&Number.isSafeInteger(s.b)&&s.b>=0){
  data.anchor=Date.now();data.baisa=s.b;
  if(Array.isArray(s.h))data.holdings=s.h.filter(x=>Array.isArray(x)&&typeof x[0]==='string'&&Number.isFinite(x[1])&&Number.isFinite(x[2])).map(x=>({symbol:x[0],qty:x[1],basis:x[2]}));
  if(Number.isFinite(s.c))data.cashGBP=s.c;
  save();
 }
 if(location.hash)history.replaceState(null,'',location.pathname+location.search);
}
seed();
const time=ms=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Muscat',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
const hm=ms=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Muscat',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
const dp=ms=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Muscat',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));
const midnight=(y,m,d)=>Date.UTC(y,m-1,d)-14400000;
const monthend=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
function events(now=Date.now()){
 if(data.baisa===null||!data.anchor)return{done:[],next:[]};
 let {year,month}=dp(data.anchor),done=[],next=[];
 for(let n=0;n<120;n++){
  for(const [day,value,label] of [[1,-data.rentBaisa,'Rent deducted'],[monthend(year,month),data.salaryBaisa,'Salary received']]){
   const at=midnight(year,month,day),obj={at,baisa:value,label};
   if(at>data.anchor&&at<=now)done.push(obj);else if(at>now)next.push(obj);
  }
  if(next.length>=3)break;
  month++;if(month>12){month=1;year++}
 }
 return{done,next:next.sort((a,b)=>a.at-b.at)};
}
function balance(){
 if(data.baisa===null)return null;
 return data.baisa+events().done.reduce((n,x)=>n+x.baisa,0)-data.spending.filter(x=>x.at>data.anchor).reduce((n,x)=>n+x.baisa,0);
}
function rate(code){if(code==='GBP')return 1;return feed&&feed.fx&&(feed.fx[code]||(code==='OMR'&&feed.fx.USD?feed.fx.USD*.3845:null))}
function gbp(v,code){let r=rate(code);if(!(r>0))return 'Rate unavailable';return new Intl.NumberFormat('en-GB',{style:'currency',currency:code,minimumFractionDigits:code==='OMR'?3:2,maximumFractionDigits:code==='OMR'?3:2}).format(v*r)}
function omr(v,code){if(code==='OMR')return new Intl.NumberFormat('en-GB',{style:'currency',currency:'OMR',minimumFractionDigits:3,maximumFractionDigits:3}).format(v);return rate('OMR')?gbp(v/rate('OMR'),code):'Rate unavailable'}
function quoteGBP(symbol){
 const q=feed?.quotes?.[symbol];if(!q||!(q.price>0))return null;
 let native=q.currency==='GBp'?'GBP':q.currency,r=rate(native);
 if(!(r>0))return null;
 return{unit:(q.currency==='GBp'?q.price/100:q.price)/r,date:q.time*1000};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function portfolio(){
 let value=data.cashGBP||0,opening=data.cashGBP||0,live=0,latest=0;
 const rows=data.holdings.map(h=>{
  let q=quoteGBP(h.symbol),current=q?h.qty*q.unit:h.basis;
  value+=current;opening+=h.basis;if(q){live++;latest=Math.max(latest,q.date)}
  return{...h,current,quote:q};
 });
 return{value,opening,live,latest,rows};
}
function render(){
 const now=Date.now(),b=balance(),ev=events(),p=portfolio();
 $('clock').textContent=hm(now);
 $('salaryValue').textContent=b===null?'Balance not set':omr(b/1000,data.salaryCurrency);
 $('salarySub').textContent=b===null?'Enter a starting balance below.':'Starting balance '+omr(data.baisa/1000,data.salaryCurrency)+' · '+time(data.anchor);
 let next=ev.next[0];$('nextPayment').textContent=next?'Next: '+next.label+' '+(next.baisa>0?'+':'−')+omr(Math.abs(next.baisa)/1000,data.salaryCurrency)+' · '+time(next.at)+' Muscat':'Enter your bank balance to start';
 $('investmentValue').textContent=p.rows.length?gbp(p.value,data.investCurrency):'Add your holdings';
 let diff=p.value-p.opening;
 $('investmentDelta').textContent=p.rows.length?(diff<0?'−':'+')+gbp(Math.abs(diff),data.investCurrency)+' ('+(p.opening?100*diff/p.opening:0).toFixed(2)+'%) since opening valuation':'No holdings saved yet';
 $('quoteStatus').textContent=p.rows.length?p.live+' of '+p.rows.length+' holdings have retrieved quotations. '+(p.live<p.rows.length?'Missing prices use opening valuations.':''):'Add holdings using the button below';
 $('valuationDate').textContent='Most recent market quotation: '+(p.latest?time(p.latest)+' Muscat':'not yet available')+'. Prices may be delayed.';
 $('holdingsCount').textContent='('+p.rows.length+')';
 $('holdings').innerHTML=p.rows.length?p.rows.map((h,i)=>'<div class="entry"><div><b>'+esc(h.symbol)+'</b><small>'+(h.quote?'Quote from '+time(h.quote.date):'Opening reference — no live quote')+'</small></div><div class="right"><b>'+gbp(h.current,data.investCurrency)+'</b><small><button data-edit="'+i+'">Edit</button><button data-remove="'+i+'">Remove</button></small></div></div>').join(''):'<p class="small">Add a holding to track its value.</p>';
 const list=[];
 if(data.baisa!==null)list.push({at:data.anchor,label:'Starting savings balance',baisa:data.baisa,note:'Confirmed opening figure'});
 data.spending.forEach(x=>list.push({at:x.at,label:x.label,baisa:-x.baisa,note:x.at<=data.anchor?'Already in opening balance':'Deducted from savings'}));
 ev.done.forEach(x=>list.push({at:x.at,label:x.label,baisa:x.baisa,note:'Scheduled transaction'}));
 list.sort((a,b)=>b.at-a.at);
 $('activity').innerHTML=list.length?list.slice(0,100).map(x=>'<div class="entry"><div><b>'+esc(x.label)+'</b><small>'+time(x.at)+' · '+esc(x.note)+'</small></div><div class="right"><b class="'+(x.baisa<0?'negative':'positive')+'">'+(x.baisa<0?'−':'+')+'OMR '+(Math.abs(x.baisa)/1000).toFixed(3)+'</b></div></div>').join(''):'<p class="small">No transactions recorded.</p>';
 $('feedTime').textContent=feed?.retrievedAt?time(feed.retrievedAt)+' Muscat':(checked?time(checked)+' · no feed':'Not yet');
}
for(const side of ['salary','invest']){
 const el=$(side+'Currency');
 el.innerHTML=Object.entries(currencies).map(([c,label])=>'<option value="'+c+'">'+label+'</option>').join('');
 el.value=data[side+'Currency'];el.onchange=()=>{data[side+'Currency']=el.value;save();render()}
}
let edit=-1;
$('addHolding').onclick=()=>{edit=-1;$('holdingForm').reset();$('holdingDialog').showModal()};
$('holdings').onclick=e=>{
 if(e.target.dataset.edit!==undefined){edit=+e.target.dataset.edit;let h=data.holdings[edit];$('ticker').value=h.symbol;$('quantity').value=h.qty;$('basis').value=h.basis;$('holdingDialog').showModal()}
 if(e.target.dataset.remove!==undefined){let i=+e.target.dataset.remove;if(confirm('Remove this holding?')){data.holdings.splice(i,1);data.holdingsUpdatedAt=Date.now();save();render()}}
};
$('cancelHolding').onclick=()=>$('holdingDialog').close();
$('holdingForm').onsubmit=e=>{
 e.preventDefault();
 let symbol=$('ticker').value.trim().toUpperCase(),qty=+$('quantity').value,basis=+$('basis').value;
 if(!/^[A-Z0-9.=\-^]{1,20}$/.test(symbol)||!(qty>0)||!(basis>=0))return alert('Check symbol, quantity and opening valuation');
 let h={symbol,qty,basis};if(edit<0)data.holdings.push(h);else data.holdings[edit]=h;
 save();$('holdingDialog').close();render();loadPrices();
};
$('addSpending').onclick=()=>$('paymentDialog').showModal();
$('cancelPayment').onclick=()=>$('paymentDialog').close();
$('paymentForm').onsubmit=e=>{
 e.preventDefault();if(data.baisa===null)return alert('Set a bank balance first');
 let v=Math.round(+$('paymentAmount').value*1000);if(!(v>0))return;
 data.spending.push({at:Date.now(),baisa:v,label:$('description').value.trim()});save();$('paymentDialog').close();$('paymentForm').reset();render();
};
$('saveSettings').onclick=()=>{
 let salary=+$('salaryInput').value,rent=+$('rentInput').value,s=$('balanceInput').value.trim();
 if(!(salary>=0)||!(rent>=0)||!Number.isFinite(salary)||!Number.isFinite(rent))return alert('Please enter valid salary and rent');
 data.salaryBaisa=Math.round(salary*1000);data.rentBaisa=Math.round(rent*1000);
 if(s){let b=Math.round(+s*1000);if(!Number.isSafeInteger(b)||b<0)return alert('Please enter a valid balance');data.baisa=b;data.anchor=Date.now();$('feedback').textContent='Opening balance saved as of now; prior payments will not be deducted again.';}
 else $('feedback').textContent='Salary and rent settings saved.';
 save();$('balanceInput').value='';render();
};
$('export').onclick=()=>{
 let blob=new Blob([JSON.stringify({type:KEY,schema:2,data},null,2)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download='salary-shares-private-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
};
$('import').onchange=async e=>{
 try{let f=e.target.files[0];if(!f)return;let o=JSON.parse(await f.text());if(o.type!==KEY||o.schema!==2||!o.data)throw Error('Not a Salary & Shares backup');
 if(!confirm('Replace saved records on this phone?'))return;data={...initial(),...o.data};save();location.reload()}
 catch(err){$('feedback').textContent=err.message}
};
async function loadPrices(){
 checked=Date.now();
 try{let r=await fetch('./quotes.json?time='+Math.floor(Date.now()/60000),{cache:'no-store'});if(!r.ok)throw Error('Quotes unavailable');
 let obj=await r.json();if(obj&&obj.quotes&&obj.fx)feed=obj;}catch(e){}
 render();
}
$('refresh').onclick=loadPrices;render();loadPrices();
setInterval(()=>{render();if(!document.hidden)loadPrices()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadPrices()});
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});


// SS_SECURE_DESKTOP_SYNC_V1
// No finance records or access keys are embedded in the public website.
const SS_SYNC_URL='https://salary-shares-iphone-paul-2026.netlify.app/.netlify/functions/sync';
const SS_SYNC_STORAGE='ss-personal-omarchy-pairing-v1';
let ssSyncKey=localStorage.getItem(SS_SYNC_STORAGE)||'';
let ssSyncBusy=false, ssSyncTimer=null;
const ssSyncStatus=$('syncStatus');
if(ssSyncKey){ssSyncStatus.textContent='Paired with Omarchy. Syncing…';}
function ssSpending(){
 let changed=false;
 for(let x of data.spending){
   if(!x.id){x.id=crypto.randomUUID();changed=true}
   if(!Number.isFinite(x.updatedAt)){x.updatedAt=x.at||Date.now();changed=true}
 }
 if(changed)localStorage.setItem(KEY,JSON.stringify({schema:2,data}));
 return data.spending.map(x=>({id:x.id,at:x.at,baisa:x.baisa,label:x.label,removed:!!x.removed,updatedAt:x.updatedAt}));
}
const ssOriginalSave=save;
save=function(){
 ssOriginalSave();
 if(ssSyncKey && !ssSyncBusy){
  clearTimeout(ssSyncTimer);
  ssSyncTimer=setTimeout(()=>ssSyncNow(),1800);
 }
};
const ssOriginalSaveSettings=$('saveSettings').onclick;
$('saveSettings').onclick=function(){
 data.settingsUpdatedAt=Date.now();
 ssOriginalSaveSettings();
};
$('holdingForm').addEventListener('submit',()=>{data.holdingsUpdatedAt=Date.now()}, {capture:true});
function ssPayload(){
 return {
  schema:1,
  settings:data.baisa===null?null:{
   anchor:Number(data.anchor)||0,
   openingBaisa:Number(data.baisa),
   salaryBaisa:Number(data.salaryBaisa),
   rentBaisa:Number(data.rentBaisa),
   updatedAt:Number(data.settingsUpdatedAt)||Number(data.anchor)||1
  },
  holdings:data.holdings.map(h=>({symbol:h.symbol,qty:Number(h.qty),basis:Number(h.basis)})),
  holdingsUpdatedAt:Number(data.holdingsUpdatedAt)||1,
  cashGBP:Number(data.cashGBP)||0,cashUpdatedAt:Number(data.cashUpdatedAt)||1,
  spending:ssSpending()
 };
}
function ssApply(remote){
 if(!remote || remote.schema!==1)throw Error('Unexpected synchronisation data');
 if(remote.settings && Number.isSafeInteger(remote.settings.openingBaisa)){
  let s=remote.settings, old=Number(data.settingsUpdatedAt)||Number(data.anchor)||0;
  if(s.updatedAt>=old || !localStorage.getItem('ss-paired-initial-import-v1')){
   data.anchor=s.anchor;
   data.baisa=s.openingBaisa;
   data.salaryBaisa=s.salaryBaisa;
   data.rentBaisa=s.rentBaisa;
   data.settingsUpdatedAt=s.updatedAt;
  }
 }
 if(Array.isArray(remote.holdings) &&
    Number(remote.holdingsUpdatedAt)>=Number(data.holdingsUpdatedAt||0)){
   data.holdings=remote.holdings.filter(h=>typeof h.symbol==='string'&&Number.isFinite(h.qty)&&Number.isFinite(h.basis));
   data.holdingsUpdatedAt=Number(remote.holdingsUpdatedAt)||1;
 }
 if(Number(remote.cashUpdatedAt)>=Number(data.cashUpdatedAt||0) && Number.isFinite(remote.cashGBP)){
  data.cashGBP=remote.cashGBP;data.cashUpdatedAt=Number(remote.cashUpdatedAt)||1;
 }
 if(Array.isArray(remote.spending)){
  let list=new Map();
  for(let x of [...ssSpending(),...remote.spending]){
   if(!x||typeof x.id!=='string'||!Number.isFinite(x.baisa)||!Number.isFinite(x.at))continue;
   let old=list.get(x.id);
   if(!old || Number(x.updatedAt)>=Number(old.updatedAt))
    list.set(x.id,{id:x.id,at:x.at,baisa:x.baisa,label:x.label||'Payment',removed:!!x.removed,updatedAt:x.updatedAt||x.at});
  }
  data.spending=[...list.values()].filter(x=>!x.removed);
 }
 ssOriginalSave();
 render();
}
async function ssRequest(method,body){
 const r=await fetch(SS_SYNC_URL,{
  method,mode:'cors',cache:'no-store',
  headers:{'Authorization':'Bearer '+ssSyncKey,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(!r.ok)throw Error('Sync service returned '+r.status);
 return await r.json();
}
async function ssSyncNow(){
 if(!ssSyncKey || ssSyncBusy || document.hidden)return;
 ssSyncBusy=true;
 try{
  ssSyncStatus.textContent='Synchronising…';
  const merged=await ssRequest('POST',ssPayload());
  ssApply(merged);
  localStorage.setItem('ss-paired-initial-import-v1','1');
  ssSyncStatus.textContent='Linked with Omarchy · last sync '+hm(Date.now())+' Muscat';
 }catch(e){
  ssSyncStatus.textContent='Not synchronised: '+e.message+' · your phone records are safe';
 }finally{ssSyncBusy=false;}
}
$('connectSync').onclick=()=>{
 let key=$('syncCode').value.trim();
 if(!/^[a-zA-Z0-9_-]{20,100}$/.test(key)){
  ssSyncStatus.textContent='Enter the pairing code printed by your Omarchy installer.';
  return;
 }
 ssSyncKey=key;
 localStorage.setItem(SS_SYNC_STORAGE,key);
 $('syncCode').value='';
 ssSyncNow();
};
$('disconnectSync').onclick=()=>{
 ssSyncKey='';
 localStorage.removeItem(SS_SYNC_STORAGE);
 ssSyncStatus.textContent='Disconnected. The phone keeps its existing records.';
};
setInterval(ssSyncNow,60000);
window.addEventListener('focus',ssSyncNow);
setTimeout(ssSyncNow,1500);


// NBO_SMS_BANKING_INBOX_V1
// This inbox is read-only to the existing savings ledger; no duplicate deductions.
const NBO_INBOX_API='https://salary-shares-iphone-paul-2026.netlify.app/.netlify/functions/nbo';
let nboReceiver='',nboBusy=false;
const nboStatus=$('nboStatus'),nboBalances=$('nboBankBalances'),nboEntries=$('nboEntries');
const nboMoney=b=>Number.isFinite(b)?'OMR '+(b/1000).toFixed(3):'Not yet reported';
function nboEntry(text,secondary){
 const wrap=document.createElement('div');
 wrap.className='entry';
 const main=document.createElement('div');
 main.textContent=text;
 main.style.fontWeight='600';
 const sub=document.createElement('p');
 sub.className='small';
 sub.textContent=secondary||'';
 wrap.append(main,sub);
 return wrap;
}
function nboRender(events,balances){
 nboEntries.replaceChildren();
 nboBalances.replaceChildren();
 for(const acct of ['017','018']){
  const b=balances&&balances[acct];
  nboBalances.append(nboEntry('NBO account '+acct+' · '+(b?nboMoney(b.baisa):'Awaiting an SMS'),b?'Bank-reported available balance; not added to the other account':''));
 }
 for(const t of events.slice(0,25)){
  const direction=t.direction==='in'?'+':'−';
  const detail=(t.category==='card'?'Card '+String(t.account||'').replace(/^card /,''):'Account '+t.account);
  const stamp=t.occurredAt||t.receivedAt;
  nboEntries.append(nboEntry(direction+nboMoney(t.amountBaisa)+' · '+(t.merchant||detail),detail+' · '+(t.direction==='in'?'Money in':'Money out')+(Number.isFinite(stamp)?' · '+time(stamp):'')));
 }
 if(!events.length)nboEntries.append(nboEntry('No new NBO messages received yet','New bank SMS alerts will appear here once the iPhone Shortcut is enabled.'));
}
async function nboLoad(){
 if(!ssSyncKey){nboStatus.textContent='First connect Sync with Omarchy below.';return}
 if(nboBusy||document.hidden)return;
 nboBusy=true;
 try{
  const h={Authorization:'Bearer '+ssSyncKey};
  const r=await fetch(NBO_INBOX_API,{headers:h,cache:'no-store'});
  if(!r.ok)throw Error('NBO receiver returned '+r.status);
  const result=await r.json();
  if(result.schema!==1||!Array.isArray(result.events))throw Error('Unexpected NBO response');
  nboRender(result.events,result.balances||{});
  nboStatus.textContent='NBO messages captured: '+result.count+' · last checked '+hm(Date.now())+' Muscat';
  if(!nboReceiver){
   const setup=await fetch(NBO_INBOX_API+'?mode=setup',{headers:h,cache:'no-store'});
   if(setup.ok){const d=await setup.json();if(typeof d.url==='string'&&d.url.startsWith('https://')){nboReceiver=d.url;$('nboReceiverUrl').value=nboReceiver}}
  }
 }catch(err){nboStatus.textContent='NBO inbox not available: '+err.message}
 finally{nboBusy=false;}
}
$('nboRefresh').onclick=nboLoad;
$('nboCopyUrl').onclick=()=>{
 if(!nboReceiver){nboStatus.textContent='Connect Sync with Omarchy, then tap Check alerts.';return}
 navigator.clipboard.writeText(nboReceiver).then(()=>{
  nboStatus.textContent='Private receiver link copied. Paste it into the Shortcuts Get Contents of URL action.';
 }).catch(()=>{
  $('nboReceiverUrl').focus();$('nboReceiverUrl').select();
  nboStatus.textContent='Link selected. Use Copy to copy it. Keep it private.';
 });
};
setTimeout(nboLoad,2200);
setInterval(nboLoad,60000);
window.addEventListener('focus',nboLoad);
