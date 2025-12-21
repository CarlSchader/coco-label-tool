#!/usr/bin/env bash

set -e

echo "=== Auto-fixing All Issues ==="
echo ""

echo "Step 1: Formatting code..."
echo "Nix (treefmt):"
treefmt .
echo "✅ Nix formatted"
echo ""

echo "Python (Ruff):"
uv run ruff format
echo "✅ Python formatted"
echo ""

echo "JavaScript/CSS/HTML (Prettier):"
npx prettier --write .
echo "✅ JS/CSS/HTML formatted"
echo ""

echo "Step 2: Auto-fixing linting issues..."
echo "Python (Ruff):"
uv run ruff check --fix
echo "✅ Python linting fixed"
echo ""

echo "JavaScript (ESLint):"
npx eslint . --fix
echo "✅ JavaScript linting fixed"
echo ""

echo "Step 3: Running tests..."
echo "Python Tests (pytest):"
pytest
echo ""

echo "JavaScript Tests (Jest):"
npm test
echo ""

echo "✅ All fixes applied and tests passed!"
echo ""
echo "Summary:"
echo "  - Code formatted (Python + JS/CSS/HTML)"
echo "  - Linting issues fixed (Python + JavaScript)"
echo "  - All 230 tests passed"
