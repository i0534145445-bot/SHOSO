#!/usr/bin/env bash
# Builds SHOSO-Music.exe for Windows from Linux/macOS/WSL using the Zig toolchain.
# Usage:  ./build.sh            -> dist/SHOSO-Music.exe
#         ./build.sh --tests    -> also build+run the core unit tests natively
set -euo pipefail
cd "$(dirname "$0")"

ZIG="${ZIG:-zig}"
if ! command -v "$ZIG" >/dev/null 2>&1; then
  if [ -x "tools/zig/zig" ]; then ZIG="tools/zig/zig"; else
    echo "zig not found. Install it or set ZIG=/path/to/zig" >&2; exit 1
  fi
fi

mkdir -p build dist

run_tests=0
[ "${1:-}" = "--tests" ] && run_tests=1

if [ "$run_tests" = 1 ]; then
  echo "== core unit tests (native) =="
  mkdir -p build
  g++ -std=c++17 -Wall -Wextra -g -O0 tests/test_core.cpp src/core/*.cpp -o build/test_core
  ./build/test_core
fi

echo "== resources =="
"$ZIG" rc src/win/app.rc build/app.res

echo "== compile SHOSO-Music.exe (x86_64-windows-gnu) =="
"$ZIG" c++ -target x86_64-windows-gnu -O2 -static -municode -std=c++17 \
  -Wall -Wno-unused-variable -Wno-unused-but-set-variable \
  -Wl,--subsystem,windows \
  -o dist/SHOSO-Music.exe \
  src/core/str.cpp src/core/tags.cpp src/core/library.cpp src/core/queue.cpp src/core/store.cpp \
  src/win/main.cpp src/win/ui_main.cpp src/win/ui_actions.cpp src/win/ui_lists.cpp \
  src/win/ui_dialogs.cpp src/win/theme.cpp src/win/platform.cpp src/win/log.cpp \
  src/win/audio.cpp src/win/art.cpp src/win/scanner.cpp \
  build/app.res \
  -lcomctl32 -lcomdlg32 -lgdi32 -lgdiplus -luser32 -lshell32 -lole32 -luuid \
  -luxtheme -lwinmm -ladvapi32 -loleaut32 -limm32 -lshlwapi

echo "== installer resources =="
"$ZIG" rc src/win/installer.rc build/installer.res

echo "== compile SHOSO-Setup.exe =="
"$ZIG" c++ -target x86_64-windows-gnu -O2 -static -municode -std=c++17 \
  -Wall -Wno-unused-variable -Wno-unused-but-set-variable \
  -Wl,--subsystem,windows \
  -o dist/SHOSO-Setup.exe \
  src/core/str.cpp src/core/library.cpp src/win/installer.cpp src/win/theme.cpp src/win/platform.cpp src/win/log.cpp \
  build/installer.res \
  -lcomctl32 -lcomdlg32 -lgdi32 -luser32 -lshell32 -lole32 -luuid \
  -luxtheme -lwinmm -ladvapi32 -loleaut32 -limm32 -lshlwapi

echo "== done =="
ls -la dist/
