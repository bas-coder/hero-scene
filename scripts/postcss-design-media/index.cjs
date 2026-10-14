// PostCSS entry for Next.js. Packaged locally so Turbopack can resolve it by name; the logic lives in design-breakpoints.mjs.
const { designMedia } = require("../design-breakpoints.mjs");

module.exports = () => designMedia();
module.exports.postcss = true;
