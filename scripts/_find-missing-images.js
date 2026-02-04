import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'public', 'assets', 'products');
const existing = new Set(readdirSync(dir));
const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'Product2.json'), 'utf-8'));

const missing = [];
const found = [];

for (const r of data.records) {
  const url = r.Image_URL__c;
  if (!url) continue;
  const file = url.replace('/assets/products/', '');
  if (existing.has(file)) {
    found.push(file);
  } else {
    missing.push({ name: r.Name, file, category: r.Category__c, desc: r.Description__c });
  }
}

console.log(`Existing: ${found.length}`);
console.log(`Missing: ${missing.length}`);
console.log('---');
missing.forEach(m => console.log(`${m.file} | ${m.name} | ${m.category}`));
