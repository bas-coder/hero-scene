import fs from 'node:fs';
const design = new URL('../src/design/', import.meta.url);
export function readBreakpoints() {
  const primitives = fs.readFileSync(new URL('primitives.css', design), 'utf8');
  const responsive = fs.readFileSync(new URL('responsive.css', design), 'utf8');
  return Object.fromEntries(['desktop', 'tablet', 'mobile'].map(mode => {
    const alias = responsive.match(new RegExp('--breakpoint-' + mode + ':\\s*var\\((--scale-[\\w-]+)\\)'));
    const value = alias && primitives.match(new RegExp(alias[1] + ':\\s*(\\d+)px'));
    if (!value) throw new Error('Invalid breakpoint alias: ' + mode);
    return [mode, Number(value[1])];
  }));
}
export function designMedia() {
  return { postcssPlugin: 'design-system-media', AtRule(rule) {
    if (rule.name !== 'media') return;
    rule.params = rule.params.replace(/\((?:--)(desktop|tablet|mobile)\)/g, (_, mode) => '(max-width: ' + readBreakpoints()[mode] + 'px)');
  } };
}
