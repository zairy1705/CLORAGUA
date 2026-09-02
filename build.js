import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

[distDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const filesToCopy = [
  'index.html',
  'styles.css',
  'app.js',
  'metadata.json',
  'vercel.json',
  'assets'
];

for (const item of filesToCopy) {
  const src = path.join(__dirname, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(distDir, item), { recursive: true, force: true });
    fs.cpSync(src, path.join(publicDir, item), { recursive: true, force: true });
    console.log(`✓ Copied ${item} to dist/ and public/`);
  }
}

console.log('Build finished successfully for Vercel & Production.');
