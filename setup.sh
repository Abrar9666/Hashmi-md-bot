#!/bin/bash
set -e
echo "HASHMI-MD: code package khol rahe hain..."
cat payload/chunk-*.txt | base64 -d | tar xz
rm -rf payload
echo "HASHMI-MD: npm install chal raha hai..."
npm install
echo "HASHMI-MD: setup mukammal."
