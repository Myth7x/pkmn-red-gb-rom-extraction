import fs from 'fs';
import path from 'path';

const mapsDir = 'output/map-data/maps';
const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));

const errors = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(mapsDir, file)));
  const mapName = file.replace('.json', '');
  
  if (data.objects?.sprites?.data) {
    for (let i = 0; i < data.objects.sprites.data.length; i++) {
      const sprite = data.objects.sprites.data[i];
      if (sprite.scriptText?.error) {
        errors.push({
          map: mapName,
          type: 'sprite',
          index: i,
          textId: sprite.textId,
          pictureId: sprite.pictureId,
          error: sprite.scriptText.error
        });
      }
    }
  }
  
  if (data.objects?.signs?.data) {
    for (let i = 0; i < data.objects.signs.data.length; i++) {
      const sign = data.objects.signs.data[i];
      if (sign.scriptText?.error) {
        errors.push({
          map: mapName,
          type: 'sign',
          index: i,
          textId: sign.textId,
          error: sign.scriptText.error
        });
      }
    }
  }
}

console.log(`\nFound ${errors.length} text extraction errors:\n`);

// Group by error type
const errorsByType = {};
for (const err of errors) {
  if (!errorsByType[err.error]) {
    errorsByType[err.error] = [];
  }
  errorsByType[err.error].push(err);
}

for (const [errorMsg, items] of Object.entries(errorsByType)) {
  console.log(`\n${errorMsg} (${items.length} occurrences):`);
  console.log(items.slice(0, 5).map(e => `  ${e.map} - ${e.type} #${e.index} (textId=${e.textId})`).join('\n'));
  if (items.length > 5) {
    console.log(`  ... and ${items.length - 5} more`);
  }
}
