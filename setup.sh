#!/bin/bash
set -e
echo "HASHMI-MD: code package khol rahe hain..."
if [ -d payload ]; then cat payload/chunk-*.txt | base64 -d | tar xz; fi
if [ -d patches ]; then cp -a patches/. . ; echo "HASHMI-MD: patches lag gaye."; fi
rm -rf payload
rm -f package-lock.json
echo "HASHMI-MD: npm install chal raha hai..."
npm install
echo "HASHMI-MD: pairing library (stock Baileys) laga rahe hain..."
npm install --no-save --legacy-peer-deps "baileys-stock@npm:@whiskeysockets/baileys@^6.7.18"
echo "HASHMI-MD: setup mukammal."
