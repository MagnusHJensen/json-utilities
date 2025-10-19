// Schema editor functionality

import { dom, getOneOfContainer, getArrayContainer } from './dom.js';
import { state, updateURL } from './state.js';
import {
  getSingularForm,
  highlightJSON,
  copyToClipboard,
  fieldId,
  stringifySchemaValue,
  addSchemaMessage,
  showTemporaryMessage
} from './utils.js';
import { showStatus } from './formatter.js';

// Initialize AJV
export const ajv = window.ajv2020
  ? new window.ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  })
  : null;

export function setSchemaLoaded(isLoaded) {
  dom.schemaConfig.classList.toggle("collapsed", isLoaded);
  dom.schemaChangeBtn.classList.toggle("hidden", !isLoaded);
  dom.schemaResetValuesBtn.classList.toggle("hidden", !isLoaded);
  if (!isLoaded) {
    dom.schemaStatus.classList.remove("loading", "error", "success");
  }
}

export function resolveSchema(schema, seen = new Set()) {
  if (schema === true) {
    return {};
  }
  if (schema === false) {
    return { __alwaysInvalid: true };
  }
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  if (!schema.$ref) {
    return schema;
  }
  if (!state.schema) {
    return schema;
  }
  const ref = schema.$ref;
  if (seen.has(ref)) {
    return { __circularRef: true, description: schema.description };
  }
  const resolved = resolveRef(ref);
  if (!resolved) {
    return { __unresolvedRef: ref, description: schema.description };
  }
  seen.add(ref);
  const { $ref, ...rest } = schema;
  const merged = { ...resolved, ...rest };
  delete merged.$ref;
  return resolveSchema(merged, seen);
}

export function resolveRef(ref) {
  if (!ref || typeof ref !== "string") {
    return null;
  }
  if (!ref.startsWith("#")) {
    return null;
  }
  if (ref === "#") {
    return state.schema;
  }
  if (!ref.startsWith("#/")) {
    return null;
  }
  const path = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  return path.reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : null), state.schema);
}

export function parseSchemaText(text) {
  if (!text.trim()) {
    throw new Error("Schema text is empty.");
  }
  return JSON.parse(text);
}

export async function handleSchemaLoad() {
  const url = dom.schemaUrl.value.trim();
  if (!url) {
    showStatus("schema", "Enter a schema URL first.", "error");
    return;
  }
  showStatus("schema", "Loading schema…", "loading");
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load schema (status ${response.status}).`);
    }
    const schema = await response.json();

    // Track that this schema is from URL
    state.schemaFromUrl = true;
    state.currentSchemaUrl = url;

    applySchema(schema, `Loaded schema from ${url}.`);

    // Update URL with schema parameter
    updateURL(state.activeTool, url);

    // Show share button
    dom.schemaShareBtn.classList.remove("hidden");
  } catch (error) {
    showStatus("schema", error.message, "error");
  }
}

export function handleSchemaPaste() {
  try {
    const schema = parseSchemaText(dom.schemaRaw.value);

    // Track that this schema is NOT from URL
    state.schemaFromUrl = false;
    state.currentSchemaUrl = null;

    applySchema(schema, "Schema parsed successfully.");

    // Update URL to remove schema parameter
    updateURL(state.activeTool);

    // Hide share button
    dom.schemaShareBtn.classList.add("hidden");
  } catch (error) {
    showStatus("schema", `Schema parse error: ${error.message}`, "error");
  }
}

export async function handleSchemaShare() {
  if (!state.schemaFromUrl || !state.currentSchemaUrl) {
    showStatus("schema", "Share is only available for URL-based schemas.", "error");
    return;
  }

  try {
    const currentUrl = window.location.href;
    await copyToClipboard(currentUrl);

    // Show temporary success message
    showTemporaryMessage("URL copied to clipboard! Anyone with this link can access the same schema.", "success");
  } catch (error) {
    console.error("Failed to copy URL to clipboard:", error);
    showStatus("schema", "Failed to copy URL to clipboard.", "error");
  }
}



export function handleSchemaChange() {
  dom.schemaForm.innerHTML = "";
  dom.schemaOutput.innerHTML = "";
  dom.schemaValidation.textContent = "";
  dom.schemaUrl.value = "";
  dom.schemaRaw.value = "";
  state.schema = null;
  state.validator = null;

  // Reset share state
  state.schemaFromUrl = false;
  state.currentSchemaUrl = null;
  dom.schemaShareBtn.classList.add("hidden");

  // Update URL to remove schema parameter
  updateURL(state.activeTool);

  setSchemaLoaded(false);
  showStatus("schema", "Schema cleared. Load or paste a new schema to begin.", "success");
}

export function handleSchemaResetValues() {
  if (!state.schema) {
    showStatus("schema", "Load a schema first.", "error");
    return;
  }
  renderSchemaForm(state.schema);
  updateSchemaOutput();
  showStatus("schema", "Cleared values for the current schema.", "success");
}

export function handleSchemaCopy() {
  if (!state.schema) {
    showStatus("schema", "Load a schema first.", "error");
    return;
  }
  const text = dom.schemaOutput.textContent.trim();
  if (!text) {
    showStatus("schema", "Fill some values before copying.", "error");
    return;
  }
  copyToClipboard(text).catch(() => { });
  showTemporaryMessage("Copied output to clipboard!", "success");
}

export function applySchema(schema, successMessage) {
  state.schema = schema;
  state.validator = null;
  let statusText = successMessage;
  let statusVariant = "success";
  if (ajv) {
    try {
      state.validator = ajv.compile(schema);
    } catch (compileError) {
      console.warn("AJV failed to compile schema:", compileError);
      statusText = `Schema loaded but validation limited: ${compileError.message}`;
      statusVariant = "error";
    }
  }
  setSchemaLoaded(true);
  renderSchemaForm(schema);
  showStatus("schema", statusText, statusVariant);
  updateSchemaOutput();
}

export function renderSchemaForm(schema) {
  dom.schemaForm.innerHTML = "";
  const effective = resolveSchema(schema);
  if (!effective || typeof effective !== "object") {
    dom.schemaForm.textContent = "Unsupported schema format.";
    return;
  }
  if (effective.__alwaysInvalid) {
    dom.schemaForm.textContent = "This schema is defined as 'false' and cannot produce any valid JSON.";
    return;
  }
  if (effective.__unresolvedRef) {
    dom.schemaForm.textContent = `Could not resolve reference ${effective.__unresolvedRef}.`;
    return;
  }
  if (effective.__circularRef) {
    dom.schemaForm.textContent = "Circular $ref detected; unable to build this section automatically.";
    return;
  }
  const root = document.createElement("div");
  root.className = "schema-fieldset";
  if (effective.title) {
    const title = document.createElement("h3");
    title.textContent = effective.title;
    root.appendChild(title);
  }
  const description = effective.description || "Fill the fields to build JSON that matches the schema.";
  const desc = document.createElement("p");
  desc.className = "helper-text";
  desc.textContent = description;
  root.appendChild(desc);
  buildFields(effective, "root", root, { required: effective.required || [] });
  dom.schemaForm.appendChild(root);
}

function buildFields(schema, path, container, context) {
  if (!schema) return;
  const effective = resolveSchema(schema);
  if (!effective) {
    return;
  }
  if (effective.__alwaysInvalid) {
    addSchemaMessage(container, "This part of the schema is defined as 'false' and accepts no values.", "error");
    return;
  }
  if (effective.__unresolvedRef) {
    addSchemaMessage(container, `Could not resolve reference ${effective.__unresolvedRef}.`, "error");
    return;
  }
  if (effective.__circularRef) {
    addSchemaMessage(container, "Circular $ref detected; cannot expand this branch.", "error");
    return;
  }
  if (Array.isArray(effective.oneOf) && effective.oneOf.length) {
    createOneOfField(effective, path, container, false);
    return;
  }
  if (effective.anyOf || effective.allOf) {
    addSchemaMessage(container, "Combined schemas (anyOf/allOf) are not supported in this editor.", "error");
    return;
  }
  const type = getSchemaType(effective);
  if (type === "object" || (!type && effective.properties)) {
    const properties = effective.properties || {};
    const required = effective.required || [];
    Object.entries(properties).forEach(([key, childSchema]) => {
      const fieldPath = path === "root" ? key : `${path}.${key}`;
      const field = document.createElement("div");
      field.className = "schema-field";
      const isRequired = required.includes(key);
      const label = document.createElement("label");
      label.setAttribute("for", fieldId(fieldPath));
      label.textContent = `${key}${isRequired ? " *" : ""}`;
      field.appendChild(label);
      const childEffective = resolveSchema(childSchema);
      if (childEffective && childEffective.description) {
        const hint = document.createElement("p");
        hint.className = "helper-text";
        hint.textContent = childEffective.description;
        field.appendChild(hint);
      }
      createControlForSchema(childSchema, fieldPath, field, isRequired);
      container.appendChild(field);
    });
    return;
  }
  createControlForSchema(effective, path, container, context?.required?.includes(path));
}

function createControlForSchema(schema, path, container, isRequired) {
  const effective = resolveSchema(schema);
  if (!effective) return;
  if (effective.__alwaysInvalid) {
    addSchemaMessage(container, "This section of the schema accepts no values.", "error");
    return;
  }
  if (effective.__unresolvedRef) {
    addSchemaMessage(container, `Could not resolve reference ${effective.__unresolvedRef}.`, "error");
    return;
  }
  if (effective.__circularRef) {
    addSchemaMessage(container, "Circular $ref detected; cannot expand this branch.", "error");
    return;
  }
  if (Array.isArray(effective.oneOf) && effective.oneOf.length) {
    createOneOfField(effective, path, container, isRequired);
    return;
  }
  const type = getSchemaType(effective);
  if (type === "object" || (!type && effective.properties)) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "schema-fieldset";
    fieldset.dataset.schemaPath = path;
    const legend = document.createElement("legend");
    legend.textContent = effective.title || path.split(".").slice(-1)[0] || "object";
    fieldset.appendChild(legend);
    const required = effective.required || [];
    buildFields(effective, path, fieldset, { required });
    container.appendChild(fieldset);
    return;
  }
  if (type === "array") {
    createArrayField(effective, path, container, isRequired);
    return;
  }
  const controlWrapper = createPrimitiveField(effective, path, isRequired);
  if (path === "root") {
    const field = document.createElement("div");
    field.className = "schema-field";
    const label = document.createElement("label");
    label.setAttribute("for", fieldId(path));
    label.textContent = effective.title || "Value";
    field.appendChild(label);
    field.appendChild(controlWrapper);
    container.appendChild(field);
    return;
  }
  container.appendChild(controlWrapper);
}

function createOneOfField(schema, path, container, isRequired = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "schema-oneof";
  if (schema.description) {
    const hint = document.createElement("p");
    hint.className = "helper-text";
    hint.textContent = schema.description;
    wrapper.appendChild(hint);
  }
  const selector = document.createElement("select");
  selector.className = "schema-oneof-select";
  schema.oneOf.forEach((option, idx) => {
    const label = getOneOfOptionLabel(option, idx);
    selector.appendChild(new Option(label, String(idx)));
  });
  const optionsContainer = document.createElement("div");
  optionsContainer.className = "schema-oneof-options";
  optionsContainer.dataset.oneOfPath = path;
  selector.addEventListener("change", () => {
    renderVariant(Number(selector.value));
    updateSchemaOutput();
  });
  wrapper.appendChild(selector);
  wrapper.appendChild(optionsContainer);
  container.appendChild(wrapper);
  renderVariant(0);

  function renderVariant(index) {
    const variant = schema.oneOf[index] || schema.oneOf[0];
    optionsContainer.innerHTML = "";
    optionsContainer.dataset.selectedVariant = String(index);
    selector.value = String(index);
    createControlForSchema(variant, path, optionsContainer, isRequired);
  }
}

function createPrimitiveField(schema, path, isRequired) {
  const wrapper = document.createElement("div");
  const fieldType = deducePrimitiveType(schema);
  const hasEnum = Array.isArray(schema.enum);
  const constValue = schema.const;
  const inputId = fieldId(path);
  let control;
  if (hasEnum) {
    control = document.createElement("select");
    control.appendChild(new Option("Select a value", ""));
    schema.enum.forEach((value) => {
      const optionValue = stringifySchemaValue(value);
      control.appendChild(new Option(optionValue, optionValue));
    });
    if (constValue !== undefined && !schema.enum.includes(constValue)) {
      const constString = stringifySchemaValue(constValue);
      control.appendChild(new Option(constString, constString));
    }
  } else if (fieldType === "boolean") {
    control = document.createElement("select");
    control.appendChild(new Option("Select true/false", ""));
    control.appendChild(new Option("true", "true"));
    control.appendChild(new Option("false", "false"));
  } else if (fieldType === "null") {
    control = document.createElement("select");
    control.appendChild(new Option("Select null", ""));
    control.appendChild(new Option("null", "null"));
  } else {
    control = document.createElement("input");
    control.type = fieldType === "number" || fieldType === "integer" ? "number" : "text";
    if (fieldType === "integer") {
      control.step = "1";
    }
    if (schema.pattern) {
      control.pattern = schema.pattern;
    }
    if (schema.minimum !== undefined) control.min = schema.minimum;
    if (schema.maximum !== undefined) control.max = schema.maximum;
  }
  control.id = inputId;
  control.dataset.schemaPath = path;
  control.dataset.schemaType = fieldType || "string";
  control.dataset.required = String(Boolean(isRequired));
  if (isRequired) {
    control.required = true;
  }
  control.addEventListener("input", updateSchemaOutput);
  control.addEventListener("change", updateSchemaOutput);
  if (constValue !== undefined) {
    const constDisplay = stringifySchemaValue(constValue);
    control.value = constDisplay;
    control.disabled = true;
    control.classList.add("const-input");
    control.title = "Constant value defined by schema";
  } else if (schema.default !== undefined) {
    let defaultValue = schema.default;
    if (typeof defaultValue === "object") {
      try {
        defaultValue = JSON.stringify(defaultValue);
      } catch {
        defaultValue = String(defaultValue);
      }
    }
    control.value = defaultValue;
  }
  wrapper.appendChild(control);
  return wrapper;
}

function createArrayField(schema, path, container, isRequired) {
  const wrapper = document.createElement("div");
  wrapper.className = "schema-field schema-array";
  const itemsContainer = document.createElement("div");
  itemsContainer.className = "array-items";
  itemsContainer.dataset.arrayPath = path;
  wrapper.appendChild(itemsContainer);
  const addButton = document.createElement("button");
  addButton.type = "button";

  // Create a more user-friendly button label based on the path
  const fieldName = path.split('.').pop().split('[')[0];
  const singularName = getSingularForm(fieldName);
  addButton.textContent = `Add ${singularName}`;

  addButton.classList.add("app-button", "secondary");
  addButton.addEventListener("click", () => {
    addArrayItem(itemsContainer, schema.items, path);
    updateSchemaOutput();
  });
  wrapper.appendChild(addButton);
  const initialItems = schema.minItems ? Math.min(schema.minItems, 5) : 0;
  for (let i = 0; i < initialItems; i += 1) {
    addArrayItem(itemsContainer, schema.items, path);
  }
  container.appendChild(wrapper);
}

function addArrayItem(container, itemSchema, path, value) {
  const existingItems = container.querySelectorAll(":scope > .array-item");
  const index = existingItems.length;
  const itemPath = `${path}[${index}]`;

  const itemWrapper = document.createElement("div");
  itemWrapper.className = "array-item";
  itemWrapper.dataset.schemaPath = itemPath;

  const effectiveItemSchema = resolveSchema(itemSchema);
  const itemType = getSchemaType(effectiveItemSchema);
  let body;
  if (effectiveItemSchema?.__alwaysInvalid) {
    body = document.createElement("p");
    body.className = "helper-text error";
    body.textContent = "Array item schema cannot be represented.";
  } else if (effectiveItemSchema?.__unresolvedRef) {
    body = document.createElement("p");
    body.className = "helper-text error";
    body.textContent = `Could not resolve reference ${effectiveItemSchema.__unresolvedRef}.`;
  } else if (itemType === "object" || (!itemType && effectiveItemSchema?.properties)) {
    body = document.createElement("div");
    createControlForSchema(effectiveItemSchema, itemPath, body, false);
  } else if (itemType === "array") {
    body = document.createElement("div");
    createControlForSchema(effectiveItemSchema, itemPath, body, false);
  } else {
    body = createPrimitiveField(
      { ...effectiveItemSchema, type: itemType || effectiveItemSchema?.type || "string" },
      itemPath,
      false
    );
    const control = body.querySelector("[data-schema-path]");
    if (value !== undefined && control) {
      control.value = value;
    }
  }
  const controls = document.createElement("div");
  controls.className = "array-item-controls";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.classList.add("app-button", "ghost", "small");
  removeBtn.addEventListener("click", () => {
    itemWrapper.remove();
    renumberArrayItems(container, path);
    updateSchemaOutput();
  });
  controls.appendChild(removeBtn);
  itemWrapper.appendChild(body);
  itemWrapper.appendChild(controls);
  container.appendChild(itemWrapper);
}

function renumberArrayItems(container, arrayPath) {
  const items = Array.from(container.querySelectorAll(":scope > .array-item"));

  items.forEach((item, newIndex) => {
    const oldPath = item.dataset.schemaPath;
    const newPath = `${arrayPath}[${newIndex}]`;

    item.dataset.schemaPath = newPath;

    const controlsInItem = item.querySelectorAll("[data-schema-path]");
    controlsInItem.forEach((control) => {
      const currentPath = control.dataset.schemaPath;
      if (!currentPath) return;

      if (currentPath === oldPath) {
        control.dataset.schemaPath = newPath;
      } else if (currentPath.startsWith(oldPath + ".")) {
        control.dataset.schemaPath = currentPath.replace(oldPath, newPath);
      } else if (currentPath.startsWith(oldPath + "[")) {
        control.dataset.schemaPath = currentPath.replace(oldPath, newPath);
      }
    });

    const arrayContainersInItem = item.querySelectorAll("[data-array-path]");
    arrayContainersInItem.forEach((container) => {
      const currentPath = container.dataset.arrayPath;
      if (!currentPath) return;

      if (currentPath.startsWith(oldPath + ".")) {
        container.dataset.arrayPath = currentPath.replace(oldPath, newPath);
      } else if (currentPath.startsWith(oldPath + "[")) {
        container.dataset.arrayPath = currentPath.replace(oldPath, newPath);
      }
    });

    const oneOfContainersInItem = item.querySelectorAll("[data-one-of-path]");
    oneOfContainersInItem.forEach((container) => {
      const currentPath = container.dataset.oneOfPath;
      if (!currentPath) return;

      if (currentPath.startsWith(oldPath + ".")) {
        container.dataset.oneOfPath = currentPath.replace(oldPath, newPath);
      } else if (currentPath.startsWith(oldPath + "[")) {
        container.dataset.oneOfPath = currentPath.replace(oldPath, newPath);
      }
    });
  });
}

function collectData(schema, path = "root") {
  if (!schema) return undefined;
  const effective = resolveSchema(schema);
  if (!effective) return undefined;
  if (effective.__alwaysInvalid) return undefined;
  if (Array.isArray(effective.oneOf) && effective.oneOf.length) {
    const variantContainer = getOneOfContainer(path);
    const selectedIndex = variantContainer
      ? Number(variantContainer.dataset.selectedVariant || "0")
      : 0;
    const variantSchema = effective.oneOf[selectedIndex] || effective.oneOf[0];
    return collectData(variantSchema, path);
  }
  const type = getSchemaType(effective);
  console.log("Type", type, effective)
  if (type === "object" || (!type && effective.properties)) {
    const properties = effective.properties || {};
    const result = {};
    let hasMeaningfulValue = false;

    Object.entries(properties).forEach(([key, childSchema]) => {
      const childPath = path === "root" ? key : `${path}.${key}`;
      const value = collectData(childSchema, childPath);

      if (value !== undefined) {
        // Check if this is a meaningful value (not just an empty string)
        const isMeaningful = !(typeof value === 'string' && value === '') &&
          !(Array.isArray(value) && value.length === 0) &&
          !(typeof value === 'object' && value !== null && Object.keys(value).length === 0);

        if (isMeaningful) {
          hasMeaningfulValue = true;
          result[key] = value;
        }
      }
    });

    if (path === "root") {
      return result;
    }

    // Only return the object if it has at least one meaningful value
    return hasMeaningfulValue ? result : undefined;
  }
  if (type === "array") {
    const itemsContainer = getArrayContainer(path);
    if (!itemsContainer) return path === "root" ? [] : undefined;
    const values = [];
    const itemsSchema = effective.items !== undefined ? effective.items : schema.items;
    // Use :scope > to only get direct children, avoiding nested array items
    const arrayItems = itemsContainer.querySelectorAll(":scope > .array-item");

    arrayItems.forEach((item, idx) => {
      const expectedPath = `${path}[${idx}]`;

      // For primitive arrays, look for the input element within this specific array item
      if (itemsSchema?.type && ['string', 'number', 'integer', 'boolean'].includes(itemsSchema.type)) {
        const inputElement = item.querySelector(`[data-schema-path="${expectedPath}"]`);

        if (inputElement) {
          const childValue = coerceValue(inputElement.value, itemsSchema.type);
          // Only include non-empty values in arrays
          if (childValue !== undefined && !(typeof childValue === 'string' && childValue === '')) {
            values.push(childValue);
          }
        } else {
          console.log(`No input element found for ${expectedPath}`);
        }
      } else {
        // For complex arrays (objects), recursively collect data
        const childValue = collectData(itemsSchema || {}, expectedPath);
        if (childValue !== undefined) {
          values.push(childValue);
        }
      }
    });
    if (path === "root") {
      return values;
    }
    return values.length ? values : undefined;
  }
  const control = dom.schemaForm.querySelector(`[data-schema-path="${path}"]`);
  if (!control) return undefined;
  return coerceValue(control.value, type || "string");
}

function deducePrimitiveType(schema) {
  if (!schema) return "string";
  const type = getSchemaType(schema);
  if (type) return type;
  if (schema.const !== undefined) {
    const sample = schema.const;
    if (typeof sample === "boolean") return "boolean";
    if (typeof sample === "number" && Number.isInteger(sample)) return "integer";
    if (typeof sample === "number") return "number";
    if (sample === null) return "null";
    return "string";
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const sample = schema.enum.find((value) => value !== null && value !== undefined);
    if (sample === undefined) return "string";
    if (typeof sample === "boolean") return "boolean";
    if (typeof sample === "number" && Number.isInteger(sample)) return "integer";
    if (typeof sample === "number") return "number";
    if (sample === null) return "null";
  }
  return "string";
}

function getSchemaType(schema) {
  if (!schema || typeof schema !== "object") return undefined;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  return type;
}

function coerceValue(raw, type) {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  // For strings, allow empty strings to be valid values
  if (type === "string" && raw === "") {
    return raw;
  }
  // For other types, treat empty string as undefined
  if (raw === "" && type !== "string") {
    return undefined;
  }
  switch (type) {
    case "number": {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case "integer": {
      const parsed = Number(raw);
      return Number.isInteger(parsed) ? parsed : undefined;
    }
    case "boolean":
      if (raw === "true" || raw === true) return true;
      if (raw === "false" || raw === false) return false;
      return undefined;
    case "null":
      return raw === "null" ? null : undefined;
    case "string":
    default:
      return raw;
  }
}

export function updateSchemaOutput() {
  if (!state.schema) {
    dom.schemaOutput.innerHTML = "";
    dom.schemaValidation.textContent = "";
    return;
  }
  const data = collectData(state.schema);
  if (data === undefined) {
    dom.schemaOutput.innerHTML = "";
    dom.schemaValidation.textContent = "";
    dom.schemaValidation.classList.remove("has-errors");
    return;
  }
  const json = JSON.stringify(data, null, 2);
  dom.schemaOutput.innerHTML = highlightJSON(json);
  if (!state.validator) {
    renderValidation([], { disabled: true });
    return;
  }
  let isValid = false;
  try {
    isValid = state.validator(data);
  } catch (validationError) {
    renderValidation([validationError.message || "Validation failed unexpectedly."]);
    return;
  }
  if (isValid) {
    renderValidation([]);
    return;
  }
  renderValidation(formatAjvErrors(state.validator.errors));
}

function renderValidation(messages, options = {}) {
  dom.schemaValidation.innerHTML = "";
  if (!messages.length) {
    const success = document.createElement("p");
    if (options.disabled) {
      success.textContent = "Schema loaded, but validation is not available for this document.";
    } else {
      success.textContent = "All good! The generated JSON matches the active schema.";
    }
    dom.schemaValidation.appendChild(success);
    dom.schemaValidation.classList.remove("has-errors");
    return;
  }
  dom.schemaValidation.classList.add("has-errors");
  const intro = document.createElement("p");
  intro.textContent = `Validation found ${messages.length} issue${messages.length > 1 ? "s" : ""}:`;
  dom.schemaValidation.appendChild(intro);
  const list = document.createElement("ul");
  messages.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    list.appendChild(item);
  });
  dom.schemaValidation.appendChild(list);
}

function formatAjvErrors(errors) {
  if (!errors || !errors.length) {
    return ["Output could not be validated against this schema."];
  }
  return errors.map((error) => {
    const path = pointerToReadablePath(error.instancePath);
    switch (error.keyword) {
      case "required":
        return `${path}: missing required property "${error.params.missingProperty}".`;
      case "const":
        return `${path}: must be exactly ${stringifySchemaValue(error.params.allowedValue)}.`;
      case "enum":
        return `${path}: must be one of ${error.params.allowedValues
          .map((value) => stringifySchemaValue(value))
          .join(", ")}.`;
      case "type":
        return `${path}: must be of type ${error.params.type}.`;
      case "oneOf":
        return `${path}: ${error.message || "must match exactly one allowed schema variant."}`;
      case "minItems":
      case "maxItems":
      case "minLength":
      case "maxLength":
      case "minimum":
      case "maximum":
        return `${path}: ${error.message}.`;
      default:
        return `${path}: ${error.message || "is invalid."}`;
    }
  });
}

function pointerToReadablePath(pointer) {
  if (!pointer) return "root";
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    .join(".") || "root";
}

function getOneOfOptionLabel(option, index) {
  if (!option || typeof option !== "object") {
    return `Option ${index + 1}`;
  }
  if (option.title) return option.title;
  if (option.const !== undefined) return stringifySchemaValue(option.const);
  if (Array.isArray(option.enum) && option.enum.length === 1) {
    return stringifySchemaValue(option.enum[0]);
  }
  if (option.properties && typeof option.properties === "object") {
    const hintKeys = ["type", "action", "id", "name", "kind"];
    for (const key of hintKeys) {
      const propertySchema = option.properties[key];
      if (!propertySchema) continue;
      const resolved = resolveSchema(propertySchema);
      if (resolved?.const !== undefined) {
        return stringifySchemaValue(resolved.const);
      }
      if (Array.isArray(resolved?.enum) && resolved.enum.length === 1) {
        return stringifySchemaValue(resolved.enum[0]);
      }
    }
  }
  if (option.description) return option.description;
  return `Option ${index + 1}`;
}