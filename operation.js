import { validateConfig, validateManifest, routingTargets, productLink, httpsURL, count, relativeTime } from './operation-core.js';

const all = selector => [...document.querySelectorAll(selector)];
const create = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const PRIVACY_KEY = 'fi:portugal:privacy:v1';
const SESSION_KEY = 'fi:portugal:session:v1';
const TELEGRAM_GROUP = 'https://t.me/freeislandportugal';
let config, manifest, pageNonce, sessionId = '', routeFlight, refreshTimer;
let preferences = { analytics: false, advertising: false };
let metaLoaded = false, metaPageTracked = false;

function setStatus(message) {
  all('[data-channel-status]').forEach(node => { node.textContent = message; node.hidden = !message; });
}
function setChannel(channel, url) {
  all(`[data-${channel}-link]`).forEach(node => {
    node.setAttribute('aria-disabled', String(!url));
    node.setAttribute('role', 'link');
    node.tabIndex = 0;
    if (url) { node.href = url; node.rel = 'noopener noreferrer'; }
    else node.removeAttribute('href');
  });
}
function renderMembers(snapshot) {
  const channel = snapshot?.telegram_channels?.find(item => item.url === (routingTargets(snapshot).telegram || TELEGRAM_GROUP));
  const total = Number.isInteger(channel?.members) && channel.members >= 0 ? channel.members : null;
  all('[data-activity-members]').forEach(node => {
    node.hidden = total === null;
    node.textContent = total === null ? '' : `${count(total)} participantes no Telegram`;
  });
}
async function api(path, options = {}) {
  const response = await fetch(`${config.api_url}/api/public/operations/${encodeURIComponent(config.operation_slug)}/${path}`, {
    cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(12000), ...options
  });
  if (!response.ok) throw new Error('public_api_unavailable');
  return response.json();
}
function unavailable(message = '') {
  setChannel('whatsapp', null); setChannel('telegram', TELEGRAM_GROUP); renderMembers(null); setStatus(message);
}
async function refreshRoutes(fresh = true) {
  // A click never reuses an earlier cached read in place of a live check.
  if (routeFlight) {
    const previous = routeFlight;
    if (!fresh || previous.fresh) return previous.promise;
    await previous.promise.catch(() => {});
  }
  const promise = (async () => {
    const snapshot = await api(`routing${fresh ? '?fresh=true' : ''}`);
    const targets = routingTargets(snapshot);
    setChannel('telegram', targets.telegram || TELEGRAM_GROUP); renderMembers(snapshot); setStatus('');
    return { whatsapp: null, telegram: targets.telegram || TELEGRAM_GROUP };
  })();
  const flight = { promise, fresh }; routeFlight = flight;
  try { return await promise; }
  catch (error) { unavailable(); throw error; }
  finally { if (routeFlight === flight) routeFlight = null; }
}
function analyticsSession() {
  if (!preferences.analytics) return null;
  if (!sessionId) {
    try { sessionId = sessionStorage.getItem(SESSION_KEY) || crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, sessionId); }
    catch { sessionId = crypto.randomUUID(); }
  }
  return sessionId;
}
function track(event, aggregate = true) {
  if (!manifest || !pageNonce) return;
  const params = new URLSearchParams(location.search);
  void api('events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({
      event, page_nonce: pageNonce, consent: preferences.analytics, aggregate, session_id: analyticsSession(),
      source: preferences.analytics ? (params.get('utm_source') || '').slice(0, 100) : '',
      medium: preferences.analytics ? (params.get('utm_medium') || '').slice(0, 100) : '',
      campaign: preferences.analytics ? (params.get('utm_campaign') || '').slice(0, 160) : '', page: location.pathname
    })
  }).catch(() => {});
  if (preferences.advertising && window.fbq) {
    if (event === 'page_view') {
      if (!metaPageTracked) {
        window.fbq('track', 'PageView');
        window.fbq('track', 'ViewContent', { content_name: manifest.brand?.name || 'Free Island Portugal' });
        metaPageTracked = true;
      }
    } else {
      window.fbq('trackCustom', event === 'whatsapp_click' ? 'WhatsAppClick' : 'TelegramClick', { operation_id: config.operation_id });
      window.fbq('track', 'Lead', { lead_type: 'group_link_click', channel: event === 'whatsapp_click' ? 'whatsapp' : 'telegram' });
    }
  }
}
function startMeta() {
  const id = manifest?.brand?.meta_pixel_id;
  if (!preferences.advertising || !/^\d{8,25}$/.test(id || '')) return;
  if (metaLoaded) { window.fbq?.('consent', 'grant'); return; }
  metaLoaded = true;
  const fbq = window.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
  window._fbq = fbq; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
  const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.append(script); fbq('consent', 'grant'); fbq('init', id);
}
function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRIVACY_KEY));
    preferences = { analytics: saved?.analytics === true, advertising: saved?.advertising === true && navigator.globalPrivacyControl !== true };
  } catch {}
}
function openPreferences() {
  if (document.getElementById('privacy-preferences')) return;
  const dialog = create('dialog', 'privacy-dialog'); dialog.id = 'privacy-preferences';
  dialog.setAttribute('aria-labelledby', 'privacy-title');
  const form = create('form'); form.method = 'dialog';
  const title = create('h2', '', 'As tuas preferências'); title.id = 'privacy-title';
  form.append(title, create('p', '', 'Contamos acessos de forma agregada, sem identificadores de visitante. Os detalhes de navegação e a medição publicitária são opcionais.'));
  function choice(name, label, checked) {
    const wrap = create('label', 'privacy-choice'), input = create('input');
    input.type = 'checkbox'; input.name = name; input.checked = checked;
    wrap.append(input, create('span', '', label)); form.append(wrap); return input;
  }
  const analytics = choice('analytics', 'Permitir detalhes de navegação', preferences.analytics);
  const advertising = choice('advertising', 'Permitir medição publicitária da Meta', preferences.advertising);
  const pixelAvailable = /^\d{8,25}$/.test(manifest?.brand?.meta_pixel_id || '');
  advertising.parentElement.hidden = !pixelAvailable;
  advertising.disabled = !pixelAvailable || navigator.globalPrivacyControl === true;
  if (advertising.disabled) advertising.checked = false;
  if (pixelAvailable && navigator.globalPrivacyControl === true) form.append(create('p', '', 'O sinal de privacidade do navegador mantém a publicidade desativada.'));
  const actions = create('div', 'privacy-actions');
  const necessary = create('button', '', 'Apenas necessários'); necessary.type = 'button';
  const save = create('button', 'privacy-save', 'Guardar preferências'); save.type = 'submit';
  actions.append(necessary, save); form.append(actions);
  const privacy = create('a', '', 'Política de privacidade'); privacy.href = '/privacidade.html'; form.append(privacy);
  dialog.append(form); document.body.append(dialog);
  const apply = (detailed, ads) => {
    preferences = { analytics: detailed, advertising: ads && pixelAvailable && navigator.globalPrivacyControl !== true };
    try {
      localStorage.setItem(PRIVACY_KEY, JSON.stringify(preferences));
      if (!detailed) sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    if (!detailed) sessionId = '';
    if (!preferences.advertising) window.fbq?.('consent', 'revoke');
    startMeta(); track('page_view', false); dialog.close();
  };
  necessary.onclick = () => apply(false, false);
  form.onsubmit = event => { event.preventDefault(); apply(analytics.checked, advertising.checked); };
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}
function applyBrand() {
  const brand = manifest.brand || {};
  if (brand.name) all('.brand-copy strong, .footer-brand strong').forEach(node => { node.textContent = brand.name; });
  if (document.body.dataset.page === 'landing') {
    if (brand.headline) document.querySelector('h1').textContent = brand.headline;
    if (brand.description) document.querySelector('.hero-copy').textContent = brand.description;
  }
  const logo = httpsURL(brand.logo_url);
  if (logo) all('.brand-mark img').forEach(node => { node.src = logo.href; });
  if (/^#[0-9a-f]{6}$/i.test(brand.primary_color || '')) document.body.style.setProperty('--green', brand.primary_color);
  if (/^#[0-9a-f]{6}$/i.test(brand.background_color || '')) document.body.style.backgroundColor = brand.background_color;
  for (const [channel, key] of [['whatsapp', 'whatsapp_label'], ['telegram', 'telegram_label']]) {
    if (brand[key]) all(`[data-${channel}-link] > span`).forEach(node => { node.textContent = brand[key]; });
  }
  if (brand.disclosure) {
    const footer = document.querySelector('.footer-brand');
    if (footer) footer.append(create('p', '', brand.disclosure));
  }
  const footer = document.querySelector('.footer-actions');
  for (const link of brand.social_links || []) {
    const url = httpsURL(link.url); if (!url || !footer) continue;
    const node = create('a', 'footer-link', link.label); node.href = url.href; node.rel = 'noopener noreferrer'; footer.append(node);
  }
  if (brand.guide_links?.length && document.body.dataset.page === 'guides') {
    const section = create('section', 'info-card'); section.append(create('h2', '', 'Mais guias da comunidade'));
    for (const link of brand.guide_links) {
      const url = httpsURL(link.url); if (!url) continue;
      const node = create('a', 'small-link', link.label); node.href = url.href; section.append(node);
    }
    document.querySelector('main')?.append(section);
  }
}
function showNoActivity(message) {
  all('[data-promotions-section]').forEach(section => {
    const list = section.querySelector('[data-promotions-list]'); if (list) { list.replaceChildren(); list.hidden = true; }
    const fallback = section.querySelector('[data-promotions-fallback]'); if (fallback) {
      fallback.hidden = false;
      const text = fallback.querySelector('p'); if (text) text.textContent = message;
    }
    const countTarget = section.querySelector('[data-activity-count]'); if (countTarget) countTarget.textContent = 'Publicações da comunidade';
    const latest = section.querySelector('[data-activity-latest]'); if (latest) latest.hidden = true;
  });
}
async function showActivity() {
  if (!document.querySelector('[data-promotions-section]')) return;
  if (manifest.promotions_enabled === false) { showNoActivity('As publicações recentes não estão disponíveis nesta página.'); return; }
  try {
    const snapshot = await api('activity');
    const products = (Array.isArray(snapshot.promotions) ? snapshot.promotions : []).filter(product => productLink(product, manifest, config)).slice(0, 12);
    showNoActivity('Ainda não há publicações disponíveis desta comunidade. Podes explorar os guias de compra.');
    all('[data-promotions-section]').forEach(section => {
      const list = section.querySelector('[data-promotions-list]'); if (!list) return;
      const counter = section.querySelector('[data-activity-count]');
      if (counter) counter.textContent = `${count(snapshot.today_count)} publicações hoje · hora de Lisboa`;
      for (const product of products) {
        const card = create('article', 'promotion-card'), media = create('div', 'promotion-media');
        const image = create('img'); image.src = httpsURL(product.image_public_url)?.href || '/assets/logo_sem_fundo.png';
        image.alt = product.product_title || 'Produto da comunidade'; image.loading = 'lazy'; image.decoding = 'async';
        image.onerror = () => { image.onerror = null; image.src = '/assets/logo_sem_fundo.png'; }; media.append(image);
        const body = create('div', 'promotion-body');
        body.append(create('span', 'promotion-store', product.store || 'Comunidade'), create('h3', 'promotion-title', product.product_title || 'Publicação recente'));
        const age = relativeTime(product.published_at); if (age) body.append(create('p', 'promotion-time', `Publicado ${age}`));
        // This is a publication feed, as on BR. No stale Amazon price or stock claims.
        body.append(create('p', 'promotion-disclaimer', 'Publicidade · Confirma o preço, os portes e a entrega em Portugal na loja.'));
        const link = create('a', 'promotion-cta', 'Consultar na loja'); link.href = productLink(product, manifest, config);
        link.rel = 'sponsored noopener'; link.referrerPolicy = 'strict-origin-when-cross-origin'; body.append(link);
        card.append(media, body); list.append(card);
      }
      if (products.length) {
        list.hidden = false; section.querySelector('[data-promotions-fallback]').hidden = true;
        const latest = section.querySelector('[data-activity-latest]');
        const age = relativeTime(products[0].published_at); if (latest && age) { latest.textContent = `Última publicação ${age}`; latest.hidden = false; }
      }
    });
  } catch { showNoActivity('Não foi possível consultar as publicações agora. Os guias continuam disponíveis.'); }
}
function wireChannels() {
  for (const channel of ['whatsapp', 'telegram']) all(`[data-${channel}-link]`).forEach(link => {
    let opening = false;
    link.addEventListener('click', async event => {
      // The administrator supplied this public Portugal invite explicitly.
      // Joining Telegram remains available before operation setup or during an API outage.
      if (channel === 'telegram') { if (manifest) track('telegram_click'); return; }
      event.preventDefault();
      if (!manifest || opening) return;
      opening = true; link.setAttribute('aria-busy', 'true');
      try {
        const targets = await refreshRoutes(true), url = targets[channel];
        if (url) { track(channel === 'whatsapp' ? 'whatsapp_click' : 'telegram_click'); location.assign(url); }
      } catch {} finally { opening = false; link.removeAttribute('aria-busy'); }
    });
    if (channel === 'telegram') return;
    link.addEventListener('keydown', event => { if (event.key === 'Enter' && !link.hasAttribute('href')) { event.preventDefault(); link.click(); } });
    // New tabs and context menus must not reuse an invite that has become full.
    link.addEventListener('auxclick', event => { if (event.button === 1) { event.preventDefault(); link.click(); } });
    link.addEventListener('contextmenu', () => { void refreshRoutes(true).catch(() => {}); });
  });
}
async function redirectProduct() {
  const match = location.pathname.match(/^\/(?:r|go)\/([a-z0-9][a-z0-9-]{1,64})\/?$/);
  if (!match) return false;
  const title = document.querySelector('[data-title]'), message = document.querySelector('[data-message]');
  if (title) title.textContent = 'A confirmar o link';
  try {
    const result = await api('links/' + match[1]), url = httpsURL(result.url);
    if (!url || url.origin === config.base_url) throw new Error('invalid_redirect');
    // Resolution is server-side, scoped to this operation and its current affiliate account.
    location.replace(url.href);
  } catch {
    if (title) title.textContent = 'Este link não está disponível';
    if (message) message.textContent = 'O produto pode ter expirado ou deixado de estar disponível. Podes voltar à página inicial.';
  }
  return true;
}
async function main() {
  all('[data-current-year]').forEach(node => { node.textContent = new Intl.DateTimeFormat('pt-PT', { year: 'numeric', timeZone: 'Europe/Lisbon' }).format(new Date()); });
  setChannel('whatsapp', null); setChannel('telegram', TELEGRAM_GROUP); wireChannels();
  all('[data-consent-settings]').forEach(button => button.addEventListener('click', openPreferences));
  readPreferences();
  try {
    const response = await fetch('/config.json', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('missing_config');
    config = validateConfig(await response.json());
    if (location.origin !== config.base_url) throw new Error('landing_origin_mismatch');
    if (!config.configured) {
      unavailable();
      showNoActivity('Ainda não há publicações disponíveis da comunidade portuguesa. Os guias de compra já estão disponíveis.');
      return;
    }
    manifest = validateManifest(config, await api('manifest'));
    if (await redirectProduct()) return;
    applyBrand(); pageNonce = crypto.randomUUID(); startMeta(); track('page_view');
    let hasChoice = false; try { hasChoice = Boolean(localStorage.getItem(PRIVACY_KEY)); } catch {}
    if (!hasChoice) openPreferences();
    await Promise.allSettled([refreshRoutes(true), showActivity()]);
    refreshTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refreshRoutes(false).catch(() => {}); void showActivity();
    }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { void refreshRoutes(true).catch(() => {}); void showActivity(); }
    });
  } catch {
    unavailable(); showNoActivity('As publicações estão temporariamente indisponíveis. Os guias continuam acessíveis.');
    const title = document.querySelector('[data-title]'); if (title) title.textContent = 'Este link não está disponível';
  }
}
window.addEventListener('pagehide', () => clearInterval(refreshTimer));
void main();
