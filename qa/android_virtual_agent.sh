#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.fightai.sparringanalyst"
OUT="${1:-qa-artifacts}"
mkdir -p "$OUT"

stamp(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log(){ echo "[$(stamp)] $*" | tee -a "$OUT/agent-report.txt"; }

log "Fight AI Android virtual-agent QA starting"

adb wait-for-device
adb shell input keyevent 82 || true
adb shell pm clear "$APP_ID" || true
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 5

# Android 35 may deny adb pull from /sdcard even when uiautomator can write there.
# Stream the hierarchy over stdout instead so the QA gate does not depend on shared-storage permissions.
adb exec-out uiautomator dump /dev/tty 2>/dev/null | sed -n '/<?xml/,$p' > "$OUT/fightai-home.xml"
adb exec-out screencap -p > "$OUT/01-home.png"
adb logcat -d > "$OUT/logcat-home.txt"

if ! test -s "$OUT/fightai-home.xml"; then
  log "FAIL: UI hierarchy capture was empty"
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
sleep 2
adb exec-out screencap -p > "$OUT/02-relaunch.png"
adb logcat -d > "$OUT/logcat-relaunch.txt"
if grep -Eq "FATAL EXCEPTION|AndroidRuntime.*FATAL" "$OUT/logcat-relaunch.txt"; then
  log "FAIL: fatal Android exception detected after relaunch"
  exit 13
fi
log "PASS: force-stop/relaunch survived"

log "Virtual-agent smoke PASS"
