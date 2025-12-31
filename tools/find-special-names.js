import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/pokemon_names.json', 'utf8'));

console.log('Pokemon with special characters:');
data.names.forEach((entry, idx) => {
  if (entry.name.includes('FARFETCH') || entry.name.includes('MR') || entry.name.includes('SCYTHER')) {
    console.log(`Index ${idx + 1}: ${entry.name}`);
  }
});

console.log('\nAll Pokemon #83, #122, #123:');
console.log(`${data.names[82].internalId}: ${data.names[82].name}`);
console.log(`${data.names[121].internalId}: ${data.names[121].name}`);
console.log(`${data.names[122].internalId}: ${data.names[122].name}`);
