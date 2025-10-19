
const umami = window.umami;

export function trackSchemaLoadFromUrl(url) {
  umami.track('load_schema_from_url', { schema_url: url });
}
export function trackSchemaLoadFromPaste() {
  umami.track('load_schema_from_paste');
}

export function trackCopyFormatterOutput() {
  umami.track('copy_formatter_output');
}

export function trackCopySchemaOutput() {
  umami.track('copy_schema_output');
}

export function trackSaveSchemaFile() {
  umami.track('save_schema_file');
}