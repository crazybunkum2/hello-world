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
 if(e.target.dataset.remove!==undefined){let i=+e.target.dataset.remove;if(confirm('Remove this holding?')){data.holdings.splice(i,1);save();render()}}
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
