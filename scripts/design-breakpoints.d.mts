export function readBreakpoints(): Record<'desktop' | 'tablet' | 'mobile', number>;
export function designMedia(): import('postcss').Plugin;
