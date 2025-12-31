import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/pokemon_front_sprites.json', 'utf8'));

// Find Rhydon sprite
const rhydon = data.sprites.find(s => s.name === 'RHYDON');
console.log('RHYDON sprite info:');
console.log(JSON.stringify(rhydon, null, 2));

// Find sprite at Pokedex #112 (which should be Rhydon's Pokedex number)
const pokedex112 = data.sprites.find(s => s.pokedexNumber === 112);
console.log('\nPokedex #112 sprite info:');
console.log(JSON.stringify(pokedex112, null, 2));

// Check first sprite in the list
console.log('\nFirst sprite in extraction:');
console.log(JSON.stringify(data.sprites[0], null, 2));
