# Social Media Assets

This directory contains assets for social media sharing and branding.

## Required Assets

### Social Preview Image (social-preview.png)
- **Size**: 1200x630px
- **Format**: PNG
- **Content**: Screenshot of the JSON Tools Platform interface showing both the formatter and schema editor
- **Text overlay**: "JSON Tools Platform" title
- **Background**: Clean, branded background matching the app's design

### Favicon Assets
- **favicon.ico**: 16x16, 32x32, 48x48 multi-size ICO file
- **favicon-16x16.png**: 16x16px PNG
- **favicon-32x32.png**: 32x32px PNG  
- **apple-touch-icon.png**: 180x180px PNG for iOS devices

## Creating the Social Preview Image

You can create the social preview image by:

1. **Screenshot Method**:
   - Take a screenshot of the application at 1200x630 resolution
   - Add the title "JSON Tools Platform" overlay
   - Ensure good contrast and readability

2. **Design Tool Method**:
   - Use Figma, Canva, or similar tool
   - Include app screenshot + branding
   - Export as PNG at 1200x630px
   - Optimize file size for web

3. **Automated Method**:
   ```bash
   # Using headless browser to generate screenshot
   # (requires puppeteer or similar)
   npm install puppeteer
   node generate-social-image.js
   ```

## Favicon Generation

You can generate favicons from a single source image using:

- [Favicon.io](https://favicon.io/)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- Manual creation with image editing software

## Testing Social Cards

Test your social media cards with:

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## Current Status

- ✅ Meta tags added to HTML
- ⏳ Social preview image (needs creation)
- ⏳ Favicon files (needs creation)
- ✅ CSS styling for GitHub attribution