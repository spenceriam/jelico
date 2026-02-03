# Build Resources

This directory contains app icons and build resources for all platforms.

## Icon Files

| File | Platform | Description |
|------|----------|-------------|
| `icon.svg` | Source | Vector source file |
| `icon.png` | All | 1024x1024 master PNG |
| `icon.ico` | Windows | Multi-resolution Windows icon |
| `icon.iconset/` | macOS | Folder with all sizes for iconutil |
| `icons/` | Linux | PNG files at standard sizes |

## Generated During CI

- `icon.icns` - Generated on macOS runners using `iconutil -c icns icon.iconset`

## Regenerating Icons

If you modify `icon.svg`, regenerate all icons:

```bash
cd build

# Generate PNGs from SVG
for size in 16 32 48 64 128 256 512 1024; do
  convert -background none -density 300 icon.svg -resize ${size}x${size} icons/${size}x${size}.png
done

# Copy master PNG
cp icons/1024x1024.png icon.png

# Generate Windows ICO
convert icons/16x16.png icons/32x32.png icons/48x48.png icons/64x64.png \
        icons/128x128.png icons/256x256.png icon.ico

# Update macOS iconset
cp icons/16x16.png icon.iconset/icon_16x16.png
cp icons/32x32.png icon.iconset/icon_16x16@2x.png
cp icons/32x32.png icon.iconset/icon_32x32.png
cp icons/64x64.png icon.iconset/icon_32x32@2x.png
cp icons/128x128.png icon.iconset/icon_128x128.png
cp icons/256x256.png icon.iconset/icon_128x128@2x.png
cp icons/256x256.png icon.iconset/icon_256x256.png
cp icons/512x512.png icon.iconset/icon_256x256@2x.png
cp icons/512x512.png icon.iconset/icon_512x512.png
cp icons/1024x1024.png icon.iconset/icon_512x512@2x.png

# Generate macOS ICNS (only works on macOS)
iconutil -c icns icon.iconset -o icon.icns
```

## Other Files

- `entitlements.mac.plist` - macOS app entitlements for code signing
