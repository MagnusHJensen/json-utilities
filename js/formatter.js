// JSON Formatter functionality

import { dom } from './dom.js';
import { state } from './state.js';
import { highlightJSON, computeLineColumn, copyToClipboard, showTemporaryMessage } from './utils.js';

export function showFormatterError(message) {
  dom.formatterError.textContent = message;
  dom.formatterInput.classList.add("invalid-input");
  dom.formatterOutput.innerHTML = "";
}

export function clearFormatterError() {
  dom.formatterError.textContent = "";
  dom.formatterInput.classList.remove("invalid-input");
}

export function updateFormatterOutput(value) {
  dom.formatterOutput.innerHTML = value ? highlightJSON(value) : "";
}

export function formatFormatterInput(trigger = "auto") {
  const raw = dom.formatterInput.value;
  if (!raw.trim()) {
    clearFormatterError();
    updateFormatterOutput("");
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const formatted = JSON.stringify(parsed, null, 2);
    clearFormatterError();
    updateFormatterOutput(formatted);
    if (trigger === "manual") {
      dom.formatterError.textContent = "Formatted successfully.";
    }
  } catch (error) {
    const match = /position (\d+)/.exec(error.message);
    if (match) {
      const position = Number(match[1]);
      const { line, column } = computeLineColumn(position, raw);
      showFormatterError(`Error at line ${line}, column ${column}: ${error.message}`);
    } else {
      showFormatterError(error.message);
    }
  }
}

export function debounceFormatter() {
  clearTimeout(state.formatterDebounce);
  state.formatterDebounce = window.setTimeout(() => formatFormatterInput("auto"), 350);
}

export function handleClearFormatter() {
  dom.formatterInput.value = "";
  updateFormatterOutput("");
  clearFormatterError();
}

export function showStatus(target, message, variant = "info") {
  if (target === "formatter") {
    dom.formatterError.textContent = message;
    if (variant === "error") {
      dom.formatterInput.classList.add("invalid-input");
    } else {
      dom.formatterInput.classList.remove("invalid-input");
    }
    return;
  }
  dom.schemaStatus.textContent = message;
  dom.schemaStatus.classList.remove("loading", "error", "success");
  if (variant === "loading") dom.schemaStatus.classList.add("loading");
  if (variant === "error") dom.schemaStatus.classList.add("error");
  if (variant === "success") dom.schemaStatus.classList.add("success");
}

export function handleFormatterCopy() {
  const text = dom.formatterOutput.textContent.trim();
  if (!text) {
    showStatus("formatter", "Nothing to copy.", "error");
    return;
  }
  copyToClipboard(text)
    .then(() => showTemporaryMessage("Copied formatted JSON to clipboard.", "success"))
    .catch(() => { });
}