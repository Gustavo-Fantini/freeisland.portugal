import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const pages = []; let references = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith('.html')) pages.push(file);
  }
}
await walk(root);
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  if (!html.includes('lang="pt-PT"') || !/<h1(?:\s|>)/.test(html)) throw Error('Invalid page structure: ' + file);
  if (/amazon\.com\.br|freeislandt0b|freeislandpromos|free-island-principal|America\/Sao_Paulo|R\$|PIX/.test(html)) throw Error('Legacy Brazil value: ' + file);
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const ref = match[1].split(/[?#]/)[0];
    if (/^[a-z]+:|^\/\//i.test(ref)) continue;
    const page = path.relative(root, file).split(path.sep).join('/');
    const url = new URL(ref, 'https://build.example.test/' + page);
    const target = path.join(root, decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Invalid asset path: ' + ref);
    try { await stat(target); } catch { throw Error('Missing local resource ' + ref + ' in ' + file); }
    references++;
  }
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
}
const config = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, '.well-known/freeisland.json'), 'utf8'));
if (manifest.operation_id !== config.operation_id || manifest.operation_slug !== config.operation_slug || manifest.api_url !== config.api_url) throw Error('Build identity mismatch');
if (Object.keys(config).some(key => !['operation_id', 'operation_slug', 'country', 'api_url', 'base_url', 'configured'].includes(key))) throw Error('Unexpected public configuration field');
console.log(JSON.stringify({ build_audit: true, pages: pages.length, local_references_checked: references, legacy_brazil_values: 0 }));
