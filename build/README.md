# Build Resources

This directory contains app icons and build resources for all platforms.

## Icon Files

| File | Platform | Description |
|------|----------|-------------|
| `icon.png` | macOS + base | Canonical 1024x1024 packaging icon |
| `icon.ico` | Windows | Multi-resolution Windows icon |
| `icons/` | Linux | PNG icons at standard sizes |

## Notes

- Canonical branding source for packaging is `src/assets/branding/jelico-icon.png`.
- Electron Builder uses:
  - macOS: `build/icon.png`
  - Windows: `build/icon.ico`
  - Linux: `build/icons/*`
- We intentionally avoid `.icns` generation in CI to prevent icon drift.

## Regenerating Icons

If branding changes, refresh packaging icons from `src/assets/branding/jelico-icon.png`:

```bash
cd build

# Sync canonical 1024x1024 packaging icon
cp ../src/assets/branding/jelico-icon.png icon.png

# Generate Linux PNG sizes
for size in 16 32 48 64 128 256 512 1024; do
  sips -z ${size} ${size} icon.png --out icons/${size}x${size}.png >/dev/null
done

# Refresh icon.png from generated 1024 variant to keep parity
cp icons/1024x1024.png icon.png

# Refresh Windows ICO (requires ImageMagick)
magick icons/16x16.png icons/32x32.png icons/48x48.png icons/64x64.png \
  icons/128x128.png icons/256x256.png icon.ico
```

## Other Files

- `entitlements.mac.plist` - macOS app entitlements for code signing
