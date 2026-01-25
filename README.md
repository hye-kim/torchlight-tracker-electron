# Torchlight Infinite Price Tracker - Electron Edition

Modern Electron-based version of the Torchlight Infinite Price Tracker with React UI.

## Features

- **Real-time Tracking**: Monitors game logs to detect item drops and price changes
- **Modern UI**: Built with React and TypeScript for a responsive experience
- **Statistics**: Track income, map runs, and efficiency metrics
- **Filtering**: Filter drops by category (Currency, Ashes, Compass, etc.)
- **Excel Export**: Export drop history to Excel with detailed statistics
- **Configurable**: Adjust opacity, tax mode, and other settings
- **Inventory Management**: Initialize tracker to accurately track item changes

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **ExcelJS**: Excel export functionality
- **Winston**: Logging

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Windows OS (for game process detection)

### Installation

```bash
cd electron
npm install
```

### Running in Development

```bash
npm run dev
```

This will:
1. Start the Vite dev server (React UI)
2. Launch Electron in development mode
3. Enable hot module replacement for UI changes

### Building

```bash
# Build React app
npm run build

# Build Electron app and create installer
npm run build:electron
```

The built application will be in the `release/` directory.

## Project Structure

```
electron/
├── electron/                 # Electron main process
│   ├── main.ts              # Main entry point
│   ├── preload.ts           # Preload script for IPC
│   └── backend/             # Backend modules
│       ├── ConfigManager.ts
│       ├── FileManager.ts
│       ├── LogParser.ts
│       ├── InventoryTracker.ts
│       ├── StatisticsTracker.ts
│       ├── GameDetector.ts
│       ├── LogMonitor.ts
│       ├── ExcelExporter.ts
│       ├── Logger.ts
│       └── constants.ts
├── src/                     # React app (renderer process)
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # React entry point
│   ├── components/          # React components
│   │   ├── StatsCard.tsx
│   │   ├── DropsCard.tsx
│   │   ├── ControlCard.tsx
│   │   └── SettingsDialog.tsx
│   └── vite-env.d.ts        # TypeScript definitions
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## How It Works

### Main Process (Node.js)

The Electron main process handles:
- Game detection and log file monitoring
- Log parsing and price extraction
- Inventory state tracking
- Statistics calculation
- File I/O operations
- IPC communication with renderer

### Renderer Process (React)

The React app handles:
- Displaying statistics and drops
- User interactions (buttons, filters, settings)
- Real-time updates via IPC
- Excel export dialogs

### IPC Communication

The main and renderer processes communicate via Electron IPC:

```typescript
// Renderer → Main
await window.electronAPI.initializeTracker();

// Main → Renderer
window.electronAPI.onUpdateDisplay((data) => {
  // Update UI with new data
});
```

## Key Features

### Game Detection

Automatically detects the Torchlight: Infinite game process and locates the log file using Windows process enumeration.

### Log Monitoring

Monitors the game log file in real-time using Node.js file system APIs with:
- Noise filtering for performance
- Message batching to reduce overhead
- Log rotation handling

### Inventory Tracking

Tracks inventory state with two initialization methods:
1. **Modern**: Uses `InitBagData` log entries (requires 20+ items)
2. **Legacy**: Falls back to bag modification scanning (requires 10+ items)

### Price Calculation

Extracts prices from market search logs using:
- Mode (most common price) with 30% threshold
- Median fallback for reliability
- 30-sample window for accuracy

### Statistics

Tracks:
- **Current Map**: Duration, FE income, income/minute
- **Total Session**: All maps combined
- **Per-Item**: Individual drop tracking with quantities and values

## Configuration

Settings are stored in `config.json`:

```json
{
  "opacity": 1.0,
  "tax": 0,
  "user": "",
  "window_x": 100,
  "window_y": 100,
  "window_width": 800,
  "window_height": 600
}
```

## Data Files

- `config.json`: Application configuration
- `full_table.json`: Item prices (generated from en_id_table.json)
- `comprehensive_item_mapping.json`: Item database with types and names
- `en_id_table.json`: English item ID translations
- `drop.txt`: Drop history log
- `tracker.log`: Application debug log

## Troubleshooting

### Game Not Detected

- Ensure Torchlight: Infinite is running
- Check that logging is enabled in game
- Verify game window title is "Torchlight: Infinite"

### No Drops Showing

- Click "Initialize Tracker" button
- Open your inventory in-game (needs to scan items)
- Wait for initialization to complete

### Prices Not Updating

- Search for items in the in-game market
- Prices update when you perform market searches
- Check `full_table.json` for price data

## Building from Source

```bash
# Install dependencies
npm install

# Development
npm run dev

# Type checking
npm run type-check

# Build production
npm run build
npm run build:electron
```

## Dependencies

Key packages:
- `electron`: ^28.1.3
- `react`: ^18.2.0
- `typescript`: ^5.3.3
- `vite`: ^5.0.11
- `exceljs`: ^4.4.0
- `winston`: ^3.11.0
- `axios`: ^1.6.5
- `node-process-windows`: For Windows process detection

## License

This project builds upon the original FurTorch codebase and is provided as-is.

## Acknowledgments

- Original FurTorch developers
- Torchlight: Infinite community
- All contributors
