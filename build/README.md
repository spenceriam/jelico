# Build Resources

This directory contains resources needed for building Jelico for distribution.

## Required Files

Before building for release, you need to provide app icons:

### macOS (`icon.icns`)
- Required for macOS builds
- Can be generated from a 1024x1024 PNG using `iconutil`

### Windows (`icon.ico`)
- Required for Windows builds
- Should contain multiple resolutions (16, 32, 48, 64, 128, 256)
- Can be generated using ImageMagick or online tools

### Linux (`icons/` directory)
PNG files at various resolutions:
- 16x16.png
- 32x32.png
- 48x48.png
- 64x64.png
- 128x128.png
- 256x256.png
- 512x512.png

## Generating Icons

See `icons/README.md` for detailed instructions.

### Quick Start (requires ImageMagick)

1. Create a source image `icon-source.png` (1024x1024 recommended)

2. Generate all icons:
```bash
# Linux PNGs
for size in 16 32 48 64 128 256 512; do
  convert icon-source.png -resize ${size}x${size} build/icons/${size}x${size}.png
done

# Windows ICO
convert icon-source.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico

# macOS ICNS (macOS only)
mkdir icon.iconset
for size in 16 32 128 256 512; do
  sips -z $size $size icon-source.png --out icon.iconset/icon_${size}x${size}.png
  sips -z $((size*2)) $((size*2)) icon-source.png --out icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns icon.iconset -o build/icon.icns
rm -rf icon.iconset
```

## Other Files

- `entitlements.mac.plist` - macOS app entitlements for code signing
