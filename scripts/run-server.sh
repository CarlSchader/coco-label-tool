#!/usr/bin/env bash

if [ -z "$1" ]; then
    echo "Usage: ./run-server.sh /path/to/dataset.json"
    exit 1
fi

export DATASET_PATH="$1"

echo "Starting Label Tool server..."
echo "COCO JSON file: $DATASET_PATH"
echo "Server will be available at http://localhost:8000"
echo ""

python server.py $DATASET_PATH
