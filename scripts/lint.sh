#!/bin/bash

echo "Python (Ruff):"
uv run ruff check

echo ""
echo "JavaScript (ESLint):"
npx eslint .
