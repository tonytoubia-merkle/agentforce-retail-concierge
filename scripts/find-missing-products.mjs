import fs from 'fs';
const products = JSON.parse(fs.readFileSync('./scripts/all_products.json', 'utf8')).records;
const mockFile = fs.readFileSync('./src/mocks/products.ts', 'utf8');
const sfIds = new Set([...mockFile.matchAll(/salesforceId:\s*'([^']+)'/g)].map(m => m[1]));
console.log('Total SF:', products.length, 'Mapped:', sfIds.size);
const missing = products.filter(p => sfIds.has(p.Id) === false);
console.log('Missing:', missing.length);
missing.forEach(p => console.log([p.Id, p.Name, p.Category__c, p.Brand__c, p.Price__c, p.Image_URL__c || 'NULL'].join(' | ')));
