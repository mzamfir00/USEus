#!/usr/bin/env bash
# Installs the release APK on the CI emulator, launches it and checks that it stays up and
# renders its first screen (IRL safety warning), then taps through to the sign-up screen.
set -u
APK="$1"
OUT=launch-test
PKG=com.useus.game
mkdir -p "$OUT"

# Prints the text of every node in the last UI dump, so failures can be read from the log.
show_screen() {
  local f
  f=$(ls -t "$OUT"/*.xml 2>/dev/null | head -1)
  [ -n "$f" ] && echo "On screen ($f):" && grep -oE ' text="[^"]+"' "$f" | sed 's/ text=//' | head -60
}

fail() {
  echo "::error::$1"
  show_screen
  adb logcat -d > "$OUT/logcat.txt" 2>/dev/null
  adb exec-out screencap -p > "$OUT/failure.png" 2>/dev/null
  grep -E "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS" "$OUT/logcat.txt" | tail -60
  exit 1
}

dump_ui() {
  local n
  for n in 1 2 3; do
    adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 && adb pull /sdcard/ui.xml "$OUT/$1.xml" > /dev/null 2>&1
    clear_anr "$1" || return 0
  done
}

# A slow CI emulator can raise "Pixel Launcher / System UI isn't responding" over the app.
# Close another app's dialog (wait on ours, and say so), then bring USEus back to the front.
clear_anr() {
  local who
  who=$(grep -oE 'text="[^"]* responding"' "$OUT/$1.xml" 2>/dev/null | head -1 | sed -E 's/^text="//; s/ is(n.{1,6}t| not) responding"$//')
  [ -n "$who" ] || return 1
  echo "System dialog: $who isn't responding"
  if [ "$who" = "USEus" ]; then
    tap_text "Wait" "$1"
  else
    tap_text "Close app" "$1" || tap_text "Wait" "$1"
  fi
  sleep 2
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
  sleep 3
}

# Centre of the first UI node whose text contains $1.
tap_text() {
  local pos
  pos=$(python3 - "$OUT/$2.xml" "$1" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding='utf-8').read()
nodes = []
for m in re.finditer(r'<node [^>]*>', xml):
    t = re.search(r' text="([^"]*)"', m.group(0))
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', m.group(0))
    if t and b:
        nodes.append((t.group(1), tuple(map(int, b.groups()))))
# An exact label wins over a sentence that merely mentions it.
hits = [n for n in nodes if n[0] == sys.argv[2]] or [n for n in nodes if sys.argv[2] in n[0]]
if hits:
    x1, y1, x2, y2 = hits[0][1]
    print((x1 + x2) // 2, (y1 + y2) // 2)
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

# Open the in-app Privacy Policy (native sheet) and close it again. The link is the last
# thing on the sign-up form: scroll to the end so it clears the navigation bar.
read -r W H < <(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr 'x' ' ')
for i in 1 2 3 4; do
  adb shell input swipe $((W / 2)) $((H * 3 / 4)) $((W / 2)) $((H / 4)) 250
  sleep 0.5
done
sleep 2
dump_ui form
grep -q 'text="Privacy Policy"' "$OUT/form.xml" || fail "Privacy Policy link not found on the sign-up screen"
tap_text "Privacy Policy" form || fail "Could not tap the Privacy Policy link"
opened=""
for i in 1 2 3 4 5; do
  sleep 2
  dump_ui screen3
  if grep -q "Last updated" "$OUT/screen3.xml" 2>/dev/null; then opened=1; break; fi
done
adb exec-out screencap -p > "$OUT/3-privacy.png"
[ -n "$opened" ] || fail "Privacy Policy sheet did not open"
adb shell input keyevent KEYCODE_BACK
sleep 2
dump_ui screen4
grep -q "Create account" "$OUT/screen4.xml" || fail "Back did not close the Privacy Policy sheet"
echo "Privacy Policy sheet opens and closes"

adb shell pidof "$PKG" > /dev/null || fail "App closed during the test"
adb logcat -d > "$OUT/logcat.txt"
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt"; then fail "Fatal exception in logcat"; fi
echo "Launch test passed: no crash, first screens render"
