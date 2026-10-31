// Public operation contract. No database credentials belong in this repository.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function httpsURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}
export function validateConfig(config) {
  if (!config || config.country !== 'PT' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(config.operation_slug || '')) throw new Error('invalid_portugal_config');
  for (const key of ['api_url', 'base_url']) {
    const url = httpsURL(config[key]);
    if (!url || url.pathname !== '/' || url.search || url.hash || url.origin !== config[key]) throw new Error('invalid_public_origin');
  }
  if (config.operation_id && !UUID.test(config.operation_id)) throw new Error('invalid_operation_id');
  return { ...config, operation_id: config.operation_id || '', configured: Boolean(config.operation_id) };
}
export function validateManifest(config, manifest) {
  if (!config.configured || !manifest || manifest.operation_id !== config.operation_id ||
      manifest.operation_slug !== config.operation_slug || manifest.country !== 'PT' ||
      manifest.locale !== 'pt-PT' || manifest.currency !== 'EUR' || manifest.timezone !== 'Europe/Lisbon' ||
      manifest.base_url !== config.base_url || manifest.api_url !== config.api_url) throw new Error('operation_manifest_mismatch');
  return manifest;
}
export function channelURL(value, channel) {
  const url = httpsURL(value);
  if (!url || url.search || url.hash) return null;
  const valid = channel === 'whatsapp'
    ? url.hostname === 'chat.whatsapp.com' && /^\/[A-Za-z0-9_-]{16,64}\/?$/.test(url.pathname)
    : url.hostname === 't.me' && /^\/(?:[A-Za-z0-9_]{3,64}|\+[A-Za-z0-9_-]{3,128}|joinchat\/[A-Za-z0-9_-]{3,128})\/?$/.test(url.pathname);
  return valid ? url.href : null;
}
export function selectWhatsApp(groups) {
  if (!Array.isArray(groups)) return null;
  // The API returns priority order, with a stable destination-id tie break.
  // An unknown earlier count must not divert visitors into a later group.
  let lastPriority = -Infinity;
  for (const group of groups) {
    if (!group || typeof group.priority !== 'number' || !Number.isFinite(group.priority) || group.priority < lastPriority) return null;
    lastPriority = group.priority;
    if (group.status !== 'ok' || !Number.isInteger(group.members) || group.members < 0 ||
        !Number.isInteger(group.capacity_limit) || group.capacity_limit < 1 || group.capacity_limit > 1024) return null;
    if (group.members < group.capacity_limit) return channelURL(group.invite_url, 'whatsapp');
  }
  return null;
}
export function routingTargets(snapshot) {
  const whatsapp = selectWhatsApp(snapshot?.whatsapp_groups);
  const reported = channelURL(snapshot?.whatsapp_url, 'whatsapp');
  return { whatsapp: whatsapp && whatsapp === reported ? whatsapp : null, telegram: channelURL(snapshot?.telegram_url, 'telegram') };
}
export function memberTotal(snapshot) {
  const groups = snapshot?.whatsapp_groups;
  if (snapshot?.status !== 'ok' || !Array.isArray(groups) || !groups.length || groups.some(g => g.status !== 'ok' || !Number.isInteger(g.members) || g.members < 0)) return null;
  return groups.reduce((sum, group) => sum + group.members, 0);
}
export function productLink(product, manifest, config) {
  if (!product || (product.operation_id && product.operation_id !== config.operation_id) || product.currency !== 'EUR') return null;
  const url = httpsURL(product.short_url);
  if (!url) return null;
  if (manifest.shortlinks_enabled && (url.origin !== config.base_url || !(['/r/', '/go/'].some(prefix => url.pathname.startsWith(prefix)) || /^\/[a-z2-7]{8,16}\/[a-z0-9][a-z0-9-]{1,29}\/?$/.test(url.pathname)))) return null;
  return url.href;
}
export function count(value) { return new Intl.NumberFormat('pt-PT').format(Number.isInteger(value) && value >= 0 ? value : 0); }
export function relativeTime(value, now = Date.now()) {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return '';
  const minutes = Math.max(0, Math.floor((now - date) / 60000));
  if (!minutes) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(date));
}
