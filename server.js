import express from 'express';
import compression from 'compression';
import { minify as terserMinify } from 'terser';
import { minify as htmlMinify } from 'html-minifier-terser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const PROJECT_ROOT = __dirname;

// Cache for minified content (in-memory cache for development)
const minifyCache = new Map();

// Minification options
const jsOptions = {
    compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
        pure_funcs: ['console.debug']
    },
    mangle: false, // Don't mangle for easier debugging
    format: {
        comments: false,
        beautify: false
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
    minifyJS: false // Don't minify inline JS (we handle .js files separately)
};

// Middleware to minify JavaScript files on-the-fly
async function minifyJSMiddleware(req, res, next) {
    if (!req.path.endsWith('.js')) {
        return next();
    }

    const filePath = path.join(PROJECT_ROOT, req.path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return next();
    }

    try {
        const stats = fs.statSync(filePath);
        const cacheKey = `${filePath}:${stats.mtimeMs}`;
        
        // Check cache
        if (minifyCache.has(cacheKey)) {
            const cached = minifyCache.get(cacheKey);
            res.type('application/javascript');
            res.setHeader('X-Minified', 'cached');
            return res.send(cached);
        }

        // Read and minify
        const code = fs.readFileSync(filePath, 'utf8');
        const result = await terserMinify(code, jsOptions);
        
        if (result.code) {
            // Store in cache
            minifyCache.set(cacheKey, result.code);
            
            // Clean old cache entries (keep last 100)
            if (minifyCache.size > 100) {
                const firstKey = minifyCache.keys().next().value;
                minifyCache.delete(firstKey);
            }
            
            const originalSize = Buffer.byteLength(code);
            const minifiedSize = Buffer.byteLength(result.code);
            const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
            
            console.log(`✓ Minified ${req.path} -> ${minifiedSize} bytes (${savings}% smaller)`);
            
            res.type('application/javascript');
            res.setHeader('X-Minified', 'true');
            res.setHeader('X-Original-Size', originalSize);
            res.setHeader('X-Minified-Size', minifiedSize);
            return res.send(result.code);
        }
    } catch (error) {
        console.error(`✗ Error minifying ${req.path}:`, error.message);
    }
    
    // Fallback to original file
    next();
}

// Middleware to minify HTML files on-the-fly
async function minifyHTMLMiddleware(req, res, next) {
    if (!req.path.endsWith('.html') && req.path !== '/') {
        return next();
    }

    let filePath = path.join(PROJECT_ROOT, req.path);
    
    // Handle directory index
    if (req.path === '/' || req.path.endsWith('/')) {
        filePath = path.join(filePath, 'index.html');
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return next();
    }

    try {
        const stats = fs.statSync(filePath);
        const cacheKey = `${filePath}:${stats.mtimeMs}`;
        
        // Check cache
        if (minifyCache.has(cacheKey)) {
            const cached = minifyCache.get(cacheKey);
            res.type('text/html');
            res.setHeader('X-Minified', 'cached');
            return res.send(cached);
        }

        // Read and minify
        const html = fs.readFileSync(filePath, 'utf8');
        const result = await htmlMinify(html, htmlOptions);
        
        // Store in cache
        minifyCache.set(cacheKey, result);
        
        // Clean old cache entries
        if (minifyCache.size > 100) {
            const firstKey = minifyCache.keys().next().value;
            minifyCache.delete(firstKey);
        }
        
        const originalSize = Buffer.byteLength(html);
        const minifiedSize = Buffer.byteLength(result);
        const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
        
        console.log(`✓ Minified ${req.path} -> ${minifiedSize} bytes (${savings}% smaller)`);
        
        res.type('text/html');
        res.setHeader('X-Minified', 'true');
        res.setHeader('X-Original-Size', originalSize);
        res.setHeader('X-Minified-Size', minifiedSize);
        return res.send(result);
    } catch (error) {
        console.error(`✗ Error minifying ${req.path}:`, error.message);
    }
    
    // Fallback to original file
    next();
}

// Enable gzip compression
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    level: 6
}));

// Add minification middlewares (only if MINIFY=true)
const shouldMinify = process.env.MINIFY === 'true';

if (shouldMinify) {
    console.log('🔧 Minification enabled');
    app.use(minifyJSMiddleware);
    app.use(minifyHTMLMiddleware);
} else {
    console.log('📝 Development mode - serving original files');
}

// CORS headers for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files
app.use(express.static(PROJECT_ROOT, {
    etag: true,
    lastModified: true,
    maxAge: 0 // No caching in development
}));

// Cache status endpoint
app.get('/_cache/status', (req, res) => {
    res.json({
        cacheSize: minifyCache.size,
        cacheKeys: Array.from(minifyCache.keys()).map(key => {
            const [filepath, mtime] = key.split(':');
            return { filepath: path.relative(PROJECT_ROOT, filepath), mtime };
        })
    });
});

// Clear cache endpoint
app.post('/_cache/clear', (req, res) => {
    minifyCache.clear();
    console.log('🗑️  Cache cleared');
    res.json({ message: 'Cache cleared', size: 0 });
});

// Start server
app.listen(PORT, () => {
    console.log('\n🚀 Development Server Started\n');
    console.log(`   Local:   http://localhost:${PORT}/webclient/`);
    console.log(`   Map:     http://localhost:${PORT}/webclient/index.html`);
    console.log(`   Minify:  ${shouldMinify ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Gzip:    ENABLED\n`);
    console.log('   Endpoints:');
    console.log(`   - GET  /_cache/status  (View cache status)`);
    console.log(`   - POST /_cache/clear   (Clear minify cache)`);
    console.log('\n   Press Ctrl+C to stop\n');
    
    if (!shouldMinify) {
        console.log('   💡 Tip: Set MINIFY=true to enable on-the-fly minification');
        console.log('       Example: MINIFY=true node server.js\n');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down gracefully...');
    minifyCache.clear();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    minifyCache.clear();
    process.exit(0);
});
