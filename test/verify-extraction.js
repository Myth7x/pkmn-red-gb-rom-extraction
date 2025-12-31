import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/pokemon_front_sprites.json', 'utf8'));

console.log('First 10 Pokemon sprites extracted:');
for (let i = 0; i < Math.min(10, data.sprites.length); i++) {
  const sprite = data.sprites[i];
  console.log(`#${sprite.pokedexNumber} ${sprite.name}: ${sprite.filename} (${sprite.width}x${sprite.height}) @ ${sprite.offset}`);
}
