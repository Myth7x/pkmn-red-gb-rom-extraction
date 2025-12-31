import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/pokemon_front_sprites.json', 'utf8'));

console.log('First 5 Pokemon sprites:');
for (let i = 0; i < 5; i++) {
  const sprite = data.sprites[i];
  console.log(`\n#${sprite.pokedexNumber} ${sprite.name}:`);
  console.log(`  Size: ${sprite.width}x${sprite.height}`);
  console.log(`  Offset: ${sprite.offset}`);
  console.log(`  Index: ${sprite.indexNumber || sprite.nameIndex}`);
}
