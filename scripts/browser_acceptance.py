"""Offline browser QA. All requests are fulfilled or aborted; no external sends."""
import json, mimetypes, os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('LANDING_ROOT','/landing'))
OUT=Path(os.environ.get('RESULTS_ROOT','/output')); OUT.mkdir(exist_ok=True)
SITE='https://freeisland-portugal.onrender.com'
API='https://hunter.3-15-128-116.sslip.io'
OP='11111111-1111-4111-8111-111111111111'
CHECKS=[]
def check(name, value):
 CHECKS.append({'name':name,'passed':bool(value)})
 if not value: raise AssertionError(name)
def setup(browser,width,configured=True,mismatch=False,gpc=False):
 context=browser.new_context(viewport={'width':width,'height':900},service_workers='block')
 if gpc:context.add_init_script("Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true})")
 state={'events':[],'api':[],'meta':[],'outbound':[],'first_members':990,'errors':[]}
 config={'operation_id':OP if configured else '', 'operation_slug':'free-island-portugal','country':'PT','api_url':API,'base_url':SITE}
 manifest={**config,'locale':'pt-PT','currency':'EUR','timezone':'Europe/Lisbon','short_prefix':'/r/','shortlinks_enabled':True,
  'promotions_enabled':True,'brand':{'name':'Free Island Portugal','headline':'Boas ofertas. No teu telemóvel.','meta_pixel_id':'111111111111111'}}
 if mismatch:manifest['operation_id']='22222222-2222-4222-8222-222222222222'
 def intercept(route):
  request=route.request;url=urlsplit(request.url);p=url.path
  if url.netloc==urlsplit(SITE).netloc:
   if p=='/config.json': route.fulfill(status=200,content_type='application/json',body=json.dumps(config));return
   if p.startswith(('/r/','/go/')):p='/r/index.html'
   if p=='/':p='/index.html'
   file=ROOT/'dist'/p.lstrip('/')
   if not file.is_file():route.fulfill(status=404,content_type='text/html',body=(ROOT/'dist/404.html').read_text());return
   mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
   route.fulfill(status=200,content_type=mime,body=file.read_bytes());return
  if url.netloc==urlsplit(API).netloc:
   state['api'].append(request.url)
   headers={'Access-Control-Allow-Origin':SITE,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}
   if request.method=='OPTIONS':route.fulfill(status=200,headers=headers,body='');return
   if p.endswith('/manifest'):data=manifest
   elif p.endswith('/routing'):
    groups=[{'priority':1,'status':'ok','members':state['first_members'],'capacity_limit':990,'invite_url':'https://chat.whatsapp.com/'+'A'*20},
      {'priority':2,'status':'ok','members':150,'capacity_limit':990,'invite_url':'https://chat.whatsapp.com/'+'B'*20}]
    data={'whatsapp_groups':groups,'whatsapp_url':groups[0 if state['first_members']<990 else 1]['invite_url'],
     'telegram_url':'https://t.me/freeislandportugal','telegram_channels':[{'url':'https://t.me/freeislandportugal','members':83}],'status':'ok'}
   elif p.endswith('/activity'):
    product={'operation_id':OP,'product_title':'Produto de teste português','store':'Loja de teste','currency':'EUR','short_url':SITE+'/r/produto-1','image_public_url':SITE+'/assets/logo_sem_fundo.png','published_at':'2026-10-31T00:10:00Z'}
    data={'today_count':1,'promotions':[product,{**product,'operation_id':'brazil','product_title':'WRONG OPERATION'},{**product,'currency':'BRL','product_title':'WRONG CURRENCY'},{**product,'short_url':'https://br.test/r/foreign','product_title':'WRONG DOMAIN'}]}
   elif p.endswith('/events'):state['events'].append(json.loads(request.post_data));data={'ok':True}
   elif '/links/' in p:data={'url':'https://www.amazon.es/dp/B000000001?tag=fixture-21'}
   else:route.fulfill(status=404,headers=headers,body='{}');return
   route.fulfill(status=200,headers=headers,content_type='application/json',body=json.dumps(data));return
  if url.netloc=='connect.facebook.net':
   state['meta'].append(request.url);route.fulfill(status=200,content_type='text/javascript',body='window.fbq.callMethod=function(){};');return
  if url.netloc in {'chat.whatsapp.com','t.me','www.amazon.es'}:
   state['outbound'].append(request.url);route.fulfill(status=200,content_type='text/html',body='<h1>Offline destination fixture</h1>');return
  route.abort()
 context.route('**/*',intercept)
 page=context.new_page();page.on('pageerror',lambda error:state['errors'].append(str(error)))
 return context,page,state

def configured(browser,width):
 ctx,page,state=setup(browser,width)
 page.goto(SITE+'/?utm_source=fixture&utm_medium=test',wait_until='domcontentloaded')
 page.locator('#privacy-preferences[open]').wait_for();page.locator('.promotion-card').wait_for()
 check(f'{width}: Portugal locale',page.locator('html').get_attribute('lang')=='pt-PT')
 check(f'{width}: configured title keeps original accent',page.locator('h1 span').inner_text()=='No teu telemóvel.')
 check(f'{width}: foreign products excluded',page.locator('.promotion-card').count()==1 and 'WRONG' not in page.locator('body').inner_text())
 check(f'{width}: no storefront',page.locator('.amazon-store-card, a[href*="amazon.com.br"], a[href*="/shop/"]').count()==0)
 check(f'{width}: no Pixel before consent',not state['meta'])
 page.get_by_label('Permitir detalhes de navegação',exact=True).check();page.get_by_role('button',name='Guardar preferências').click();page.wait_for_timeout(200)
 check(f'{width}: analytics alone no advertising',not state['meta'])
 check(f'{width}: aggregate once',sum(e['aggregate'] for e in state['events'] if e['event']=='page_view')==1)
 check(f'{width}: opt-in details independent',any(e['consent'] and not e['aggregate'] for e in state['events']))
 check(f'{width}: same nonce',len({e['page_nonce'] for e in state['events']})==1)
 check(f'{width}: no anonymous campaign',all(not e['source'] and e['session_id'] is None for e in state['events'] if not e['consent']))
 check(f'{width}: only verified Telegram members',page.locator('[data-activity-members]').inner_text()=='83 participantes no Telegram')
 tg=page.locator('[data-telegram-link]').first
 check(f'{width}: WhatsApp buttons absent',page.locator('[data-whatsapp-link],a[href*="chat.whatsapp.com"]').count()==0)
 check(f'{width}: Portugal Telegram invite',tg.get_attribute('href')=='https://t.me/freeislandportugal')
 check(f'{width}: no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
 if width in (390,1366):page.screenshot(path=str(OUT/f'portugal-{width}.png'),full_page=True)
 page.get_by_role('button',name='Cookies',exact=True).click();page.get_by_label('Permitir medição publicitária da Meta',exact=True).check();page.get_by_role('button',name='Guardar preferências').click();page.wait_for_timeout(100)
 check(f'{width}: advertising separate opt-in',len(state['meta'])==1)
 for path in ['/guias.html','/sobre.html','/privacidade.html','/contato.html','/ofertas.html','/politica-editorial.html','/termos.html']:
  page.goto(SITE+path,wait_until='domcontentloaded');page.locator('h1').first.wait_for();page.wait_for_timeout(60)
  check(f'{width}: {path} readable',bool(page.locator('h1').first.inner_text()) and page.locator('.brand-copy').count()==1)
  check(f'{width}: {path} fits',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  if path=='/ofertas.html':check(f'{width}: selections keep editorial title',page.locator('h1').inner_text()=='Os últimos achados, num só lugar.')
 page.goto(SITE+'/contato.html',wait_until='domcontentloaded');page.wait_for_function("document.querySelector('[data-telegram-link]').hasAttribute('href')")
 page.wait_for_timeout(100)
 with page.expect_popup() as popup:
  page.locator('[data-telegram-link]').first.click()
 popup.value.wait_for_load_state('domcontentloaded')
 check(f'{width}: Telegram opens correct group',popup.value.url=='https://t.me/freeislandportugal')
 check(f'{width}: successful redirect tracked',any(e['event']=='telegram_click' for e in state['events']))
 check(f'{width}: no script errors',not state['errors'])
 ctx.close()

def edge_cases(browser):
 ctx,page,state=setup(browser,390,configured=False)
 for path in ['/','/guias.html','/sobre.html','/privacidade.html','/ofertas.html']:
  page.goto(SITE+path,wait_until='domcontentloaded');page.wait_for_timeout(70)
  check('unconfigured '+path+' remains readable',page.locator('h1').count()==1)
  check('unconfigured '+path+' no API calls',not state['api'])
  check('unconfigured '+path+' no WhatsApp',page.locator('[data-whatsapp-link]').count()==0)
  if path in ['/','/contato.html']:check('unconfigured '+path+' Telegram works',page.locator('[data-telegram-link]').first.get_attribute('href')=='https://t.me/freeislandportugal')
 check('unconfigured no tracker',not state['meta'])
 guides=list((ROOT/'guias').glob('*.html'));check('ten original guides retained',len(guides)==10)
 for guide in guides:
  page.goto(SITE+'/guias/'+guide.name,wait_until='domcontentloaded');page.wait_for_timeout(40)
  check('guide '+guide.name+' complete',page.locator('article h2').count()>=4)
  check('guide '+guide.name+' no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
 check('unconfigured scripts clean',not state['errors']);ctx.close()
 ctx,page,state=setup(browser,430,mismatch=True);page.goto(SITE,wait_until='domcontentloaded');page.wait_for_timeout(150)
 check('mismatched identity blocks products groups and events',len(state['api'])==1 and not state['events'] and not state['meta'])
 check('mismatch keeps editorial',page.locator('a[href="guias.html"]').count()>0);ctx.close()
 ctx,page,state=setup(browser,430,gpc=True);page.goto(SITE,wait_until='domcontentloaded');page.locator('#privacy-preferences[open]').wait_for()
 check('GPC disables advertising control',page.get_by_label('Permitir medição publicitária da Meta',exact=True).is_disabled())
 page.get_by_role('button',name='Guardar preferências').click();page.wait_for_timeout(60);check('GPC no Pixel',not state['meta']);ctx.close()
 ctx,page,state=setup(browser,430);page.goto(SITE+'/r/produto-1',wait_until='domcontentloaded');page.wait_for_url('https://www.amazon.es/**')
 check('shortlink uses operation API',any('/api/public/operations/free-island-portugal/links/produto-1' in url for url in state['api']))
 check('shortlink fixture no pageview',not state['events']);ctx.close()

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  for width in [390,430,768,1024,1366,1920]:configured(browser,width)
  edge_cases(browser)
 finally:browser.close()
(OUT/'browser-portugal.json').write_text(json.dumps(CHECKS,ensure_ascii=False,indent=2))
print(json.dumps({'passed':True,'checks':len(CHECKS),'external_requests_sent':0}))
