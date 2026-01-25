# Building Windows Executable - Complete Guide

This guide will walk you through creating a Windows executable that users can download and run without any setup.

## Prerequisites

1. **Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **Git** (to clone the repository)
   - Download from: https://git-scm.com/

3. **Windows OS** (for building Windows executables)
   - You can build on Windows 10 or 11
   - Cross-compiling from Mac/Linux is possible but more complex

## Step 1: Initial Setup

```bash
# Navigate to the electron directory
cd electron

# Install all dependencies
npm install
```

This will install:
- Electron framework
- React and dependencies
- Build tools (electron-builder, vite, etc.)
- Optional: node-process-windows for game detection

## Step 2: Add Icon (Optional but Recommended)

1. Place your icon file in `build-resources/icon.ico`
2. Icon should be 256x256 or contain multiple sizes
3. If you don't have an icon, the build will use Electron's default

**Quick icon creation:**
```bash
# If you have an existing icon from the Python version
# Copy it to the electron directory
cp ../path/to/your/icon.ico build-resources/icon.ico
```

## Step 3: Build the Application

### Option A: Installer (Recommended)

Creates a Windows installer (.exe) that:
- Installs to Program Files
- Creates desktop shortcut
- Adds to Start Menu
- Has an uninstaller

```bash
npm run build:win
```

**Output:**
- File: `release/Torchlight Tracker-2.0.0-Setup.exe`
- Size: ~150-200 MB (includes Chromium + Node.js)

### Option B: Portable Executable

Creates a standalone .exe that:
- Runs without installation
- Can be placed anywhere
- Perfect for USB drives

```bash
npm run build:win-portable
```

**Output:**
- File: `release/Torchlight Tracker-2.0.0-Portable.exe`
- Size: ~150-200 MB

### Build Time

- **First build:** 5-15 minutes (downloads Electron binaries)
- **Subsequent builds:** 2-5 minutes

## Step 4: Test the Executable

### Testing the Installer:

1. Navigate to `release/` folder
2. Double-click `Torchlight Tracker-2.0.0-Setup.exe`
3. Follow installation wizard
4. Launch from Desktop or Start Menu

### Testing the Portable:

1. Navigate to `release/` folder
2. Double-click `Torchlight Tracker-2.0.0-Portable.exe`
3. App runs immediately (may take a few seconds first time)

## Step 5: Distribute to Users

### What to Share:

**Option 1 - Installer (Easiest for users):**
- Share `Torchlight Tracker-2.0.0-Setup.exe`
- Users just run it and follow the installer

**Option 2 - Portable (No installation):**
- Share `Torchlight Tracker-2.0.0-Portable.exe`
- Users can run it from anywhere

### Upload to GitHub Releases:

```bash
# Tag a release
git tag v2.0.0
git push origin v2.0.0

# Then upload the .exe files from release/ folder to GitHub Releases
```

## Common Build Issues & Solutions

### Issue: "electron-builder not found"

**Solution:**
```bash
npm install --save-dev electron-builder
```

### Issue: "Python required" error

**Solution:**
```bash
# Install windows-build-tools
npm install --global windows-build-tools
```

Or install Python 3.x from python.org

### Issue: Build fails with "icon not found"

**Solution:**
```bash
# Create a placeholder icon or skip icon
# Edit electron-builder.json and remove icon lines temporarily
```

### Issue: Antivirus blocks the .exe

**Solution:**
- This is normal for unsigned executables
- Users need to allow it in their antivirus
- To avoid: Sign the executable (requires code signing certificate ~$100-400/year)

### Issue: Large file size (~150-200 MB)

**Explanation:**
- This is normal for Electron apps
- Includes Chromium browser + Node.js runtime
- Cannot be significantly reduced
- Users download once, use forever

## Advanced: Code Signing (Optional)

To avoid antivirus warnings and build trust:

1. **Purchase a code signing certificate**
   - From: DigiCert, GlobalSign, Sectigo
   - Cost: $100-400/year

2. **Configure in electron-builder.json:**
```json
{
  "win": {
    "certificateFile": "cert.pfx",
    "certificatePassword": "your-password"
  }
}
```

3. **Build with signing:**
```bash
npm run build:win
```

## Build Scripts Reference

| Command | Description | Output |
|---------|-------------|--------|
| `npm run build` | Build React + Electron | dist-react/, dist-electron/ |
| `npm run build:win` | Create Windows installer | .exe installer |
| `npm run build:win-portable` | Create portable .exe | Standalone .exe |
| `npm run dist` | Build for all platforms | All configured targets |

## File Structure After Build

```
electron/
├── dist-react/           # Compiled React app
├── dist-electron/        # Compiled Electron main process
├── release/              # Final executables
│   ├── win-unpacked/    # Unpacked app files
│   ├── Torchlight Tracker-2.0.0-Setup.exe  # Installer
│   └── Torchlight Tracker-2.0.0-Portable.exe  # Portable
└── node_modules/         # Dependencies
```

## Optimization Tips

### Reduce Build Size:
```json
// In electron-builder.json
{
  "compression": "maximum",  // Already set
  "asar": true              // Already set
}
```

### Faster Builds:
```bash
# Skip compression for testing
npm run build && electron-builder --win --config.compression=store
```

### Clean Build:
```bash
# Remove old builds
rm -rf dist-react dist-electron release

# Fresh build
npm run build:win
```

## GitHub Actions (Automated Builds)

Create `.github/workflows/build.yml` to automatically build on every release:

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd electron && npm install
      - run: cd electron && npm run build:win
      - uses: actions/upload-artifact@v3
        with:
          name: windows-installer
          path: electron/release/*.exe
```

## Final Checklist

Before distributing:

- [ ] Test on a clean Windows machine
- [ ] Verify game detection works
- [ ] Test all features (tracking, export, settings)
- [ ] Check file paths work correctly
- [ ] Ensure data files are bundled
- [ ] Test uninstaller (if using installer)
- [ ] Create README for users
- [ ] Upload to GitHub Releases or website

## User Instructions

Include this with your distribution:

```
INSTALLATION INSTRUCTIONS

Option 1: Using Installer
1. Download "Torchlight Tracker-2.0.0-Setup.exe"
2. Double-click to run
3. Follow the installation wizard
4. Launch from Desktop or Start Menu

Option 2: Using Portable
1. Download "Torchlight Tracker-2.0.0-Portable.exe"
2. Place it anywhere you want
3. Double-click to run

SYSTEM REQUIREMENTS
- Windows 10 or 11
- 200 MB disk space
- Torchlight: Infinite installed

FIRST RUN
1. Start Torchlight: Infinite
2. Launch Torchlight Tracker
3. Click "Initialize Tracker"
4. Open your inventory in-game
5. Start playing!
```

## Success!

Once built, users can simply:
1. Download the .exe file
2. Run it
3. Start tracking!

No Node.js, no npm commands, no setup required! 🎉
