# Pokemon Red Map Viewer - Web Client

A modular, object-oriented web application for visualizing Pokemon Red ROM map data.

## 🏗️ Architecture

### Entry Point
- **`index.html`** - Main HTML file with clean structure, no inline styles/scripts
- **`js/main.js`** - Application bootstrapper and initialization

### Module Structure

```
js/
├── main.js                    # Entry point and initialization
├── core/                      # Core application logic
│   ├── MapViewer.js          # Main application controller
│   ├── Config.js             # Configuration management
│   └── Constants.js          # Global constants and enums
├── animation/                 # Animation systems
│   └── TileAnimator.js       # Tile animation engine
├── data/                      # Data management
│   ├── MapDataManager.js     # Map data loading and caching
│   ├── TilesetManager.js     # Tileset management
│   ├── SpriteManager.js      # Sprite loading and caching
│   └── CacheManager.js       # General cache utilities
├── layout/                    # Layout systems
│   └── InteriorMapLayoutManager.js  # Interior room layout
├── movement/                  # Movement systems
│   ├── NPCMovement.js        # NPC movement engine
│   └── constants/
│       └── movementTypes.js  # Movement type definitions
├── rendering/                 # Rendering systems
│   ├── CanvasRenderer.js     # Main canvas renderer
│   └── InteriorMapRenderer.js # Interior layout renderer
├── state/                     # State management
│   ├── ViewportState.js      # Zoom, pan, viewport
│   ├── MapState.js           # Current map state
│   └── PreferencesManager.js # User preferences (localStorage)
├── ui/                        # UI components
│   └── TileAnimationDebugPanel.js  # Debug panel
└── utils/                     # Utilities
    ├── Logger.js             # Logging with emoji prefixes
    ├── ErrorHandler.js       # Error handling and display
    ├── FPSCounter.js         # Performance monitoring
    └── MapConnectionAligner.js # Map connection utilities

styles/
└── main.css                   # All application styles (extracted from HTML)
```

## 🎯 Features

### Map Viewing
- ✅ Load and display Pokemon Red maps
- ✅ Zoom (1x - 40x with smooth scaling)
- ✅ Pan (drag with mouse)
- ✅ Grid overlay
- ✅ Coordinate labels
- ✅ Pixel-perfect rendering

### Interactive Elements
- ✅ Click warps to navigate between maps
- ✅ Click NPCs to view details
- ✅ Click signs to view information
- ✅ Map boundary connections (click edges)
- ✅ Hover tooltips with tile/block info

### Visual Features
- ✅ Animated water and flower tiles
- ✅ NPC movement simulation
- ✅ Collision overlay visualization
- ✅ Interior room layout mode
- ✅ Sprite rendering with actual graphics

### Performance
- ✅ Viewport culling (only render visible tiles)
- ✅ Resource caching (maps, tilesets, sprites)
- ✅ 60 FPS rendering with requestAnimationFrame
- ✅ Memory monitoring (in browser title)
- ✅ FPS counter display

### Persistence
- ✅ Save/restore zoom level
- ✅ Save/restore current map
- ✅ Save/restore overlay preferences
- ✅ Save/restore sidebar state

## 🚀 Usage

### Starting the Server

```bash
npm run http-server
```

Then navigate to: `http://localhost:8080/webclient/`

### Keyboard Controls
- **+/=** - Zoom in
- **-/_** - Zoom out
- **0** - Reset zoom
- **Tab** - Toggle sidebar
- **Arrow Keys** - Pan view

### Mouse Controls
- **Drag** - Pan view
- **Scroll** - Zoom in/out
- **Click Warp** - Navigate to connected map
- **Click NPC** - View NPC details
- **Click Map Edge** - Navigate to connected map (if boundary exists)

## 🔧 Development

### Module Guidelines
- Each module exports a class with `MODULE_VERSION`
- Use ES6 module syntax (`import`/`export`)
- Keep modules focused on single responsibility
- Use Logger for consistent logging with emoji prefixes
- Handle errors through ErrorHandler for UI feedback

### Adding New Features
1. Create module in appropriate directory
2. Export class with `MODULE_VERSION`
3. Import in `MapViewer.js` if needed
4. Update Constants.js if adding new constants
5. Test all existing features still work

### Code Style
- Use descriptive variable names
- Add JSDoc comments for public methods
- Keep functions small and focused
- Use async/await for asynchronous operations
- Prefer composition over inheritance

## 📦 Dependencies

### External
- Bootstrap 5.3.2 (CSS framework)
- Bootstrap Icons 1.11.2
- No jQuery or other heavy dependencies

### Internal
All code is vanilla JavaScript ES6 modules - no build step required!

## 🎨 Styling

All styles are in `styles/main.css`:
- Dark theme (GitHub-inspired)
- Responsive layout
- Smooth animations
- Accessible color contrast
- Custom scrollbars

## 🔄 Recent Refactoring (Jan 2026)

### What Changed
- ✅ Moved from monolithic `map-viewer.js` (1677 lines) to modular architecture
- ✅ Extracted inline styles to `styles/main.css`
- ✅ Renamed `map-viewer.html` → `index.html`
- ✅ Created clean entry point `js/main.js`
- ✅ Organized modules by function (core, data, rendering, etc.)
- ✅ All features preserved and working

### Benefits
- 📦 **Modular**: Easy to understand and maintain
- 🔄 **Reusable**: Modules can be used in other projects
- 🧪 **Testable**: Each module can be tested independently
- 📖 **Readable**: Clear separation of concerns
- 🚀 **Scalable**: Easy to add new features

### Backup Files
Legacy files backed up as:
- `map-viewer.js.backup`
- `map-viewer.html.backup`

## 🐛 Debugging

### Enable Debug Mode
```javascript
// In browser console
window.mapViewer.config.debug = true;
Logger.debugMode = true;
```

### View Module Versions
```javascript
window.mapViewer.getModuleVersions();
```

### Access Application State
```javascript
// Main viewer instance
window.mapViewer

// Current map data
window.mapViewer.mapState.currentMap

// Viewport state
window.mapViewer.viewportState

// Cached resources
window.mapViewer.tilesetManager.tilesetImages
window.mapViewer.spriteManager.spriteImages
```

## 📝 Future Enhancements

- [ ] Map editor mode
- [ ] Export map images
- [ ] Custom tileset support
- [ ] Multiplayer map viewing
- [ ] VR/3D map visualization
- [ ] Mobile touch controls optimization

## 📄 License

Part of the Pokemon Red ROM Extraction project.

## 🤝 Contributing

When adding features:
1. Keep modules small and focused
2. Update this README
3. Test all existing features
4. Add JSDoc comments
5. Update module version numbers
