// File operations and download functionality

/**
 * Saves content to a file using the native browser download mechanism
 * @param {string} content - The content to save
 * @param {string} filename - The filename for the download
 * @param {string} mimeType - The MIME type of the file (default: 'application/json')
 */
export function saveToFile(content, filename = 'data.json', mimeType = 'application/json') {
  try {
    // Create a Blob with the content
    const blob = new Blob([content], { type: mimeType });

    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element to trigger the download
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';

    // Append to body, click, and remove
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up the temporary URL
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Failed to save file:', error);
    return false;
  }
}

/**
 * Saves JSON data to a file with proper formatting
 * @param {object|string} jsonData - The JSON data to save (object will be stringified)
 * @param {string} filename - The filename for the download (default: 'data.json')
 */
export function saveJsonToFile(jsonData, filename = 'data.json') {
  try {
    let content;

    if (typeof jsonData === 'string') {
      // If it's already a string, try to parse and re-stringify for formatting
      try {
        const parsed = JSON.parse(jsonData);
        content = JSON.stringify(parsed, null, 2);
      } catch {
        // If parsing fails, use the string as-is
        content = jsonData;
      }
    } else {
      // If it's an object, stringify with formatting
      content = JSON.stringify(jsonData, null, 2);
    }

    return saveToFile(content, filename, 'application/json');
  } catch (error) {
    console.error('Failed to save JSON file:', error);
    return false;
  }
}

/**
 * Generates a filename with timestamp
 * @param {string} baseName - Base name for the file (without extension)
 * @param {string} extension - File extension (default: 'json')
 * @returns {string} Filename with timestamp
 */
export function generateTimestampedFilename(baseName = 'export', extension = 'json') {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .substring(0, 19);

  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * Saves schema-generated JSON to a file with appropriate filename
 * @param {string} jsonContent - The JSON content to save
 * @param {string} schemaName - Optional schema name for filename
 */
export function saveSchemaJson(jsonContent, schemaName = null) {
  try {
    let filename;

    if (schemaName) {
      // Clean schema name for use in filename
      const cleanName = schemaName
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase()
        .substring(0, 50); // Limit length
      filename = generateTimestampedFilename(cleanName);
    } else {
      filename = generateTimestampedFilename('schema_output');
    }

    return saveJsonToFile(jsonContent, filename);
  } catch (error) {
    console.error('Failed to save schema JSON:', error);
    return false;
  }
}