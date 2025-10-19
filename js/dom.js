// DOM element references and utilities

export const dom = {
  toolButtons: document.querySelectorAll("[data-tool]"),
  toolPanels: {
    formatter: document.getElementById("panel-formatter"),
    schema: document.getElementById("panel-schema"),
  },
  outputWrappers: {
    formatter: document.getElementById("formatter-output-wrapper"),
    schema: document.getElementById("schema-output-wrapper"),
  },
  formatterInput: document.getElementById("formatter-input"),
  formatterOutput: document.getElementById("formatter-output"),
  formatterError: document.getElementById("formatter-error"),
  formatterFormatBtn: document.getElementById("formatter-format"),
  formatterCopyBtn: document.getElementById("formatter-copy"),
  formatterClearBtn: document.getElementById("formatter-clear"),
  themeToggle: document.getElementById("theme-toggle"),
  schemaUrl: document.getElementById("schema-url"),
  schemaRaw: document.getElementById("schema-raw"),
  schemaLoadBtn: document.getElementById("schema-load"),
  schemaUsePasteBtn: document.getElementById("schema-use-paste"),
  schemaChangeBtn: document.getElementById("schema-change"),
  schemaShareBtn: document.getElementById("schema-share"),
  schemaResetValuesBtn: document.getElementById("schema-reset-values"),
  schemaCopyBtn: document.getElementById("schema-copy"),
  schemaStatus: document.getElementById("schema-status"),
  schemaForm: document.getElementById("schema-form"),
  schemaOutput: document.getElementById("schema-output"),
  schemaValidation: document.getElementById("schema-validation"),
  schemaConfig: document.getElementById("schema-config"),
};

export function getOneOfContainer(path) {
  return Array.from(dom.schemaForm.querySelectorAll("[data-one-of-path]")).find(
    (node) => node.dataset.oneOfPath === path
  );
}

export function getArrayContainer(path) {
  return Array.from(dom.schemaForm.querySelectorAll("[data-array-path]")).find(
    (node) => node.dataset.arrayPath === path
  );
}