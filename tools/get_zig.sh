#!/usr/bin/env bash
# Fetches the Zig toolchain into tools/zig (git-ignored) so that ./build.sh works
# on a machine that has python3 + pip but no cross-compiler.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -x tools/zig/zig ]; then
  echo "tools/zig/zig already present: $(tools/zig/zig version)"
  exit 0
fi

echo "installing ziglang via pip..."
python3 -m pip install --quiet --target tools/zigpkg ziglang
rm -rf tools/zig
cp -r tools/zigpkg/ziglang tools/zig
rm -rf tools/zigpkg
chmod +x tools/zig/zig
echo "zig ready: $(tools/zig/zig version)"
