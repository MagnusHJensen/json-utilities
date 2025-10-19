// Main application initialization
import { dom } from './js/dom.js';
import { state, setActiveTool, initializeFromURL } from './js/state.js';
import {
  debounceFormatter,
  formatFormatterInput,
  handleClearFormatter,
  handleFormatterCopy
} from './js/formatter.js';
import {
  handleSchemaLoad,
  handleSchemaPaste,
  handleSchemaChange,
  handleSchemaResetValues,
  handleSchemaCopy,
  handleSchemaShare,
  setSchemaLoaded,
  updateSchemaOutput
} from './js/schema.js';
import { handleThemeToggle, getThemeFromCookie, setTheme } from './js/theme.js';

// Keyboard shortcuts
function handleKeyboardShortcuts(event) {
  const isModifier = event.ctrlKey || event.metaKey;
  if (!isModifier) return;

  if (event.key === "Enter") {
    event.preventDefault();
    if (state.activeTool === "formatter") {
      formatFormatterInput("manual");
    } else if (state.activeTool === "schema") {
      updateSchemaOutput();
    }
  }

  if (event.shiftKey && (event.key.toLowerCase() === "c")) {
    event.preventDefault();
    if (state.activeTool === "formatter") {
      handleFormatterCopy();
    } else {
      handleSchemaCopy();
    }
  }

  if (event.shiftKey && (event.key.toLowerCase() === "l")) {
    event.preventDefault();
    if (state.activeTool === "formatter") {
      handleClearFormatter();
    } else {
      handleSchemaResetValues();
    }
  }
}

// Copy handler
function handleCopy(event) {
  const target = event.currentTarget.dataset.copyTarget;
  if (target === "formatter") {
    handleFormatterCopy();
    return;
  }
  if (target === "schema") {
    handleSchemaCopy();
    return;
  }
}

// Initialize application
function init() {
  console.log("Initializing JSON Tools application...");

  // Initialize from URL
  initializeFromURL();

  const savedTheme = getThemeFromCookie();
  if (savedTheme) {
    setTheme(savedTheme);
  }

  // Tool switching
  dom.toolButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTool(button.dataset.tool));
  });

  // Formatter events
  dom.formatterInput.addEventListener("input", debounceFormatter);
  dom.formatterFormatBtn.addEventListener("click", () => formatFormatterInput("manual"));
  dom.formatterCopyBtn.addEventListener("click", handleCopy);
  dom.formatterClearBtn.addEventListener("click", handleClearFormatter);

  // Schema events
  dom.schemaLoadBtn.addEventListener("click", handleSchemaLoad);
  dom.schemaUsePasteBtn.addEventListener("click", handleSchemaPaste);
  dom.schemaChangeBtn.addEventListener("click", handleSchemaChange);
  dom.schemaShareBtn.addEventListener("click", handleSchemaShare);
  dom.schemaResetValuesBtn.addEventListener("click", handleSchemaResetValues);
  dom.schemaCopyBtn.addEventListener("click", handleCopy);

  // Theme toggle
  dom.themeToggle.addEventListener("click", handleThemeToggle);

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyboardShortcuts);

  // Set initial schema state
  setSchemaLoaded(false);

  console.log("JSON Tools application initialized successfully");
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
