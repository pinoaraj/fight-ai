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
    adb exec-out uiautomator dump /dev/tty 2>/dev/null | sed -n '/<?xml/,$p' > "$target" || true
    if grep -q '<?xml' "$target" 2>/dev/null; then return 0; fi
    sleep 3
  done
  return 1
}

launch_app(){
  adb shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
  adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
}

app_fatal_in_log(){
  local file="$1"
  # Android 35 emulator system processes can ANR while the hosted runner is
  # saturated. A release failure is valid only when AndroidRuntime identifies
  # Fight AI itself as the crashing process. Do not let com.android.phone or
  # System UI failures masquerade as an application crash.
  grep -Eq "Process: ${APP_ID}([,[:space:]]|$)|FATAL EXCEPTION.*${APP_ID}|${APP_ID}.*FATAL EXCEPTION|am_crash.*${APP_ID}" "$file" 2>/dev/null
}

recover_system_ui_anr(){
  local xml="$OUT/fightai-home.xml"
  for attempt in 1 2 3; do
    if ! grep -Eq "System UI isn.t responding|android:id/aerr_wait|com.android.systemui" "$xml" 2>/dev/null; then
      return 0
    fi
    log "INFO: emulator System UI ANR detected; choosing Wait and retrying app launch (attempt $attempt/3)"
    # Pixel 7 test profile is 1080x2400. This lands on the ANR dialog's Wait button.
    adb shell input tap 540 1336 >/dev/null 2>&1 || true
    sleep 5
    launch_app
    sleep 8
    adb exec-out screencap -p > "$OUT/01-home-retry-$attempt.png" || true
    adb logcat -d > "$OUT/logcat-home.txt" || true
    capture_hierarchy || true
  done
  if grep -Eq "System UI isn.t responding|android:id/aerr_wait|com.android.systemui" "$xml" 2>/dev/null; then
    log "FAIL: emulator System UI ANR remained after recovery retries"
    exit 14
  fi
}

log "Fight AI Android virtual-agent QA starting"

adb wait-for-device
adb shell input keyevent 82 || true
adb shell pm clear "$APP_ID" || true
adb logcat -c || true
launch_app
sleep 8

adb exec-out screencap -p > "$OUT/01-home.png"
adb logcat -d > "$OUT/logcat-home.txt"

if ! capture_hierarchy; then
  log "FAIL: UI hierarchy capture was empty after retries"
  exit 9
fi

recover_system_ui_anr

if app_fatal_in_log "$OUT/logcat-home.txt"; then
  log "FAIL: Fight AI process crashed after launch"
  exit 10
fi

if grep -Eq "AI Sparring Analyst|Fight AI|Beta|Crea un perfil|Create a local beta profile" "$OUT/fightai-home.xml"; then
  log "PASS: Fight AI first screen rendered"
else
  log "FAIL: expected Fight AI UI text not found"
  exit 11
fi

if grep -q "Crea un perfil" "$OUT/fightai-home.xml" && grep -q "Create a local beta profile" "$OUT/fightai-home.xml"; then
  log "FAIL: mixed-language duplicate onboarding copy"
  exit 12
fi
log "PASS: no duplicated ES/EN onboarding body"

adb logcat -c || true
adb shell am force-stop "$APP_ID"
launch_app
sleep 4
adb exec-out screencap -p > "$OUT/02-relaunch.png"
adb logcat -d > "$OUT/logcat-relaunch.txt"
if app_fatal_in_log "$OUT/logcat-relaunch.txt"; then
  log "FAIL: Fight AI process crashed after relaunch"
  exit 13
fi
log "PASS: force-stop/relaunch survived"

log "Virtual-agent smoke PASS"
