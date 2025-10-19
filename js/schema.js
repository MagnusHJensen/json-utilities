// Schema editor functionality

import { dom, getOneOfContainer, getArrayContainer } from './dom.js';
import { state, updateURL } from './state.js';
import { saveSchemaJson } from './file.js';
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

  // Handle internal references (starting with #)
  if (ref.startsWith("#")) {
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

  // External references should have been pre-resolved by now
  // If we encounter one here, it means resolution failed
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    console.warn(`Unresolved external reference: ${ref}`);
    return { __unresolvedRef: ref };
  }

  // Unknown reference format
  return null;
}

export async function resolveExternalRef(ref) {
  if (!ref || typeof ref !== "string") {
    return null;
  }

  // Only handle HTTP/HTTPS URLs
  if (!ref.startsWith("http://") && !ref.startsWith("https://")) {
    return null;
  }

  // Parse the URL and fragment
  const [baseUrl, fragment] = ref.includes('#') ? ref.split('#') : [ref, null];

  // Check cache for the base URL first
  if (state.externalSchemaCache.has(baseUrl)) {
    const baseSchema = state.externalSchemaCache.get(baseUrl);
    console.log(`Using cached schema for: ${baseUrl}${fragment ? ` (fragment: #${fragment})` : ''}`);
    if (baseSchema === null) {
      // Previous fetch failed
      return null;
    }

    // If no fragment, return the whole schema
    if (!fragment) {
      return baseSchema;
    }

    // Resolve the fragment within the cached schema
    return resolveFragment(baseSchema, fragment);
  }

  try {
    console.log(`Fetching external schema: ${baseUrl}`);
    const response = await fetch(baseUrl, { cache: "default" });
    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.status}`);
    }

    const baseSchema = await response.json();

    // Cache the base schema (without fragment)
    state.externalSchemaCache.set(baseUrl, baseSchema);
    console.log(`Cached external schema: ${baseUrl}`);

    // If no fragment, return the whole schema
    if (!fragment) {
      return baseSchema;
    }

    // Resolve the fragment within the fetched schema
    return resolveFragment(baseSchema, fragment);
  } catch (error) {
    console.error(`Failed to resolve external reference ${baseUrl}:`, error);
    // Cache the failure to avoid repeated attempts
    state.externalSchemaCache.set(baseUrl, null);
    return null;
  }
}

function resolveFragment(schema, fragment) {
  if (!fragment) {
    return schema;
  }

  // Handle JSON Pointer fragments (e.g., /$defs/tackType)
  if (fragment.startsWith('/')) {
    const path = fragment
      .slice(1) // Remove leading /
      .split('/')
      .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

    const result = path.reduce((acc, segment) => {
      if (acc && typeof acc === 'object' && segment in acc) {
        return acc[segment];
      }
      console.warn(`Fragment resolution failed at segment '${segment}' in path '${fragment}'`);
      return null;
    }, schema);

    if (result === null) {
      console.error(`Failed to resolve fragment: #${fragment}`);
    } else {
      console.log(`Successfully resolved fragment: #${fragment}`);
    }

    return result;
  }

  // Handle other fragment types if needed
  console.warn(`Unsupported fragment format: #${fragment}`);
  return null;
}

export async function preResolveExternalRefs(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // Handle arrays
  if (Array.isArray(schema)) {
    const resolved = [];
    for (const item of schema) {
      resolved.push(await preResolveExternalRefs(item));
    }
    return resolved;
  }

  // Handle $ref
  if (schema.$ref && typeof schema.$ref === 'string') {
    if (schema.$ref.startsWith('http://') || schema.$ref.startsWith('https://')) {
      console.log(`Resolving external reference: ${schema.$ref}`);
      const externalSchema = await resolveExternalRef(schema.$ref);
      if (externalSchema) {
        console.log(`Successfully resolved: ${schema.$ref}`);
        // Merge any additional properties from the referencing schema
        const { $ref, ...rest } = schema;
        const merged = { ...externalSchema, ...rest };
        // Recursively resolve any refs in the fetched schema
        return await preResolveExternalRefs(merged);
      } else {
        console.error(`Failed to resolve external reference: ${schema.$ref}`);
        // Return an error marker
        return { __unresolvedRef: schema.$ref };
      }
    }
  }

  // Recursively process all properties
  const result = { ...schema };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = await preResolveExternalRefs(value);
    }
  }

  return result;
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

    await applySchema(schema, `Loaded schema from ${url}.`);

    // Update URL with schema parameter
    updateURL(state.activeTool, url);

    // Show share button
    dom.schemaShareBtn.classList.remove("hidden");
  } catch (error) {
    showStatus("schema", error.message, "error");
  }
}

export async function handleSchemaPaste() {
  try {
    const schema = parseSchemaText(dom.schemaRaw.value);

    // Track that this schema is NOT from URL
    state.schemaFromUrl = false;
    state.currentSchemaUrl = null;

    await applySchema(schema, "Schema parsed successfully.");

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

  // Clear external schema cache to free memory
  state.externalSchemaCache.clear();
  console.log("Cleared external schema cache");

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
  showTemporaryMessage("Cleared values for the current schema.", "success");
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
  copyToClipboard(text)
    .then(() => showTemporaryMessage("Copied output to clipboard!", "success"))
    .catch(() => { });
}

export function handleSchemaSave() {
  if (!state.schema) {
    showStatus("schema", "Load a schema first.", "error");
    return;
  }
  const text = dom.schemaOutput.textContent.trim();
  if (!text) {
    showStatus("schema", "Fill some values before saving.", "error");
    return;
  }

  // Try to get schema name for filename
  let schemaName = null;
  if (state.schema.title) {
    schemaName = state.schema.title;
  } else if (state.currentSchemaUrl) {
    // Extract name from URL
    try {
      const url = new URL(state.currentSchemaUrl);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop();
      schemaName = filename.replace(/\.(json|schema)$/i, '');
    } catch {
      // Ignore URL parsing errors
    }
  }

  const success = saveSchemaJson(text, schemaName);
  if (success) {
    showTemporaryMessage("JSON saved to file!", "success");
  } else {
    showStatus("schema", "Failed to save file. Please try again.", "error");
  }
}

export async function applySchema(schema, successMessage) {
  try {
    // Pre-resolve any external references
    showStatus("schema", "Resolving external references...", "loading");
    const resolvedSchema = await preResolveExternalRefs(schema);

    state.schema = resolvedSchema;
    state.validator = null;
    let statusText = successMessage;
    let statusVariant = "success";

    if (ajv) {
      try {
        state.validator = ajv.compile(resolvedSchema);
      } catch (compileError) {
        console.warn("AJV failed to compile schema:", compileError);
        statusText = `Schema loaded but validation limited: ${compileError.message}`;
        statusVariant = "error";
      }
    }

    setSchemaLoaded(true);
    renderSchemaForm(resolvedSchema);
    showStatus("schema", statusText, statusVariant);
    updateSchemaOutput();
  } catch (error) {
    console.error("Failed to apply schema:", error);
    showStatus("schema", `Failed to resolve schema references: ${error.message}`, "error");
  }
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
  if (Array.isArray(effective.allOf) && effective.allOf.length) {
    createAllOfField(effective, path, container, context);
    return;
  }
  if (effective.anyOf || effective.allOf) {
    addSchemaMessage(container, "Combined schemas (anyOf/allOf) are not supported in this editor.", "error");
    return;
  }
  const type = getSchemaType(effective);
  if (type === "object" || (!type && effective.properties) || (!type && effective.patternProperties)) {
    const properties = effective.properties || {};
    const patternProperties = effective.patternProperties || {};
    const required = effective.required || [];

    // Handle regular properties
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

    // Handle pattern properties
    if (Object.keys(patternProperties).length > 0) {
      createPatternPropertiesField(effective, path, container, required);
    }

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

function createAllOfField(schema, path, container, context) {
  // Merge all schemas in the allOf array
  const mergedSchema = mergeAllOfSchemas(schema.allOf);

  // Add a description if the allOf has one
  if (schema.description) {
    const wrapper = document.createElement("div");
    wrapper.className = "schema-allof";

    const hint = document.createElement("p");
    hint.className = "helper-text";
    hint.textContent = schema.description;
    wrapper.appendChild(hint);

    // Build fields for the merged schema
    buildFields(mergedSchema, path, wrapper, context);
    container.appendChild(wrapper);
  } else {
    // If no description, build fields directly
    buildFields(mergedSchema, path, container, context);
  }
}

function deepMergeProperties(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = { ...target };

  Object.keys(source).forEach(key => {
    const sourceValue = source[key];
    const targetValue = result[key];

    // Check if both values are object schemas (either explicit type:"object" or have properties)
    const isTargetObjectSchema = targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue) &&
      (targetValue.type === 'object' || targetValue.properties) &&
      targetValue.properties;

    const isSourceObjectSchema = sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      (sourceValue.type === 'object' || sourceValue.properties) &&
      sourceValue.properties;

    if (isTargetObjectSchema && isSourceObjectSchema) {
      // Deep merge object type properties
      result[key] = {
        ...targetValue,
        ...sourceValue,
        properties: deepMergeProperties(targetValue.properties, sourceValue.properties)
      };

      // Merge required arrays for nested objects
      if (targetValue.required || sourceValue.required) {
        const mergedRequired = new Set([
          ...(targetValue.required || []),
          ...(sourceValue.required || [])
        ]);
        if (mergedRequired.size > 0) {
          result[key].required = Array.from(mergedRequired);
        }
      }
    } else {
      // For non-object properties or different types, later value wins
      result[key] = sourceValue;
    }
  });

  return result;
}

function mergeAllOfSchemas(allOfSchemas) {
  if (!Array.isArray(allOfSchemas) || allOfSchemas.length === 0) {
    return {};
  }

  const merged = {};
  const requiredFields = new Set();

  // Process each schema in allOf
  allOfSchemas.forEach(subSchema => {
    const resolved = resolveSchema(subSchema);
    if (!resolved || typeof resolved !== 'object') return;

    // Deep merge properties
    if (resolved.properties) {
      if (!merged.properties) {
        merged.properties = {};
      }
      merged.properties = deepMergeProperties(merged.properties, resolved.properties);
    }

    // Collect required fields
    if (Array.isArray(resolved.required)) {
      resolved.required.forEach(field => requiredFields.add(field));
    }

    // Merge other properties (title, description, etc.)
    // Note: later schemas override earlier ones for conflicts
    Object.keys(resolved).forEach(key => {
      if (key !== 'properties' && key !== 'required') {
        merged[key] = resolved[key];
      }
    });
  });

  // Set merged required array
  if (requiredFields.size > 0) {
    merged.required = Array.from(requiredFields);
  }

  return merged;
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
      control.dataset.validationPattern = schema.pattern;

      // Add real-time pattern validation
      control.addEventListener("input", (e) => {
        validatePatternInput(e.target);
        updateSchemaOutput();
      });

      // Add pattern hint to title
      const patternHint = getPatternHint(schema.pattern);
      if (patternHint) {
        control.title = `Must match pattern: ${schema.pattern}\n${patternHint}`;
      } else {
        control.title = `Must match pattern: ${schema.pattern}`;
      }
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

  // Add event listeners (pattern inputs already have their own input listener)
  if (!schema.pattern) {
    control.addEventListener("input", updateSchemaOutput);
  }
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

  // Store min/max constraints on the container for validation
  if (schema.minItems !== undefined) {
    itemsContainer.dataset.minItems = schema.minItems;
  }
  if (schema.maxItems !== undefined) {
    itemsContainer.dataset.maxItems = schema.maxItems;
  }

  wrapper.appendChild(itemsContainer);
  const addButton = document.createElement("button");
  addButton.type = "button";

  // Create a more user-friendly button label based on the path
  const fieldName = path.split('.').pop().split('[')[0];
  const singularName = getSingularForm(fieldName);
  addButton.textContent = `Add ${singularName}`;

  addButton.classList.add("app-button", "secondary");
  addButton.addEventListener("click", () => {
    const currentCount = itemsContainer.querySelectorAll(":scope > .array-item").length;
    const maxItems = schema.maxItems;

    if (maxItems !== undefined && currentCount >= maxItems) {
      showTemporaryMessage(`Maximum ${maxItems} items allowed`, "error");
      return;
    }

    addArrayItem(itemsContainer, schema.items, path);
    updateArrayButtonStates(itemsContainer, addButton);
    updateSchemaOutput();
  });
  wrapper.appendChild(addButton);

  const initialItems = schema.minItems ? Math.min(schema.minItems, 5) : 0;
  for (let i = 0; i < initialItems; i += 1) {
    addArrayItem(itemsContainer, schema.items, path);
  }

  // Update button states after initial items are added
  updateArrayButtonStates(itemsContainer, addButton);

  container.appendChild(wrapper);
}

function createPatternPropertiesField(schema, path, container, required) {
  const patternProperties = schema.patternProperties || {};

  // Create a fieldset for pattern properties
  const wrapper = document.createElement("div");
  wrapper.className = "schema-field schema-pattern-properties";

  const title = document.createElement("h4");
  title.textContent = "Dynamic Properties";
  title.className = "pattern-properties-title";
  wrapper.appendChild(title);

  if (schema.description) {
    const desc = document.createElement("p");
    desc.className = "helper-text";
    desc.textContent = schema.description;
    wrapper.appendChild(desc);
  }

  // Create container for dynamic property entries
  const entriesContainer = document.createElement("div");
  entriesContainer.className = "pattern-properties-entries";
  entriesContainer.dataset.patternPath = path;

  // Store pattern information for validation
  Object.entries(patternProperties).forEach(([pattern, schema], index) => {
    // Use a simple index-based approach instead of btoa encoding
    entriesContainer.dataset[`pattern${index}`] = pattern;
    entriesContainer.dataset[`schema${index}`] = JSON.stringify(schema);
  });

  // Store the count of patterns for iteration
  entriesContainer.dataset.patternCount = Object.keys(patternProperties).length;

  wrapper.appendChild(entriesContainer);

  // Add button to create new dynamic properties
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.textContent = "Add Property";
  addButton.classList.add("app-button", "secondary");
  addButton.addEventListener("click", () => {
    addPatternPropertyEntry(entriesContainer, patternProperties, path);
    updateSchemaOutput();
  });

  wrapper.appendChild(addButton);
  container.appendChild(wrapper);
}

function addPatternPropertyEntry(container, patternProperties, basePath) {
  const entryIndex = container.querySelectorAll(":scope > .pattern-property-entry").length;
  const entryWrapper = document.createElement("div");
  entryWrapper.className = "pattern-property-entry";

  // Property name input with suggestions
  const nameField = document.createElement("div");
  nameField.className = "pattern-property-name";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Property Name";
  nameField.appendChild(nameLabel);

  // Create a wrapper for the input and suggestions
  const inputWrapper = document.createElement("div");
  inputWrapper.className = "pattern-input-wrapper";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Enter property name...";
  nameInput.dataset.patternPropertyName = `${basePath}_pattern_${entryIndex}`;

  // Add pattern validation hints
  const patterns = Object.keys(patternProperties);
  if (patterns.length > 0) {
    nameInput.title = `Must match pattern: ${patterns.join(' OR ')}`;

    // Add validation
    nameInput.addEventListener("input", () => {
      validatePatternPropertyName(nameInput, patterns);
      updateSchemaOutput();
    });
  }

  inputWrapper.appendChild(nameInput);

  // Extract exact words from patterns and show as quick options
  const extractedWords = extractWordsFromPatterns(patterns);

  if (extractedWords.length > 0) {
    // Show extracted words as buttons
    const wordsContainer = document.createElement("div");
    wordsContainer.className = "pattern-word-options";

    const wordsLabel = document.createElement("span");
    wordsLabel.textContent = "Quick select:";
    wordsLabel.className = "pattern-words-label";
    wordsContainer.appendChild(wordsLabel);

    const wordsWrapper = document.createElement("div");
    wordsWrapper.className = "pattern-words-wrapper";

    extractedWords.forEach(word => {
      const wordBtn = document.createElement("button");
      wordBtn.type = "button";
      wordBtn.textContent = word;
      wordBtn.className = "pattern-word-btn";
      wordBtn.title = `Use "${word}" as property name`;

      wordBtn.addEventListener("click", (e) => {
        e.preventDefault();
        nameInput.value = word;
        validatePatternPropertyName(nameInput, patterns);
        updateSchemaOutput();
      });

      wordsWrapper.appendChild(wordBtn);
    });

    wordsContainer.appendChild(wordsWrapper);
    inputWrapper.appendChild(wordsContainer);
  }

  // Add suggestions dropdown for common patterns (only if no extracted words)
  if (extractedWords.length === 0) {
    const suggestionsBtn = document.createElement("button");
    suggestionsBtn.type = "button";
    suggestionsBtn.textContent = "💡";
    suggestionsBtn.title = "Show common pattern suggestions";
    suggestionsBtn.classList.add("app-button", "ghost", "small", "pattern-suggestions-btn");

    const suggestionsDropdown = document.createElement("div");
    suggestionsDropdown.className = "pattern-suggestions-dropdown hidden";

    // Common regex patterns with descriptions
    const commonPatterns = getCommonRegexPatterns();

    commonPatterns.forEach(({ pattern, description, examples }) => {
      const suggestionItem = document.createElement("div");
      suggestionItem.className = "pattern-suggestion-item";

      const patternCode = document.createElement("code");
      patternCode.textContent = pattern;
      patternCode.className = "pattern-code";

      const patternDesc = document.createElement("span");
      patternDesc.textContent = description;
      patternDesc.className = "pattern-description";

      const patternExamples = document.createElement("small");
      patternExamples.textContent = `Examples: ${examples.join(', ')}`;
      patternExamples.className = "pattern-examples";

      suggestionItem.appendChild(patternCode);
      suggestionItem.appendChild(patternDesc);
      suggestionItem.appendChild(patternExamples);

      suggestionItem.addEventListener("click", () => {
        nameInput.value = examples[0]; // Use first example
        validatePatternPropertyName(nameInput, patterns);
        suggestionsDropdown.classList.add("hidden");
        updateSchemaOutput();
      });

      suggestionsDropdown.appendChild(suggestionItem);
    });

    suggestionsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      suggestionsDropdown.classList.toggle("hidden");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!inputWrapper.contains(e.target)) {
        suggestionsDropdown.classList.add("hidden");
      }
    });

    inputWrapper.appendChild(suggestionsBtn);
    inputWrapper.appendChild(suggestionsDropdown);
  }

  nameField.appendChild(inputWrapper);
  entryWrapper.appendChild(nameField);

  // Property value field
  const valueField = document.createElement("div");
  valueField.className = "pattern-property-value";

  // Determine which pattern schema to use based on the first pattern
  // In a more sophisticated implementation, we could dynamically switch based on name
  const firstPattern = Object.keys(patternProperties)[0];
  const patternSchema = patternProperties[firstPattern];

  const valuePath = `${basePath}.${entryIndex}_pattern_value`;
  createControlForSchema(patternSchema, valuePath, valueField, false);

  entryWrapper.appendChild(valueField);

  // Remove button
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.classList.add("app-button", "ghost", "small");
  removeButton.addEventListener("click", () => {
    entryWrapper.remove();
    updateSchemaOutput();
  });

  const controls = document.createElement("div");
  controls.className = "pattern-property-controls";
  controls.appendChild(removeButton);
  entryWrapper.appendChild(controls);

  container.appendChild(entryWrapper);
}

function extractWordsFromPatterns(patterns) {
  const allWords = new Set();

  patterns.forEach(pattern => {
    try {
      // Remove common regex anchors and grouping
      let cleanPattern = pattern.replace(/^\^/, '').replace(/\$$/, '');
      cleanPattern = cleanPattern.replace(/^\(/, '').replace(/\)$/, '');

      // Check if this looks like a simple alternation pattern (word1|word2|word3)
      if (cleanPattern.includes('|') && !cleanPattern.match(/[\[\]{}*+?\\\.]/)) {
        // Split by | and extract words that are purely alphabetic or contain underscores/hyphens
        const words = cleanPattern.split('|').map(word => word.trim()).filter(word => {
          // Only include words that are simple alphanumeric with underscores/hyphens
          return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(word);
        });

        words.forEach(word => allWords.add(word));
      }
      // Also check for simple single words in patterns
      else if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cleanPattern)) {
        allWords.add(cleanPattern);
      }
    } catch (e) {
      // Ignore invalid regex patterns
      console.warn(`Could not parse pattern: ${pattern}`, e);
    }
  });

  return Array.from(allWords).sort();
}

function validatePatternInput(input) {
  const pattern = input.dataset.validationPattern;
  const value = input.value;

  if (!pattern || !value) {
    input.classList.remove("pattern-valid", "pattern-invalid");
    return;
  }

  try {
    const regex = new RegExp(pattern);
    const isValid = regex.test(value);

    input.classList.toggle("pattern-valid", isValid);
    input.classList.toggle("pattern-invalid", !isValid);
  } catch (e) {
    console.warn(`Invalid pattern: ${pattern}`, e);
    input.classList.remove("pattern-valid", "pattern-invalid");
  }
}

function getPatternHint(pattern) {
  // Common pattern hints to help users understand what's expected
  const patternHints = {
    '^[a-zA-Z]+$': 'Letters only',
    '^[a-z]+$': 'Lowercase letters only',
    '^[A-Z]+$': 'Uppercase letters only',
    '^[0-9]+$': 'Numbers only',
    '^\\d+$': 'Numbers only',
    '^[a-zA-Z0-9]+$': 'Letters and numbers only',
    '^[a-zA-Z][a-zA-Z0-9]*$': 'Must start with a letter',
    '^[a-zA-Z][a-zA-Z0-9_-]*$': 'Must start with a letter, can contain letters, numbers, underscores, hyphens',
    '^[a-z][a-z0-9_]*$': 'Lowercase, can contain underscores (snake_case)',
    '^[a-z][a-zA-Z0-9]*$': 'Must start lowercase (camelCase)',
    '^[A-Z][a-zA-Z0-9]*$': 'Must start uppercase (PascalCase)',
    '^[a-z-]+$': 'Lowercase with hyphens (kebab-case)',
    '^[a-fA-F0-9]+$': 'Hexadecimal characters only',
    '^#[a-fA-F0-9]{6}$': 'Hex color code (e.g., #FF0000)',
    '^#[a-fA-F0-9]{3}$': 'Short hex color code (e.g., #F00)',
    '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$': 'Valid email address',
    '^https?://.*$': 'Valid HTTP/HTTPS URL',
    '^\\+?[1-9]\\d{1,14}$': 'Valid phone number',
    '^\\d{4}-\\d{2}-\\d{2}$': 'Date format: YYYY-MM-DD',
    '^\\d{2}/\\d{2}/\\d{4}$': 'Date format: MM/DD/YYYY',
    '^[0-9]{5}(-[0-9]{4})?$': 'US ZIP code',
    '^[A-Z]{2}\\d{5}$': 'Format: 2 letters + 5 numbers'
  };

  // Try exact match first
  if (patternHints[pattern]) {
    return patternHints[pattern];
  }

  // Try to match common patterns with slight variations
  for (const [knownPattern, hint] of Object.entries(patternHints)) {
    if (pattern.includes(knownPattern.replace(/\^|\$/g, ''))) {
      return hint;
    }
  }

  // Provide basic hints based on pattern content
  if (pattern.includes('[a-z]') && pattern.includes('[A-Z]')) {
    return 'Mix of uppercase and lowercase letters';
  } else if (pattern.includes('[a-z]')) {
    return 'Lowercase letters';
  } else if (pattern.includes('[A-Z]')) {
    return 'Uppercase letters';
  } else if (pattern.includes('\\d') || pattern.includes('[0-9]')) {
    return 'Numbers required';
  }

  return null;
}

function getCommonRegexPatterns() {
  return [
    {
      pattern: "^[a-zA-Z][a-zA-Z0-9_]*$",
      description: "Valid identifier (starts with letter)",
      examples: ["userName", "id", "config_value"]
    },
    {
      pattern: "^[a-z]+$",
      description: "Lowercase letters only",
      examples: ["name", "type", "status"]
    },
    {
      pattern: "^[A-Z]+$",
      description: "Uppercase letters only",
      examples: ["ID", "TYPE", "STATUS"]
    },
    {
      pattern: "^[a-z][a-z0-9_]*$",
      description: "Snake case (lowercase with underscores)",
      examples: ["user_name", "api_key", "max_length"]
    },
    {
      pattern: "^[a-z][a-zA-Z0-9]*$",
      description: "Camel case (starts lowercase)",
      examples: ["userName", "apiKey", "maxLength"]
    },
    {
      pattern: "^[A-Z][a-zA-Z0-9]*$",
      description: "Pascal case (starts uppercase)",
      examples: ["UserName", "ApiKey", "MaxLength"]
    },
    {
      pattern: "^[a-z-]+$",
      description: "Kebab case (lowercase with hyphens)",
      examples: ["user-name", "api-key", "max-length"]
    },
    {
      pattern: "^\\d+$",
      description: "Numbers only",
      examples: ["123", "0", "999"]
    },
    {
      pattern: "^[a-f0-9]+$",
      description: "Hexadecimal (lowercase)",
      examples: ["abc123", "ff0000", "deadbeef"]
    },
    {
      pattern: "^[A-F0-9]+$",
      description: "Hexadecimal (uppercase)",
      examples: ["ABC123", "FF0000", "DEADBEEF"]
    },
    {
      pattern: "^(get|set|has|is)[A-Z].*$",
      description: "Method names (getter/setter/boolean)",
      examples: ["getName", "setValue", "hasPermission", "isActive"]
    },
    {
      pattern: "^(create|read|update|delete)[A-Z].*$",
      description: "CRUD operation names",
      examples: ["createUser", "readData", "updateRecord", "deleteItem"]
    },
    {
      pattern: "^(before|after|on)[A-Z].*$",
      description: "Event handler names",
      examples: ["beforeSave", "afterLoad", "onClick", "onSubmit"]
    },
    {
      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      description: "Email address format",
      examples: ["user@example.com", "test.email+tag@domain.co.uk"]
    },
    {
      pattern: "^(https?|ftp)://[^\\s/$.?#].[^\\s]*$",
      description: "URL format",
      examples: ["https://example.com", "http://api.service.com/endpoint"]
    }
  ];
}

function validatePatternPropertyName(input, patterns) {
  const name = input.value.trim();
  if (!name) {
    input.classList.remove("valid", "invalid");
    return;
  }

  const isValid = patterns.some(pattern => {
    try {
      const regex = new RegExp(pattern);
      return regex.test(name);
    } catch (e) {
      console.warn(`Invalid pattern: ${pattern}`, e);
      return false;
    }
  });

  input.classList.toggle("valid", isValid);
  input.classList.toggle("invalid", !isValid);
}

function collectPatternPropertiesData(schema, path) {
  const patternProperties = schema.patternProperties || {};
  const result = {};

  // Find the pattern properties container
  const container = dom.schemaForm.querySelector(`[data-pattern-path="${path}"]`);
  if (!container) return result;

  // Get all pattern property entries
  const entries = container.querySelectorAll(":scope > .pattern-property-entry");

  entries.forEach((entry, index) => {
    // Get the property name
    const nameInput = entry.querySelector('[data-pattern-property-name]');
    if (!nameInput || !nameInput.value.trim()) return;

    const propertyName = nameInput.value.trim();

    // Validate the property name against patterns
    const patterns = Object.keys(patternProperties);
    const matchingPattern = patterns.find(pattern => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(propertyName);
      } catch (e) {
        return false;
      }
    });

    if (!matchingPattern) return; // Skip invalid property names

    // Get the property value using the schema for the matching pattern
    const patternSchema = patternProperties[matchingPattern];
    const valuePath = `${path}.${index}_pattern_value`;
    const value = collectData(patternSchema, valuePath);

    if (value !== undefined) {
      const isMeaningful = !(typeof value === 'string' && value === '') &&
        !(Array.isArray(value) && value.length === 0) &&
        !(typeof value === 'object' && value !== null && Object.keys(value).length === 0);

      if (isMeaningful) {
        result[propertyName] = value;
      }
    }
  });

  return result;
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
    const currentCount = container.querySelectorAll(":scope > .array-item").length;
    const minItems = parseInt(container.dataset.minItems, 10);

    if (!isNaN(minItems) && currentCount <= minItems) {
      showTemporaryMessage(`Minimum ${minItems} items required`, "error");
      return;
    }

    itemWrapper.remove();
    renumberArrayItems(container, path);

    // Update button states for the add button
    const arrayField = container.closest('.schema-array');
    const addButton = arrayField?.querySelector('.app-button.secondary');
    if (addButton) {
      updateArrayButtonStates(container, addButton);
    }

    updateSchemaOutput();
  });
  controls.appendChild(removeBtn);
  itemWrapper.appendChild(body);
  itemWrapper.appendChild(controls);
  container.appendChild(itemWrapper);

  // Update button states after adding the item
  const arrayField = container.closest('.schema-array');
  const addButton = arrayField?.querySelector('.app-button.secondary');
  if (addButton) {
    updateArrayButtonStates(container, addButton);
  }
}

function updateArrayButtonStates(itemsContainer, addButton) {
  const currentCount = itemsContainer.querySelectorAll(":scope > .array-item").length;
  const minItems = parseInt(itemsContainer.dataset.minItems, 10);
  const maxItems = parseInt(itemsContainer.dataset.maxItems, 10);

  // Update add button state
  if (!isNaN(maxItems) && currentCount >= maxItems) {
    addButton.disabled = true;
    addButton.classList.add('disabled');
    addButton.title = `Maximum ${maxItems} items allowed`;
  } else {
    addButton.disabled = false;
    addButton.classList.remove('disabled');
    addButton.title = "";
  }

  // Update remove button states
  const removeButtons = itemsContainer.querySelectorAll(":scope > .array-item .app-button.ghost");
  removeButtons.forEach(removeBtn => {
    if (!isNaN(minItems) && currentCount <= minItems) {
      removeBtn.disabled = true;
      removeBtn.classList.add('disabled');
      removeBtn.title = `Minimum ${minItems} items required`;
    } else {
      removeBtn.disabled = false;
      removeBtn.classList.remove('disabled');
      removeBtn.title = "";
    }
  });
} function renumberArrayItems(container, arrayPath) {
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
  if (Array.isArray(effective.allOf) && effective.allOf.length) {
    // For allOf, merge schemas and collect data from the merged result
    const mergedSchema = mergeAllOfSchemas(effective.allOf);
    return collectData(mergedSchema, path);
  }
  const type = getSchemaType(effective);
  if (type === "object" || (!type && effective.properties) || (!type && effective.patternProperties)) {
    const properties = effective.properties || {};
    const patternProperties = effective.patternProperties || {};
    const result = {};
    let hasMeaningfulValue = false;

    // Collect regular properties
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

    // Collect pattern properties
    if (Object.keys(patternProperties).length > 0) {
      const patternData = collectPatternPropertiesData(effective, path);
      if (patternData && Object.keys(patternData).length > 0) {
        Object.assign(result, patternData);
        hasMeaningfulValue = true;
      }
    }

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