# Setup Guide - Torchlight Tracker Electron

## Quick Start

### 1. Install Dependencies

```bash
cd electron
npm install
```

**Important**: If you're on Windows, you'll also need to install the Windows process detection module:

```bash
npm install node-process-windows
```

### 2. Run in Development Mode

```bash
npm run dev
```

This will:
- Start the Vite dev server for hot reloading
- Launch Electron with the app
- Open DevTools for debugging

### 3. Build for Production

```bash
# Build the React app and Electron package
npm run build:electron
```

The installer will be created in the `release/` directory.

## First Time Setup

### Required Data Files

The following files should be in the `electron/` directory:
- ✅ `en_id_table.json` - English item translations
- ✅ `comprehensive_item_mapping.json` - Complete item database

These files are already copied from the parent directory.

### Game Requirements

1. **Install Torchlight: Infinite**
   - The game must be running for the tracker to work

2. **Enable Game Logging**
   - Logging should be enabled by default
   - The tracker looks for logs at: `[GamePath]/../../../TorchLight/Saved/Logs/UE_game.log`

## Usage

### Initializing the Tracker

1. Start the application
2. Launch Torchlight: Infinite
3. Click "Initialize Tracker" button
4. Open your inventory in-game
5. Wait for the tracker to scan your items (minimum 20 items required)

### Tracking Drops

Once initialized:
- Drops are automatically detected as you play
- Items are categorized by type
- Prices are updated when you search the market in-game
- Stats update in real-time

### Exporting Data

- **Export to Excel**: Creates a detailed spreadsheet of all drops
- **Export Debug Log**: Saves the application log for troubleshooting

### Settings

- **Opacity**: Adjust window transparency (10-100%)
- **Tax Mode**: Enable to calculate prices with 12.5% market tax
- **User ID**: Optional identifier for tracking

## Development Tips

### Hot Reloading

When running `npm run dev`:
- UI changes auto-reload (Vite HMR)
- Backend changes require restart

### Debugging

- **Renderer Process**: Use DevTools (opens automatically in dev mode)
- **Main Process**: Check console output or `tracker.log` file
- **IPC Communication**: Use DevTools Console to inspect `window.electronAPI`

### Building

```bash
# Just build the React app
npm run build

# Build everything and create installer
npm run build:electron
```

### Type Checking

```bash
npm run type-check
```

## Project Structure

```
electron/
├── electron/              # Main process (Node.js)
│   ├── main.ts           # Entry point
│   ├── preload.ts        # IPC bridge
│   └── backend/          # Core logic
├── src/                  # Renderer process (React)
│   ├── App.tsx           # Main component
│   ├── components/       # UI components
│   └── main.tsx          # React entry
├── en_id_table.json      # Item translations
├── comprehensive_item_mapping.json  # Item database
└── package.json          # Dependencies
```

## Common Issues

### "Game Not Found" Warning

**Solution**:
- Make sure Torchlight: Infinite is running
- Check that the game window title is "Torchlight: Infinite"
- Restart the tracker after starting the game

### "Initialization Failed"

**Solution**:
- Open your inventory in-game
- Make sure you have at least 20 items
- Try clicking "Initialize Tracker" again

### No Prices Showing

**Solution**:
- Prices update when you search items in the market
- Open the in-game market and search for an item
- The tracker will capture and store the price

### Drops Not Detected

**Solution**:
- Make sure you've initialized the tracker
- Check that you're actually in a map/dungeon
- Look for "Entered map" messages in the log

## Advanced Configuration

### Config File Location

Windows: `C:\Users\[YourName]\AppData\Roaming\torchlight-tracker-electron\config.json`

### Manual Config Editing

```json
{
  "opacity": 1.0,           // 0.1 to 1.0
  "tax": 0,                 // 0 = off, 1 = on
  "user": "",               // Your user ID
  "window_x": 100,          // Window position X
  "window_y": 100,          // Window position Y
  "window_width": 800,      // Window width
  "window_height": 600      // Window height
}
```

### Data Files Location

All data files are stored in the app's user data directory:
- Windows: `C:\Users\[YourName]\AppData\Roaming\torchlight-tracker-electron\`

## Performance Tips

1. **Opacity**: Lower opacity = better game visibility
2. **Filters**: Use category filters to reduce UI clutter
3. **Reset Stats**: Clear old data periodically for better performance

## Building for Distribution

```bash
# Clean build
rm -rf dist dist-react release node_modules
npm install
npm run build:electron
```

The installer will be in `release/` with filename like:
- Windows: `Torchlight Tracker Setup [version].exe`

## Support

If you encounter issues:
1. Check the `tracker.log` file in the app data directory
2. Export debug log using the "Export Debug Log" button
3. Report issues with the log file attached

## Contributing

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Next Steps

After setup:
1. ✅ Run `npm install`
2. ✅ Start development server with `npm run dev`
3. ✅ Launch Torchlight: Infinite
4. ✅ Initialize the tracker
5. ✅ Start playing and tracking!

Happy tracking! 🎮📊
