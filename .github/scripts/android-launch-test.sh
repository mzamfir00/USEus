#!/usr/bin/env bash
# Installs the release APK on the CI emulator, launches it and checks that it stays up and
# renders its first screen (IRL safety warning), then taps through to the sign-up screen.
set -u
APK="$1"
OUT=launch-test
PKG=com.useus.game
mkdir -p "$OUT"

fail() {
  echo "::error::$1"
  adb logcat -d > "$OUT/logcat.txt" 2>/dev/null
  adb exec-out screencap -p > "$OUT/failure.png" 2>/dev/null
  grep -E "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS" "$OUT/logcat.txt" | tail -60
  exit 1
}

dump_ui() {
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 && adb pull /sdcard/ui.xml "$OUT/$1.xml" > /dev/null 2>&1
}

# Centre of the first UI node whose text contains $1.
tap_text() {
  local pos
  pos=$(python3 - "$OUT/$2.xml" "$1" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding='utf-8').read()
for m in re.finditer(r'<node [^>]*>', xml):
    node = m.group(0)
    t = re.search(r' text="([^"]*)"', node)
    if t and sys.argv[2] in t.group(1):
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
        x1, y1, x2, y2 = map(int, b.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)
  [ -n "$pos" ] || return 1
  adb shell input tap $pos
}

adb install -r -g "$APK" || fail "APK did not install"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1 || fail "App did not launch"

# Fonts, saved data and sounds load during the splash; give a cold emulator time.
for i in $(seq 1 30); do
  sleep 3
  adb shell pidof "$PKG" > /dev/null || fail "App process died during startup"
  dump_ui screen1
  if grep -q "PLAY SAFELY" "$OUT/screen1.xml" 2>/dev/null; then break; fi
done
grep -q "PLAY SAFELY" "$OUT/screen1.xml" || fail "First screen (IRL safety warning) never appeared"
adb exec-out screencap -p > "$OUT/1-safety.png"
echo "Safety warning rendered"

tap_text "I Understand" screen1 || fail "Could not find the agree button"
sleep 4
dump_ui screen2
grep -q "Create account" "$OUT/screen2.xml" || fail "Sign-up screen did not appear after agreeing"
adb exec-out screencap -p > "$OUT/2-signup.png"
echo "Sign-up screen rendered"

# Open the in-app Privacy Policy (native sheet) and close it again. The link sits at the
# bottom of the sign-up form, so scroll until it is on screen.
found=""
for i in 1 2 3 4; do
  dump_ui form
  if grep -q 'text="Privacy Policy"' "$OUT/form.xml" 2>/dev/null; then found=1; break; fi
  read -r W H < <(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr 'x' ' ')
  adb shell input swipe $((W / 2)) $((H * 4 / 5)) $((W / 2)) $((H / 4)) 300
  sleep 1
done
[ -n "$found" ] || fail "Privacy Policy link not found on the sign-up screen"
tap_text "Privacy Policy" form || fail "Could not tap the Privacy Policy link"
sleep 3
dump_ui screen3
adb exec-out screencap -p > "$OUT/3-privacy.png"
grep -q "Last updated" "$OUT/screen3.xml" || fail "Privacy Policy sheet did not open"
adb shell input keyevent KEYCODE_BACK
sleep 2
dump_ui screen4
grep -q "Create account" "$OUT/screen4.xml" || fail "Back did not close the Privacy Policy sheet"
echo "Privacy Policy sheet opens and closes"

adb shell pidof "$PKG" > /dev/null || fail "App closed during the test"
adb logcat -d > "$OUT/logcat.txt"
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt"; then fail "Fatal exception in logcat"; fi
echo "Launch test passed: no crash, first screens render"
