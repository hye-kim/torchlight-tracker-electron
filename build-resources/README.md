# Build Resources

## Icon Files

You need to add icon files to this directory:

- **icon.ico** - Windows icon (256x256 recommended, can include multiple sizes)
- **icon.png** - Source icon (512x512 or 1024x1024 recommended)

### Creating Icons

You can create these from your existing icon or use online tools:

1. **From PNG to ICO:**
   - Use https://icoconvert.com/
   - Or use ImageMagick: `convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico`

2. **Recommended Sizes:**
   - ICO should contain: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
   - PNG: 512x512 or higher for macOS/Linux builds

### Temporary Solution

For now, you can copy the icon from the parent directory if available, or use a placeholder.

If you don't have icons yet, the build will still work but will use Electron's default icon.
