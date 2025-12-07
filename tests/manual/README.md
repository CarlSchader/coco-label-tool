# Manual Test Files

This directory contains HTML files for manual testing of UI components and features that are difficult to test with automated tests.

## Files

### test_model_switching.html

Tests the model type switching functionality (SAM2 ↔ SAM3).

**Purpose:** Verify that:

- Model type dropdown works
- Model size dropdown updates when switching types
- API endpoints respond correctly
- Display names are formatted properly

**How to use:**

1. Start the server: `python server.py` (from project root)
2. Open in browser: http://localhost:8000/tests/manual/test_model_switching.html
3. Watch the log output as you switch between SAM2 and SAM3
4. Verify dropdown updates correctly

**Note:** This requires the server to be running since it makes API calls.

---

### test-mobile-nav.html

Tests mobile navigation UI components.

**Purpose:** Verify mobile-specific navigation elements work correctly.

**How to use:**

1. Open file directly in browser (no server required)
2. Test on mobile device or use browser dev tools mobile emulation
3. Verify touch interactions and responsive layout

---

### test-responsive-layout.html

Tests responsive layout across different screen sizes.

**Purpose:** Verify that:

- Layout adapts to different screen sizes
- Controls remain accessible on small screens
- Text is readable at all sizes

**How to use:**

1. Open file directly in browser (no server required)
2. Resize browser window or use responsive design mode
3. Verify layout works at mobile, tablet, and desktop sizes

## Running Manual Tests

Most files can be opened directly, but some (like `test_model_switching.html`) require the server:

```bash
# From project root
python server.py

# Then navigate to:
# http://localhost:8000/tests/manual/<filename>.html
```

## When to Create Manual Tests

Create manual test files when:

- Testing requires visual verification
- Testing real API interactions with the server
- Testing touch/gesture interactions
- Testing responsive design at various sizes
- Automated tests would be too complex or brittle

## Guidelines

- Use descriptive filenames: `test-<feature>.html`
- Include inline styles (no external CSS dependencies)
- Add console logging for debugging
- Document expected behavior in the file
- Keep files self-contained when possible
