#!/usr/bin/env bash

echo "Auto-fixing Nix (treefmt)..."
treefmt .

echo "Auto-fixing Python (Ruff)..."
uv run ruff check --fix

echo ""
echo "Auto-fixing JavaScript (ESLint)..."
npx eslint . --fix

echo ""
echo "✅ Auto-fix complete"
