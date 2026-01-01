import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/map-data/maps/000_Pallet_Town.json'));

console.log(`\nPallet Town sprites: ${data.objects.sprites.count}\n`);

data.objects.sprites.data.forEach((s, i) => {
  console.log(`Sprite ${i}: pictureId=${s.pictureId}, type=${s.type}, textId=${s.textId}, pos=(${s.x},${s.y})`);
  if (s.trainerClass) {
    console.log(`  -> Trainer: class=${s.trainerClass}, number=${s.trainerNumber}`);
  }
  if (s.itemId) {
    console.log(`  -> Item: ${s.itemId}`);
  }
});
