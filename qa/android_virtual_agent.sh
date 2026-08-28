#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.fightai.sparringanalyst"
OUT="${1:-qa-artifacts}"
mkdir -p "$OUT"

stamp(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log(){ echo "[$(stamp)] $*" | tee -a "$OUT/agent-report.txt"; }

capture_hierarchy(){
  local target="$OUT/fightai-home.xml"
  : > "$target"
  for attempt in 1 2 3 4; do
    adb shell rm -f /data/local/tmp/fightai-home.xml >/dev/null 2>&1 || true
    if adb shell uiautomator dump /data/local/tmp/fightai-home.xml >/dev/null 2>&1; then
      adb exec-out cat /data/local/tmp/fightai-home.xml 2>/dev/null > "$target" || true
    fi
    if grep -q '<?xml' "$target" 2>/dev/null; then return 0; fi
    # Fallback for emulator images where uiautomator only supports stdout.
    adb exec-out uiautomator dump /dev/tty 2>/dev/null | sed -n '/<?xml/,$p' > "$target" || true
    if grep -q '<?xml' "$target" 2>/dev/null; then return 0; fi
    sleep 3
  done
  return 1
}

log "Fight AI Android virtual-agent QA starting"

adb wait-for-device
adb shell input keyevent 82 || true
adb shell pm clear "$APP_ID" || true
adb logcat -c || true
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 8

adb exec-out screencap -p > "$OUT/01-home.png"
adb logcat -d > "$OUT/logcat-home.txt"

if ! capture_hierarchy; then
  log "FAIL: UI hierarchy capture was empty after retries"
  exit 9
fi

if grep -Eq "FATAL EXCEPTION|AndroidRuntime.*FATAL" "$OUT/logcat-home.txt"; then
  log "FAIL: fatal Android exception detected after launch"
  exit 10
fi

if grep -Eq "AI Sparring Analyst|Fight AI|Beta|Crea un perfil|Create a local beta profile" "$OUT/fightai-home.xml"; then
  log "PASS: Fight AI first screen rendered"
else
  log "FAIL: expected Fight AI UI text not found"
  exit 11
fi

# Language contract: first screen must not contain duplicated Spanish+English body copy.
if grep -q "Crea un perfil" "$OUT/fightai-home.xml" && grep -q "Create a local beta profile" "$OUT/fightai-home.xml"; then
  log "FAIL: mixed-language duplicate onboarding copy"
  exit 12
fi
log "PASS: no duplicated ES/EN onboarding body"

# Exercise process restart resilience.
adb shell am force-stop "$APP_ID"
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 3
adb exec-out screencap -p > "$OUT/02-relaunch.png"
adb logcat -d > "$OUT/logcat-relaunch.txt"
if grep -Eq "FATAL EXCEPTION|AndroidRuntime.*FATAL" "$OUT/logcat-relaunch.txt"; then
  log "FAIL: fatal Android exception detected after relaunch"
  exit 13
fi
log "PASS: force-stop/relaunch survived"

log "Virtual-agent smoke PASS"
