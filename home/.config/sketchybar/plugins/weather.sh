#!/usr/bin/env bash

LOCATION="Gifu"
UNITS="m"
LANG="ja"
TIMEOUT=10
MAX_RETRIES=2
CACHE_FILE="/tmp/sketchybar_weather_${LOCATION}.cache"

fetch_weather() {
  local retry=0
  
  while [ $retry -le $MAX_RETRIES ]; do
    ICON=$(curl -s --max-time $TIMEOUT --connect-timeout 5 -w "\n%{http_code}" "https://wttr.in/${LOCATION}?format=%c&${UNITS}&lang=${LANG}" | tail -2)
    HTTP_CODE=$(echo "$ICON" | tail -1)
    ICON=$(echo "$ICON" | head -1)
    
    if [ "$HTTP_CODE" = "200" ] && [ -n "$ICON" ]; then
      DATA=$(curl -s --max-time $TIMEOUT --connect-timeout 5 "https://wttr.in/${LOCATION}?format=%t+%C&${UNITS}&lang=${LANG}")
      if [ -n "$DATA" ]; then
        echo "${ICON}|${DATA}"
        return 0
      fi
    fi
    
    retry=$((retry + 1))
    if [ $retry -le $MAX_RETRIES ]; then
      sleep 1
    fi
  done
  
  return 1
}

RESULT=$(fetch_weather)

if [ $? -eq 0 ]; then
  ICON=$(echo "$RESULT" | cut -d'|' -f1)
  DATA=$(echo "$RESULT" | cut -d'|' -f2)
  
  TEMP=$(echo "$DATA" | awk '{print $1}')
  TEMP=${TEMP#+}
  COND=$(echo "$DATA" | cut -d' ' -f2-)
  
  DISPLAY="${ICON}${LOCATION} ${TEMP} ${COND}"
  echo "${ICON}|${DATA}" > "$CACHE_FILE"
else
  if [ -f "$CACHE_FILE" ]; then
    RESULT=$(cat "$CACHE_FILE")
    ICON=$(echo "$RESULT" | cut -d'|' -f1)
    DATA=$(echo "$RESULT" | cut -d'|' -f2)
    
    TEMP=$(echo "$DATA" | awk '{print $1}')
    TEMP=${TEMP#+}
    COND=$(echo "$DATA" | cut -d' ' -f2-)
    
    DISPLAY="⚠️ ${ICON}${LOCATION} ${TEMP} ${COND}"
  else
    DISPLAY="⚠️ $LOCATION"
  fi
fi

sketchybar --set "$NAME" label="$DISPLAY"
