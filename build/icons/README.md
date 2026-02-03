# App Icons

This directory should contain Linux icons in PNG format at various sizes.

## Required files:
- 16x16.png
- 32x32.png
- 48x48.png
- 64x64.png
- 128x128.png
- 256x256.png
- 512x512.png
- 1024x1024.png

## Parent directory (build/) should contain:
- icon.icns (macOS) - Can be generated from 1024x1024.png using iconutil
- icon.ico (Windows) - Can be generated from multiple PNGs using tools like png2ico

## Generating icons

### From a source PNG (1024x1024 recommended):

**Linux PNGs:**
```bash
for size in 16 32 48 64 128 256 512 1024; do
  convert icon-source.png -resize ${size}x${size} build/icons/${size}x${size}.png
done
```

**macOS .icns:**
```bash
mkdir icon.iconset
for size in 16 32 128 256 512; do
  convert icon-source.png -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
  convert icon-source.png -resize $((size*2))x$((size*2)) icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns icon.iconset -o build/icon.icns
rm -rf icon.iconset
```

**Windows .ico:**
```bash
# Using ImageMagick
convert icon-source.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```
