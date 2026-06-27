#!/data/data/com.termux/files/usr/bin/bash

cd ~/travel-system

pkill node
pkill cloudflared

npm start &

sleep 6

cloudflared tunnel --url http://localhost:5000
