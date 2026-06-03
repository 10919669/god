#!/bin/bash
# God Project Deployment Script
# Usage: ./deploy-god.sh

SERVER="awkn@39.105.98.49"
REMOTE_DIR="/www/wwwlogs/awkn/god"
LOCAL_DIR="$(dirname "$0")"

echo "Deploying to $SERVER:$REMOTE_DIR..."

# Deploy all files
scp -o ConnectTimeout=30 /
    "$LOCAL_DIR/index.html" /
    "$LOCAL_DIR/css/style.css" /
    "$LOCAL_DIR/js/app.js" /
    "$LOCAL_DIR/js/share.js" /
    "$LOCAL_DIR/js/classic-bridge.js" /
    "$LOCAL_DIR/js/decision-engine.js" /
    "$LOCAL_DIR/js/liuren-engine.js" /
    "$LOCAL_DIR/js/particles.js" /
    "$LOCAL_DIR/assets/"* /
    "$SERVER:$REMOTE_DIR/"

if [ $? -eq 0 ]; then
    echo "Deployment successful!"
else
    echo "Deployment failed. Check SSH connection."
fi
