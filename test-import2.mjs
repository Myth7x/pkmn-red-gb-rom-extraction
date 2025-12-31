try {
    const module = await import('./src/spriteExtractor.js');
    console.log('Module loaded successfully');
    console.log('Keys:', Object.keys(module));
} catch (error) {
    console.error('Error loading module:');
    console.error(error);
    console.error(error.stack);
}
