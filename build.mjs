import { mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateConfig } from './operation-core.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const defaults = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
const config = validateConfig(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, process.env['FI_' + key.toUpperCase()]?.trim() ?? value])));
const dist = path.join(root, 'dist');
if (path.dirname(dist) !== root || path.basename(dist) !== 'dist') throw new Error('invalid_build_directory');
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, '.well-known'), { recursive: true });
const pages = [];
async function copyDirectory(relative) {
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      await mkdir(path.join(dist, name), { recursive: true });
      await copyDirectory(name);
    } else if (entry.isFile() && /\.(?:html|css|js|png|svg|webp)$/.test(entry.name)) await copy(name);
  }
}
async function copy(name) {
  if (name.endsWith('.html')) {
    let html = await readFile(path.join(root, name), 'utf8');
    html = html.replaceAll(defaults.base_url, config.base_url);
    await writeFile(path.join(dist, name), html);
    if (name !== '404.html' && name !== 'r/index.html') pages.push(name === 'index.html' ? '/' : '/' + name);
  } else await copyFile(path.join(root, name), path.join(dist, name));
}
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && /\.(?:html|css|js)$/.test(entry.name)) await copy(entry.name);
}
for (const directory of ['assets', 'guias', 'r']) { await mkdir(path.join(dist, directory), { recursive: true }); await copyDirectory(directory); }
await writeFile(path.join(dist, 'config.json'), JSON.stringify(config, null, 2) + '\n');
await writeFile(path.join(dist, '.well-known/freeisland.json'), JSON.stringify({ version: 1, ...config }, null, 2) + '\n');
await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /r/\nDisallow: /go/\nSitemap: ${config.base_url}/sitemap.xml\n`);
const escaped = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
await writeFile(path.join(dist, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.sort().map(page => `  <url><loc>${escaped(config.base_url + page)}</loc></url>`).join('\n') + '\n</urlset>\n');
console.log(JSON.stringify({ built: true, pages: pages.length, country: config.country, operation_bound: config.configured, privileged_keys: false }));
