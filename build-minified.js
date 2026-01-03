import fs from 'fs';
import path from 'path';
import { minify as terserMinify } from 'terser';
import { minify as htmlMinify } from 'html-minifier-terser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.join(__dirname, 'webclient');
const BUILD_DIR = path.join(__dirname, 'webclient-dist');

// Minification options
const jsOptions = {
    compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true,
        pure_funcs: ['console.debug']
    },
    mangle: false, // Don't mangle names for easier debugging
    format: {
        comments: false
    }
};

const htmlOptions = {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true
};

const cssOptions = {
    // CSS is already minified by html-minifier when inline
};

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Copy directory structure
function copyDirStructure(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            copyDirStructure(srcPath, destPath);
        }
    }
}

// Minify JavaScript file
async function minifyJS(filePath, outputPath) {
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const result = await terserMinify(code, jsOptions);
        
        if (result.code) {
            fs.writeFileSync(outputPath, result.code);
            const originalSize = Buffer.byteLength(code);
            const minifiedSize = Buffer.byteLength(result.code);
            const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
            console.log(`✓ ${path.relative(SOURCE_DIR, filePath)} -> ${minifiedSize} bytes (${savings}% smaller)`);
        }
    } catch (error) {
        console.error(`✗ Error minifying ${filePath}:`, error.message);
        // Copy original file if minification fails
        fs.copyFileSync(filePath, outputPath);
    }
}

// Minify HTML file
async function minifyHTML(filePath, outputPath) {
    try {
        const html = fs.readFileSync(filePath, 'utf8');
        const result = await htmlMinify(html, htmlOptions);
        
        fs.writeFileSync(outputPath, result);
        const originalSize = Buffer.byteLength(html);
        const minifiedSize = Buffer.byteLength(result);
        const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
        console.log(`✓ ${path.relative(SOURCE_DIR, filePath)} -> ${minifiedSize} bytes (${savings}% smaller)`);
    } catch (error) {
        console.error(`✗ Error minifying ${filePath}:`, error.message);
        // Copy original file if minification fails
        fs.copyFileSync(filePath, outputPath);
    }
}

// Process files
async function processFiles(srcDir, destDir) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        
        if (entry.isDirectory()) {
            // Skip certain directories
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.endsWith('-dist')) {
                continue;
            }
            
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            await processFiles(srcPath, destPath);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            
            if (ext === '.js') {
                await minifyJS(srcPath, destPath);
            } else if (ext === '.html') {
                await minifyHTML(srcPath, destPath);
            } else if (ext === '.css') {
                // CSS minification can be added here if needed
                // For now, just copy
                fs.copyFileSync(srcPath, destPath);
                console.log(`✓ Copied ${path.relative(SOURCE_DIR, srcPath)}`);
            } else {
                // Copy other files (images, JSON, etc.)
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

// Main build function
async function build() {
    console.log('🔨 Building minified version...\n');
    console.log(`Source: ${SOURCE_DIR}`);
    console.log(`Output: ${BUILD_DIR}\n`);
    
    const startTime = Date.now();
    
    // Clean build directory
    if (fs.existsSync(BUILD_DIR)) {
        fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    
    // Process all files
    await processFiles(SOURCE_DIR, BUILD_DIR);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Build complete in ${duration}s`);
    console.log(`📦 Output: ${BUILD_DIR}`);
}

// Run build
build().catch(error => {
    console.error('❌ Build failed:', error);
    process.exit(1);
});
