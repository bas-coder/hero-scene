import fs from 'node:fs';
import { readBreakpoints } from './design-breakpoints.mjs';
const src = new URL('../src/', import.meta.url);
const files = fs.readdirSync(new URL('design/', src)).filter(name => name.endsWith('.css'));
const collections = files.map(name => fs.readFileSync(new URL('design/' + name, src), 'utf8')).join('\n');
function walk(directory) {
 return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
  return entry.isDirectory() ? walk(url) : [url];
 });
}
const componentFiles = walk(src).filter(url => !url.pathname.includes('/design/'));
const styles = componentFiles.filter(url => url.pathname.endsWith('.css')).map(url => fs.readFileSync(url, 'utf8')).join('\n');
// Component code includes the hero engine's plain .js: its colours come from --scene-* tokens too.
const componentCode = componentFiles.filter(url => /\.(?:tsx?|js)$/.test(url.pathname)).map(url => fs.readFileSync(url, 'utf8')).join('\n');
const definitions = new Set([... (collections + styles).matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
const errors = [];
for (const match of (collections + styles).matchAll(/var\((--[\w-]+)([^)]*)\)/g)) {
  if (!definitions.has(match[1]) && !match[2].trim().startsWith(',')) errors.push('Undefined token ' + match[1]);
}
const clean = styles.replace(/\/\*[\s\S]*?\*\//g, '');
for (const [label, pattern] of [
  ['raw color', /#[\da-f]{3,8}\b|(?:rgb|hsl|oklch)a?\(/gi],
  ['raw pixel value', /-?[\d.]+px\b/g],
  ['raw font weight', /font-weight:\s*\d+/g],
  ['raw typography metric', /(?:font-size|line-height|letter-spacing):\s*-?[\d.]+(?:em|rem)?\s*;/g],
  ['primitive consumed by component', /var\(--(?:color|scale|font-family)-/g],
  ['raw responsive query', /@media\s*\([^)]*(?:max|min)-width:/g],
  ['raw cursor (use a --cursor-* token)', /cursor:\s*(?!var\(|inherit\b|none\b)[a-z-]+/g],
]) {
  for (const match of clean.matchAll(pattern)) errors.push(label + ': ' + match[0]);
}
for (const match of componentCode.matchAll(/["'`]#[\da-f]{3,8}["'`]|\b(?:rgb|hsl)a?\(/gi)) errors.push('Raw component color: ' + match[0]);
const widths = readBreakpoints();
if (!(widths.mobile < widths.tablet && widths.tablet < widths.desktop)) errors.push('Breakpoints must be ordered Mobile < Tablet < Desktop');
for (const mode of ['light', 'dark']) {
 const block = fs.readFileSync(new URL('design/theme.css', src), 'utf8').match(new RegExp('\\[data-theme="' + mode + '"\\]\\s*\\{([\\s\\S]*?)\\}'))?.[1] || '';
 for (const group of ['surface', 'line', 'action', 'state', 'text', 'icon']) {
  if (!block.includes('--' + group + '-')) errors.push(mode + ' is missing ' + group);
 }
}
for (const size of ['xxs','xs','sm','base','md','lg','xl','2xl','3xl','4xl','5xl','6xl','7xl','8xl','9xl']) {
 for (const field of ['size','family','weight','line','tracking']) {
  if (!definitions.has('--text-' + size + '-' + field)) errors.push('Incomplete text style ' + size + '/' + field);
 }
}
if (errors.length) { console.error([...new Set(errors)].join('\n')); process.exit(1); }
console.log('Design system verified: references, theme groups, text styles, breakpoint order, and component token usage.');
