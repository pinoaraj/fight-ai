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
  # Android 35 emulator system processes can ANR/crash while the hosted runner
  # is saturated. A release failure is valid only when Fight AI itself is the
  # crashing process; Bluetooth/phone/System UI noise must not masquerade as an
  # application crash.
  grep -Eq "Process: ${APP_ID}([,[:space:]]|$)|FATAL EXCEPTION.*${APP_ID}|${APP_ID}.*FATAL EXCEPTION|am_crash.*${APP_ID}" "$file" 2>/dev/null
}

click_xml_text(){
  local wanted="$1"
  python3 - "$OUT/fightai-home.xml" "$wanted" <<'PY' | while read -r x y; do
import re,sys,xml.etree.ElementTree as ET
path,wanted=sys.argv[1:]
try:
    root=ET.parse(path).getroot()
except Exception:
    raise SystemExit(0)
for node in root.iter('node'):
    text=(node.attrib.get('text') or '')
    rid=(node.attrib.get('resource-id') or '')
    desc=(node.attrib.get('content-desc') or '')
    if wanted.lower() not in (text+' '+rid+' '+desc).lower():
        continue
    m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds',''))
    if m:
        x1,y1,x2,y2=map(int,m.groups())
        print((x1+x2)//2,(y1+y2)//2)
        break
PY
    adb shell input tap "$x" "$y" >/dev/null 2>&1 || true
    return 0
  done
  return 1
}

recover_emulator_system_dialogs(){
  local xml="$OUT/fightai-home.xml"
  for attempt in 1 2 3 4; do
    # Hosted Android 35 occasionally surfaces system-process crash dialogs on
    # top of the app (observed: Bluetooth keeps stopping, System UI ANR). Dismiss
    # only system dialogs, then relaunch Fight AI and require its UI to render.
    if grep -Eqi "keeps stopping|isn.t responding|android:id/aerr_(close|wait)|com.android.systemui|com.android.bluetooth|Bluetooth" "$xml" 2>/dev/null; then
      log "INFO: emulator system crash/ANR dialog detected; dismissing and retrying Fight AI (attempt $attempt/4)"
      click_xml_text "Close app" || click_xml_text "Wait" || click_xml_text "Cerrar app" || click_xml_text "Esperar" || adb shell input keyevent 4 >/dev/null 2>&1 || true
      sleep 4
      launch_app
      sleep 8
      adb exec-out screencap -p > "$OUT/01-home-retry-$attempt.png" || true
      adb logcat -d > "$OUT/logcat-home.txt" || true
      capture_hierarchy || true
      continue
    fi
    return 0
  done
  if grep -Eqi "keeps stopping|isn.t responding|android:id/aerr_(close|wait)|com.android.systemui|com.android.bluetooth|Bluetooth" "$xml" 2>/dev/null; then
    log "FAIL: emulator system crash/ANR dialog remained after recovery retries"
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

recover_emulator_system_dialogs

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
