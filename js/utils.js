// Utility functions

export function getSingularForm(word) {
  if (!word) return "item";

  // Simple pluralization rules for common cases
  const lowerWord = word.toLowerCase();

  if (lowerWord.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  } else if (lowerWord.endsWith('ves')) {
    return word.slice(0, -3) + 'f';
  } else if (lowerWord.endsWith('ses') || lowerWord.endsWith('xes') || lowerWord.endsWith('zes') || lowerWord.endsWith('ches') || lowerWord.endsWith('shes')) {
    return word.slice(0, -2);
  } else if (lowerWord.endsWith('s') && !lowerWord.endsWith('ss')) {
    return word.slice(0, -1);
  }

  // If no plural pattern detected, return as-is
  return word;
}

export function highlightJSON(json) {
  const escaped = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "key" : "string";
      } else if (/true|false/.test(match)) {
        cls = "boolean";
      } else if (/null/.test(match)) {
        cls = "null";
      }
      return `<span class="token ${cls}">${match}</span>`;
    }
  );
}

export function computeLineColumn(position, text) {
  const upToPosition = text.slice(0, position);
  const lines = upToPosition.split(/\r?\n/);
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}


export function copyToClipboard(text, label, showStatusCallback) {
  if (!navigator.clipboard) {
    return Promise.reject(new Error("Clipboard API unavailable"));
  }
  return navigator.clipboard.writeText(text).then(
    () => showStatusCallback != null && showStatusCallback(label, "Copied to clipboard.", "success"),
    () => showStatusCallback != null && showStatusCallback(label, "Copy failed. Copy manually instead.", "error")
  );
}

export function fieldId(path) {
  return `field-${path.replace(/[^a-z0-9]+/gi, "-")}`;
}

export function stringifySchemaValue(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

export function addSchemaMessage(container, message, variant) {
  const note = document.createElement("p");
  note.className = `helper-text ${variant || ""}`;
  note.textContent = message;
  container.appendChild(note);
}