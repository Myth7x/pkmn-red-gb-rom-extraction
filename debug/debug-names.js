import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/pokemon_names.json', 'utf8'));

console.log('First 10 names in extracted order:');
for(let i=0; i<10; i++) {
  console.log(`ID ${i+1}: ${data.names[i].name}`);
}

console.log('\nKey IDs:');
console.log(`ID 112: ${data.names[111].name}`);
console.log(`ID 153: ${data.names[152].name}`);
console.log(`ID 1: ${data.names[0].name}`);
