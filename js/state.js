// State management and URL handling

import { dom } from './dom.js';

export const state = {
  activeTool: "formatter",
  formatterDebounce: null,
  schema: null,
  validator: null,
  schemaFromUrl: false, // Track if current schema is from URL
  currentSchemaUrl: null, // Store the current schema URL
};


// URL parameter handling
export function getToolFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const tool = urlParams.get('tool');
  return ['formatter', 'schema'].includes(tool) ? tool : 'formatter';
}

export function getSchemaUrlFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('schemaUrl');
}

export function updateURL(tool, schemaUrl = null) {
  const url = new URL(window.location);
  
  // Handle tool parameter
  if (tool === 'formatter') {
    url.searchParams.delete('tool');
  } else {
    url.searchParams.set('tool', tool);
  }

  // Handle schema URL parameter
  if (schemaUrl) {
    url.searchParams.set('schemaUrl', schemaUrl);
  } else if (!state.schemaFromUrl) {
    url.searchParams.delete('schemaUrl');
  }

  // Update URL without triggering a page reload
  window.history.replaceState({}, '', url);
}

export function setActiveTool(tool) {
  state.activeTool = tool;

  // Update URL
  updateURL(tool);

  // Update UI
  dom.toolButtons.forEach((btn) => {
    const isActive = btn.dataset.tool === tool;
    btn.setAttribute("aria-selected", String(isActive));
    btn.classList.toggle("is-active", isActive);
  });

  Object.entries(dom.toolPanels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== tool);
  });

  Object.entries(dom.outputWrappers).forEach(([key, wrapper]) => {
    wrapper.classList.toggle("hidden", key !== tool);
  });
}

export function initializeFromURL() {
  const toolFromURL = getToolFromURL();
  const schemaUrlFromURL = getSchemaUrlFromURL();
  
  setActiveTool(toolFromURL);
  
  // If there's a schema URL parameter, load it
  if (schemaUrlFromURL && toolFromURL === 'schema') {
    // We need to import this dynamically to avoid circular imports
    import('./schema.js').then(({ handleSchemaLoad }) => {
      // Set the URL in the input field
      import('./dom.js').then(({ dom }) => {
        dom.schemaUrl.value = schemaUrlFromURL;
        // Auto-load the schema
        handleSchemaLoad();
      });
    });
  }
}