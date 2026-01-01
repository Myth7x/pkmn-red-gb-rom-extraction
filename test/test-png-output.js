import fs from 'fs';
import { PNG } from 'pngjs';

const data = fs.readFileSync('output/overworld-sprites/001_RED.png');
const png = PNG.sync.read(data);

console.log('PNG Info:');
console.log('  Dimensions:', png.width + 'x' + png.height);
console.log('  Data length:', png.data.length, 'bytes');
console.log('  Expected:', png.width * png.height * 4, 'bytes (RGBA)');

// Sample a few pixels
console.log('\nSampling first few pixels of first frame (top-left corner):');
for (let y = 0; y < 3; y++) {
    let row = '';
    for (let x = 0; x < 8; x++) {
        const idx = (y * png.width + x) * 4;
        const r = png.data[idx];
        const g = png.data[idx + 1];
        const b = png.data[idx + 2];
        const a = png.data[idx + 3];
        
        // Determine color
        let char = '?';
        if (a === 0) char = ' ';
        else if (r === 255 && g === 255 && b === 255) char = '░';
        else if (r === 170 && g === 170 && b === 170) char = '▒';
        else if (r === 85 && g === 85 && b === 85) char = '▓';
        else if (r === 0 && g === 0 && b === 0) char = '█';
        
        row += char;
    }
    console.log(`Row ${y}: ${row}`);
}

// Check if color 0 is transparent
console.log('\nChecking transparency:');
const firstPixelIdx = 0;
console.log('First pixel RGBA:', [
    png.data[firstPixelIdx],
    png.data[firstPixelIdx + 1],
    png.data[firstPixelIdx + 2],
    png.data[firstPixelIdx + 3]
]);
