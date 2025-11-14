/**
 * Script to generate poster images from video files
 * Usage: node scripts/generate-poster-images.js
 * 
 * This creates fallback images for when videos don't load
 * Alternatively, you can create simple colored backgrounds
 */

const fs = require('fs');
const path = require('path');

// Simple SVG placeholders if you don't have video frames
const posters = {
  'poster-typing.jpg': {
    color: '#1a1a2e',
    text: 'MindTree Login'
  },
  'poster-galaxy.jpg': {
    color: '#0f2027',
    text: 'Create Account'
  },
  'poster-forgot.jpg': {
    color: '#141e30',
    text: 'Forgot Password'
  },
  'poster-reset.jpg': {
    color: '#2c3e50',
    text: 'Reset Password'
  }
};

// Generate simple colored SVG posters
const imagesDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

Object.entries(posters).forEach(([filename, { color, text }]) => {
  const svg = `
<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${filename}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#000;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#grad${filename})" />
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="72" fill="white" text-anchor="middle" opacity="0.3">${text}</text>
</svg>
  `.trim();
  
  // Save as SVG (browsers support this as img src)
  const svgPath = path.join(imagesDir, filename.replace('.jpg', '.svg'));
  fs.writeFileSync(svgPath, svg);
  console.log(`✓ Created ${svgPath}`);
});

console.log('\n✅ Poster images generated!');
console.log('Note: These are SVG files. For better quality, extract frames from videos or create custom images.');
