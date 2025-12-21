# Helper Scripts

Convenient shell scripts for common development tasks.

## Available Scripts

### Quality Checks

#### `./scripts/check.sh`

Run all quality checks (format check, linting, and tests).

**What it does:**

1. Checks Python formatting with Ruff
2. Checks JavaScript/CSS/HTML formatting with Prettier
3. Runs Python linter (Ruff)
4. Runs JavaScript linter (ESLint)
5. Runs all Python tests (pytest)
6. Runs all JavaScript tests (Jest)

**Use this before committing code.**

---

#### `./scripts/check-fix.sh`

Auto-fix everything and run tests.

**What it does:**

1. Formats Python code with Ruff
2. Formats JavaScript/CSS/HTML with Prettier
3. Auto-fixes Python linting issues with Ruff
4. Auto-fixes JavaScript linting issues with ESLint
5. Runs all Python tests (pytest)
6. Runs all JavaScript tests (Jest)

**Use this to fix all issues automatically.**

---

#### `./scripts/lint.sh`

Check for linting issues without fixing them.

**What it does:**

- Runs `uv run ruff check` (Python)
- Runs `npx eslint .` (JavaScript)

**Use this to see what needs fixing.**

---

#### `./scripts/lint-fix.sh`

Auto-fix linting issues.

**What it does:**

- Runs `uv run ruff check --fix` (Python)
- Runs `npx eslint . --fix` (JavaScript)

**Use this to automatically fix fixable linting issues.**

---

#### `./scripts/format.sh`

Format all code.

**What it does:**

- Runs `uv run ruff format` (Python)
- Runs `npx prettier --write .` (JavaScript/CSS/HTML)

**Use this to format your code.**

---

### Testing

#### `./scripts/test.sh`

Run all tests.

**What it does:**

- Runs `pytest` (Python tests - 90 tests)
- Runs `npm test` (JavaScript tests - 140 tests)

**Use this to run the full test suite.**

---

### Server

#### `./scripts/run-server.sh`

Run the FastAPI server.

**Usage:**

```bash
./scripts/run-server.sh /path/to/dataset
```


---

## Workflow Recommendations

### Before Committing

```bash
# Check everything (recommended for CI/CD and pre-commit hooks)
./scripts/check.sh
```

This runs all checks without modifying code. Perfect for verifying everything is ready to commit.

### Quick Fix Everything

```bash
# Auto-fix all issues and run tests
./scripts/check-fix.sh
```

This is the easiest way to fix all formatting and linting issues, then verify with tests.

### During Development

```bash
# Fix linting issues only
./scripts/lint-fix.sh

# Format code only
./scripts/format.sh

# Run tests only
./scripts/test.sh
```

Use these for targeted fixes during development.

---

## Script Exit Codes

All scripts exit with:

- `0` if successful
- Non-zero if any check fails

This makes them suitable for CI/CD pipelines.
