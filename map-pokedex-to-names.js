import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/pokemon_names.json', 'utf8'));

// Create a reverse lookup: name → index
const nameToIndex = {};
data.names.forEach((entry, idx) => {
  nameToIndex[entry.name] = idx + 1; // 1-based index
});

// First 20 Pokedex Pokemon in order
const pokedexOrder = [
  'BULBASAUR', 'IVYSAUR', 'VENUSAUR', 'CHARMANDER', 'CHARMELEON',
  'CHARIZARD', 'SQUIRTLE', 'WARTORTLE', 'BLASTOISE', 'CATERPIE',
  'METAPOD', 'BUTTERFREE', 'WEEDLE', 'KAKUNA', 'BEEDRILL',
  'PIDGEY', 'PIDGEOTTO', 'PIDGEOT', 'RATTATA', 'RATICATE'
];

console.log('Pokedex # → Name → Index in names array:');
pokedexOrder.forEach((name, i) => {
  const idx = nameToIndex[name];
  console.log(`Pokedex #${i+1}: ${name} → Index ${idx}`);
});
