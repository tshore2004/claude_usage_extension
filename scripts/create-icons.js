const fs = require('fs');
const path = require('path');
const { SVGIcons2SVGFontStream } = require('svgicons2svgfont');
const svg2ttf = require('svg2ttf');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'icons', 'source', 'claude-logo.svg');
const DIST = path.join(ROOT, 'icons', 'dist');
const OUT  = path.join(DIST, 'claude-code-usage.ttf');

if (!fs.existsSync(DIST)) { fs.mkdirSync(DIST, { recursive: true }); }

const UNICODE_CHAR = String.fromCodePoint(0xE001);

const fontStream = new SVGIcons2SVGFontStream({
  fontName: 'claude-code-usage',
  fontHeight: 1000,
  normalize: true,
  log: () => {},
});

let svgFont = '';
fontStream.on('data', chunk => { svgFont += chunk; });
fontStream.on('end', () => {
  const hasGlyph = svgFont.includes('<glyph') && svgFont.includes(' d="');
  console.log('SVG font has glyph data:', hasGlyph);
  if (!hasGlyph) {
    console.error('ERROR: No glyph path data found in generated SVG font. Check SVG source.');
    process.exit(1);
  }
  const ttf = svg2ttf(svgFont, {});
  fs.writeFileSync(OUT, Buffer.from(ttf.buffer));
  console.log('Icon font written to', OUT, '(' + ttf.buffer.byteLength + ' bytes)');
});
fontStream.on('error', err => { console.error('Font error:', err); process.exit(1); });

const glyphStream = fs.createReadStream(SRC);
glyphStream.metadata = { unicode: [UNICODE_CHAR], name: 'claude-logo' };
fontStream.write(glyphStream);
fontStream.end();
