import fs from 'fs';
import { PNG } from 'pngjs';

// Test multiple sprites to see if they look correct
const spriteFiles = [
    '001_RED.png',
    '002_BLUE.png', 
    '003_OAK.png'
];

for (const filename of spriteFiles) {
    console.log('\n' + '='.repeat(70));
    console.log(filename);
    console.log('='.repeat(70));
    
    const data = fs.readFileSync(`output/overworld-sprites/${filename}`);
    const png = PNG.sync.read(data);
    
    console.log(`Dimensions: ${png.width}x${png.height}`);
    console.log('\nAll 4 frames (Down, Up, Left, Right):');
    
    // Display all frames
    for (let y = 0; y < png.height; y++) {
        let row = '';
        for (let x = 0; x < png.width; x++) {
            const idx = (y * png.width + x) * 4;
            const r = png.data[idx];
            const g = png.data[idx + 1];
            const b = png.data[idx + 2];
            const a = png.data[idx + 3];
            
            // Determine character based on color
            let char = '?';
            if (a === 0) {
                char = ' '; // Transparent
            } else if (r === 255 && g === 255 && b === 255) {
                char = ' '; // White (should be transparent but just in case)
            } else if (r === 170 && g === 170 && b === 170) {
                char = '░'; // Light gray
            } else if (r === 85 && g === 85 && b === 85) {
                char = '▒'; // Dark gray
            } else if (r === 0 && g === 0 && b === 0) {
                char = '█'; // Black
            }
            
            row += char;
            
            // Add separator between frames
            if ((x + 1) % 16 === 0 && x < 63) {
                row += '|';
            }
        }
        console.log(row);
    }
}
