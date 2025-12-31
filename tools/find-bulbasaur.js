import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/pokemon_names.json', 'utf8'));

const bulbasaur = data.names.findIndex(n => n.name === 'BULBASAUR');
const ivysaur = data.names.findIndex(n => n.name === 'IVYSAUR');
const venusaur = data.names.findIndex(n => n.name === 'VENUSAUR');
const charmander = data.names.findIndex(n => n.name === 'CHARMANDER');

console.log(`BULBASAUR is at index ${bulbasaur} (internalId ${bulbasaur + 1})`);
console.log(`IVYSAUR is at index ${ivysaur} (internalId ${ivysaur + 1})`);
console.log(`VENUSAUR is at index ${venusaur} (internalId ${venusaur + 1})`);
console.log(`CHARMANDER is at index ${charmander} (internalId ${charmander + 1})`);

console.log('\nPokedex order table says:');
console.log('Pokedex #1 → Internal ID 112');
console.log('Pokedex #2 → Internal ID 115');
console.log('Pokedex #3 → Internal ID 32');
