# JSON Tools Platform

A lightweight, client-side web application for formatting, validating, and building JSON documents. Built with pure HTML, CSS, and vanilla JavaScript with no external dependencies beyond AJV for schema validation.

![JSON Tools Platform](https://img.shields.io/badge/JSON-Tools-blue) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow) ![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Features

### JSON Formatter

- **Real-time JSON formatting** with automatic prettification and syntax highlighting
- **Instant error detection** with clear, human-friendly error messages showing line and column numbers
- **One-click operations** for formatting, copying, and clearing content
- **Keyboard shortcuts** for power users (`Ctrl/Cmd + Enter` to format, `Ctrl/Cmd + Shift + C` to copy)

### Schema-Based JSON Editor

- **Dynamic form generation** from JSON Schema URLs or pasted schemas
- **Support for JSON Schema Draft 2020-12** with full validation
- **Interactive array and object editing** with add/remove controls
- **Smart field handling** - only includes meaningful values in output
- **Real-time validation** with detailed error reporting
- **URL sharing** for schema-based configurations
- **File export** - save generated JSON directly to your computer
- **Nested schema support** with compact, user-friendly layouts

### Additional Features

- **Light/Dark mode toggle** with system preference detection
- **Fully responsive design** optimized for desktop and mobile
- **Accessibility-first** with ARIA labels and keyboard navigation
- **Offline-capable** - works entirely client-side with no server dependencies
- **URL state management** - shareable links preserve tool selection and schema URLs
- **Social media ready** - optimized Open Graph and Twitter Card meta tags for sharing
- **GitHub integration** - direct link to source code in footer

## 🛠️ Technology Stack

- **Frontend**: Pure HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Schema Validation**: AJV (JSON Schema validator)
- **Architecture**: Modular ES6 modules for maintainability
- **Build**: No build process required - runs directly in browsers
- **Deployment**: Static site compatible with any web server

## 📁 Project Structure

```
json-utilities/
├── index.html          # Main application HTML
├── styles.css          # Complete styling and responsive design
├── app.js             # Application initialization and event binding
└── js/
    ├── dom.js         # DOM element references and utilities
    ├── file.js        # File operations and download functionality
    ├── formatter.js   # JSON formatting functionality
    ├── schema.js      # Schema editor and validation logic
    ├── state.js       # URL state management and tool switching
    ├── theme.js       # Light/dark mode handling
    └── utils.js       # Shared utility functions
```

## 🚀 Getting Started

### Quick Start

1. Clone or download this repository
2. Serve the files using any web server (required for ES6 modules)
3. Open in a web browser

### Local Development

```bash
# Clone the repository
git clone https://github.com/MagnusHJensen/json-utilities.git
cd json-utilities

# Start a local server (Python 3)
python3 -m http.server 8000

# Or using Node.js
npx serve .

# Or using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Why a Local Server?

The application uses ES6 modules which require CORS headers. Most modern development servers handle this automatically.

## 📖 Usage

### JSON Formatter

1. Paste or type JSON into the left panel
2. Formatting happens automatically as you type
3. Errors are displayed with precise location information
4. Use keyboard shortcuts or buttons to format, copy, or clear

### Schema-Based Editor

1. **Load from URL**: Enter a JSON Schema URL and click "Load Schema"
2. **Use Pasted Schema**: Paste a JSON Schema and click "Use Pasted Schema"
3. Fill in the generated form fields
4. JSON output updates in real-time with validation
5. Use the "Share" button (URL schemas only) to share your configuration

### Example Schema URLs

Try these public JSON Schema examples:

- GitHub Actions: `https://json.schemastore.org/github-workflow.json`
- Package.json: `https://json.schemastore.org/package.json`
- ESLint Config: `https://json.schemastore.org/eslintrc.json`

## ⌨️ Keyboard Shortcuts

| Shortcut               | Action                              |
| ---------------------- | ----------------------------------- |
| `Ctrl/Cmd + Enter`     | Format JSON or update schema output |
| `Ctrl/Cmd + Shift + C` | Copy output to clipboard            |
| `Ctrl/Cmd + Shift + L` | Clear current tool                  |

## 🎨 Customization

### Themes

The application automatically detects system theme preferences and includes a manual toggle. Themes are stored in browser localStorage for persistence.

### Extending Functionality

The modular architecture makes it easy to add new tools:

1. Add new tool button in `index.html`
2. Create corresponding panel and output sections
3. Add tool logic in a new module (e.g., `js/newtool.js`)
4. Update `app.js` to wire up event listeners
5. Add tool to state management in `js/state.js`

## 🔧 Configuration

### Schema Validation

The application uses AJV with JSON Schema Draft 2020-12. To modify validation behavior:

```javascript
// In js/schema.js
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  verbose: true,
  // Add custom configuration here
});
```

### URL Parameters

- `?tool=schema` - Opens schema tool
- `?schemaUrl=https://...` - Auto-loads schema from URL

## 🤝 Contributing

Contributions are welcome! The project follows these principles:

1. **No build process** - Keep it simple and dependency-free
2. **Vanilla JavaScript** - No frameworks or preprocessors
3. **Accessibility first** - All features must be keyboard and screen reader accessible
4. **Progressive enhancement** - Core functionality works everywhere
5. **Modular architecture** - New features should be self-contained modules

### Development Guidelines

- Use ES6+ features supported in modern browsers
- Follow existing code patterns and naming conventions
- Add appropriate ARIA labels for accessibility
- Test in both light and dark modes
- Ensure responsive design works on mobile devices

## 🐛 Issues & Support

If you encounter any issues or have feature requests, please:

1. Check existing issues on GitHub
2. Provide detailed reproduction steps
3. Include browser version and operating system
4. For schema-related issues, include the schema URL or content

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [AJV](https://ajv.js.org/) for robust JSON Schema validation
- [JSON Schema](https://json-schema.org/) community for excellent documentation
- Contributors and users who help improve this tool

---

**Live Demo**: https://json.magnusjensen.dk
**Repository**: https://github.com/MagnusHJensen/json-utilities
