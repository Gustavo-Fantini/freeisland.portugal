import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, validateManifest, selectWhatsApp, routingTargets, memberTotal, productLink, channelURL } from '../operation-core.js';
const config = validateConfig({ operation_id: '11111111-1111-4111-8111-111111111111', operation_slug: 'portugal-test', country: 'PT', api_url: 'https://api.example.test', base_url: 'https://pt.example.test' });
const manifest = { ...config, locale: 'pt-PT', currency: 'EUR', timezone: 'Europe/Lisbon', shortlinks_enabled: true };
const invite = n => 'https://chat.whatsapp.com/' + String(n).repeat(20);
const group = (n, members) => ({ priority: n, status: 'ok', members, capacity_limit: 990, invite_url: invite(n) });
test('Unconfigured site can build without inventing an operation UUID', () => assert.equal(validateConfig({ ...config, operation_id: '' }).configured, false));
test('Only Portugal config and public HTTPS origins are accepted', () => {
  for (const change of [{ country: 'BR' }, { api_url: 'http://api.test' }, { api_url: 'https://secret@api.test' }, { base_url: 'https://pt.test/path' }, { operation_id: 'fake-id' }, { operation_slug: '../brazil' }]) assert.throws(() => validateConfig({ ...config, ...change }));
});
test('Manifest binds exact UUID, slug, domain, country, currency, timezone and API', () => {
  assert.equal(validateManifest(config, manifest), manifest);
  for (const change of [{ operation_id: 'another' }, { operation_slug: 'brazil' }, { country: 'BR' }, { currency: 'BRL' }, { timezone: 'America/Sao_Paulo' }, { locale: 'pt-BR' }, { base_url: 'https://br.test' }, { api_url: 'https://other.test' }]) assert.throws(() => validateManifest(config, { ...manifest, ...change }));
});
test('Lowest priority group gets all available slots', () => assert.equal(selectWhatsApp([group(1, 989), group(2, 10)]), invite(1)));
test('Full groups advance through any number of groups', () => assert.equal(selectWhatsApp([group(1, 990), group(2, 990), group(3, 990), group(4, 1)]), invite(4)));
test('Leaving group 1 immediately restores its priority', () => {
  const groups = [group(1, 990), group(2, 20)]; assert.equal(selectWhatsApp(groups), invite(2));
  groups[0].members = 989; assert.equal(selectWhatsApp(groups), invite(1));
});
test('Unknown or stale earlier groups cannot be skipped', () => {
  for (const change of [{ status: 'stale' }, { members: null }, { members: -1 }, { members: '990' }, { capacity_limit: 0 }]) assert.equal(selectWhatsApp([{ ...group(1, 990), ...change }, group(2, 5)]), null);
});
test('Out of order routing and mismatched server invite fail closed', () => {
  assert.equal(selectWhatsApp([group(2, 990), group(1, 10)]), null);
  assert.equal(routingTargets({ whatsapp_groups: [group(1, 10)], whatsapp_url: invite(2) }).whatsapp, null);
});
test('Group counts are WhatsApp memberships, never stale totals', () => {
  assert.equal(memberTotal({ status: 'ok', whatsapp_groups: [group(1, 990), group(2, 2)] }), 992);
  assert.equal(memberTotal({ status: 'stale', whatsapp_groups: [group(1, 990)] }), null);
  assert.equal(memberTotal({ status: 'ok', whatsapp_groups: [] }), null);
});
test('Invite URLs disallow credentials, foreign hosts and query redirects', () => {
  for (const url of ['javascript:alert(1)', 'https://chat.whatsapp.com.evil.test/a', 'https://chat.whatsapp.com/' + 'a'.repeat(20) + '?redirect=x', 'https://foo@chat.whatsapp.com/' + 'a'.repeat(20)]) assert.equal(channelURL(url, 'whatsapp'), null);
  assert.equal(channelURL('https://t.me/portugal_test', 'telegram'), 'https://t.me/portugal_test');
});
test('Products reject cross-operation, wrong-currency and foreign shortlinks', () => {
  const product = { operation_id: config.operation_id, currency: 'EUR', short_url: config.base_url + '/r/product-1' };
  assert.equal(productLink(product, manifest, config), product.short_url);
  for (const change of [{ operation_id: 'brazil' }, { currency: 'BRL' }, { short_url: 'https://br.example.test/r/item' }, { short_url: 'javascript:alert(1)' }, { short_url: config.base_url + '/other' }]) assert.equal(productLink({ ...product, ...change }, manifest, config), null);
});

test('Short code and merchant links stay on the operation domain', () => {
  const row={short_url:'https://pt.example.test/abcd2345/amazon',currency:'EUR'};
  assert.equal(productLink(row,manifest,config),row.short_url);
  assert.equal(productLink({...row,short_url:'https://other.example/abcd2345/amazon'},manifest,config),null);
  assert.equal(productLink({...row,short_url:'https://pt.example.test/abcd2345/amazon/extra'},manifest,config),null);
});
