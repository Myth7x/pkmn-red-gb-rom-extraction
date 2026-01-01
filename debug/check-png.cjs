const fs = require('fs');
const {PNG} = require('pngjs');

const data = fs.readFileSync('output/overworld-sprites/001_RED.png');
const png = PNG.sync.read(data);

console.log('PNG size:', png.width, 'x', png.height);
console.log('\nFirst frame (pixels 0-15 wide):');

for(let y = 0; y < 16; y++) {
    let row = '';
    for(let x = 0; x < 16; x++) {
        const i = (y * png.width + x) * 4;
        const r = png.data[i];
        const g = png.data[i + 1];
        const b = png.data[i + 2];
        const a = png.data[i + 3];
        
        let c = '?';
        if (a === 0) c = ' ';
        else if (r === 255 && g === 255 && b === 255) c = '░';
        else if (r === 170 && g === 170 && b === 170) c = '▒';
        else if (r === 85 && g === 85 && b === 85) c = '▓';
        else if (r === 0 && g === 0 && b === 0) c = '█';
        
        row += c;
    }
    console.log(row);
}

console.log('\nSecond frame (pixels 16-31 wide):');
for(let y = 0; y < 16; y++) {
    let row = '';
    for(let x = 16; x < 32; x++) {
        const i = (y * png.width + x) * 4;
        const r = png.data[i];
        const a = png.data[i + 3];
        
        let c = '?';
        if (a === 0) c = ' ';
        else if (r === 255) c = '░';
        else if (r === 170) c = '▒';
        else if (r === 85) c = '▓';
        else if (r === 0) c = '█';
        
        row += c;
    }
    console.log(row);
}
