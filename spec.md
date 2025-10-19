Website Specification: JSON Tools Platform

1. Purpose & Scope
   A lightweight web app for formatting, validating, and creating JSON documents — starting with a JSON prettifier and later expanding to schema-based JSON building.

2. Tech Stack
   Pure HTML, CSS, and vanilla JavaScript (no framework). Optional: small libraries for syntax highlighting and schema validation (e.g., ajv).

3. Core Tool #1: JSON Formatter
   Accepts raw JSON input, automatically prettifies with indentation, syntax highlighting, and inline error detection.

4. Core Tool #2: Schema-Based Editor
   Allows users to paste a JSON Schema URL; dynamically generates input fields and validates the JSON structure live as the user edits.

5. Validation & Error Handling
   Real-time feedback for both malformed JSON and schema violations, using clear, human-friendly error messages.

6. UI Design
   Clean, minimal, and distraction-free layout — two main panes (editor + output/preview) with subtle separators and light/dark mode toggle.

7. Performance & Simplicity
   Loads instantly; all validation and formatting happen client-side (no server round trips). Built to work offline via local scripts.

8. Extensibility
   Modular structure so new tools (e.g., JSON → YAML converter, JSON diff) can be added later without major refactor.

9. Accessibility & Usability
   Keyboard shortcuts (format, copy, clear), responsive layout, and ARIA-labeled controls for screen reader support.

10. Deployment & Hosting
    Single-page static site, deployable on GitHub Pages, Cloudflare Pages, or Netlify. No backend dependencies.
