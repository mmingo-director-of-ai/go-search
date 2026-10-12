#!/usr/bin/env bash
# Source checks everywhere; add unsigned Apple builds with --native on macOS.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# -gt 1 || ( $# -eq 1 && "$1" != --native ) ]]; then
  echo 'Usage: bash scripts/check.sh [--native]' >&2
  exit 2
fi
npm run check
if [[ "${1:-}" != --native ]]; then exit 0; fi
mkdir -p build/tmp build/ModuleCache
export TMPDIR="$PWD/build/tmp/"
export CLANG_MODULE_CACHE_PATH="$PWD/build/ModuleCache"
export SWIFT_MODULECACHE_PATH="$PWD/build/ModuleCache"
for platform in macOS iOS; do
  destination='generic/platform=macOS'
  if [[ "$platform" == iOS ]]; then destination='generic/platform=iOS Simulator'; fi
  logfile="$PWD/build/check-$platform.log"
  echo "Building Go Search ($platform), unsigned; log: build/check-$platform.log"
  if ! xcodebuild -project 'apple/Go Search/Go Search.xcodeproj' \
      -scheme "Go Search ($platform)" -configuration Release \
      -destination "$destination" -derivedDataPath "$PWD/build/$platform" \
      CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build >"$logfile" 2>&1; then
    tail -80 "$logfile"
    exit 1
  fi
  grep 'BUILD SUCCEEDED' "$logfile"
done
python3 - <<'PY'
from pathlib import Path
root = Path.cwd()
products = [
    root / 'build/macOS/Build/Products/Release/Go Search.app/Contents/Resources',
    root / 'build/macOS/Build/Products/Release/Go Search.app/Contents/PlugIns/Go Search Extension.appex/Contents/Resources',
    root / 'build/iOS/Build/Products/Release-iphonesimulator/Go Search.app',
    root / 'build/iOS/Build/Products/Release-iphonesimulator/Go Search.app/PlugIns/Go Search Extension.appex',
]
for product in products:
    for name in ['LICENSE', 'LICENSE-ASSETS.md', 'LICENSE-ARTWORK']:
        if (product / name).read_bytes() != (root / name).read_bytes():
            raise SystemExit(f'Bundled license differs: {product / name}')
print('License texts verified byte-for-byte in both apps and both extensions.')
PY
