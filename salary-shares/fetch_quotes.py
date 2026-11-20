"""Generate public exchange-rate and market-price cache without personal financial records."""
import concurrent.futures,json,pathlib,urllib.parse,urllib.request,time
SYMBOLS=['AVGO','MSFT','MU','GOOG','GOOGL','ASML.AS','CSCO','ISF.L','SWDA.L','NBIS','NVDA','AAPL','AMZN','META','TSLA','JPM','AMD','TSM','SPY','QQQ','VTI','BRK-B','V','MA','NESN.SW','SHEL.L','ULVR.L','LLOY.L','AZN.L','VUSA.L','IWDA.AS','VUAG.L','GBPUSD=X','GBPEUR=X']
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (SalarySharesPublic/1.0)','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=8) as r:return json.load(r)
def price(symbol):
 try:
  path=urllib.parse.quote(symbol,safe='')
  doc=get('https://query1.finance.yahoo.com/v8/finance/chart/'+path+'?interval=1d&range=5d')
  meta=doc['chart']['result'][0]['meta'];p=meta.get('regularMarketPrice');t=meta.get('regularMarketTime');c=meta.get('currency')
  if not (isinstance(p,(int,float)) and p>0 and isinstance(t,(int,float)) and t>0 and c):return None
  return(symbol,{'price':round(float(p),8),'time':int(t),'currency':c,'source':'Yahoo Finance'})
 except Exception:return None
def fx():
 for url in ['https://open.er-api.com/v6/latest/GBP','https://api.frankfurter.dev/v1/latest?base=GBP&symbols=USD,EUR,THB']:
  try:
   raw=get(url)['rates'];out={k:float(raw[k]) for k in ('USD','EUR','THB')}
   if not all(0<x<1000 for x in out.values()):continue
   out['GBP']=1.0;out['OMR']=float(raw.get('OMR',out['USD']*.3845));return out
  except Exception:pass
 return {}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:found=list(ex.map(price,SYMBOLS))
quotes=dict(x for x in found if x)
out={'retrievedAt':int(time.time()*1000),'fx':fx(),'quotes':quotes,'source':'Public Yahoo Finance chart data; quotations may be delayed or unavailable'}
path=pathlib.Path(__file__).with_name('quotes.json')
path.write_text(json.dumps(out,separators=(',',':'))+'\n')
print('Published',len(quotes),'quotations and',len(out['fx']),'FX rates')
