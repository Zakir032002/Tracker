#!/bin/sh
# Copies the shared theme tokens, panel styles and fonts into extension/ so it works standalone.
set -e
cd "$(dirname "$0")/.."
cp css/theme.css css/rose.css css/pin.css extension/css/
cp assets/fonts/*.woff2 extension/assets/fonts/
