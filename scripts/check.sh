#!/usr/bin/env bash
set -e

echo "=== Running Format Check ==="
echo "Python (Ruff):"
if ! uv run ruff format --check; then
    echo ""
    echo "❌ Python formatting issues found. Run: ./scripts/format.sh"
    exit 1
fi
echo "✅ Python code properly formatted"
echo ""

echo "JavaScript/CSS/HTML (Prettier):"
if ! npx prettier --check .; then
    echo ""
    echo "❌ JS/CSS/HTML formatting issues found. Run: ./scripts/format.sh"
    exit 1
fi
echo "✅ All JS/CSS/HTML files properly formatted"
echo ""

echo "=== Running Linters ==="
if ! bash ./scripts/lint.sh; then
    echo ""
    echo "❌ Linting issues found. Run: ./scripts/lint-fix.sh"
    exit 1
fi
echo "✅ No linting issues"
echo ""

echo "=== Running Tests ==="
if ! bash ./scripts/test.sh; then
    echo ""
    echo "❌ Tests failed"
    exit 1
fi
echo ""
echo "✅ All checks passed!"
