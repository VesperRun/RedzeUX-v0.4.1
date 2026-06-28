#!/usr/bin/env node
/**
 * White-label helper for Agency kit (Application layer).
 * Usage: node scripts/white-label.mjs --name "Acme UX Studio" --support hello@acme.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function parseArgs(argv) {
  const out = { name: '', support: '' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--name' && argv[i + 1]) {
      out.name = argv[++i];
    } else if (argv[i] === '--support' && argv[i + 1]) {
      out.support = argv[++i];
    }
  }
  return out;
}

function updateManifest(name) {
  const file = path.join(root, 'manifest.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.name = `${name} — UX Snapshots`;
  json.description = `Local-first competitive UX snapshots by ${name}. Advisory, visible UI only.`;
  json.action.default_title = name;
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log('Updated manifest.json');
}

function updateTermsSupport(support, name) {
  const file = path.join(root, 'terms-of-service.md');
  if (!fs.existsSync(file) || !support) return;
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/support@redzeux\.local[^\n]*/, `${support} (${name})`);
  fs.writeFileSync(file, text);
  console.log('Updated terms-of-service.md contact');
}

const { name, support } = parseArgs(process.argv);
if (!name) {
  console.error('Usage: node scripts/white-label.mjs --name "Studio Name" [--support email@studio.com]');
  process.exit(1);
}

updateManifest(name);
updateTermsSupport(support, name);
console.log(`White-label applied for: ${name}`);
console.log('Next: replace icons/ in icons/, set default brand in buyer Options, issue RZX-AGENCY-* key.');
