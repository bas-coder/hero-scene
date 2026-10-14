import { useMemo } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { sceneColor } from "../sceneColor";

/** The Flable mark as a glossy desk object, extruded from the client's Logo.svg in its real three-bar gradient. */

// The Flable mark, from the client's Logo.svg (shapes only; colours come from tokens). viewBox 0 0 34 32.
const markBars = [
  {
    d: "M0 12.7241V20.4505C0.410463 19.6778 0.684105 19.1627 1.19718 18.3579C3.9336 12.1124 9.20121 9.66575 13.8189 9.66575L24.5594 9.60137C26.0087 9.60137 28.5599 8.80322 30.4769 7.25127C32.5864 5.54344 34 2.98223 34 0.941406H13.5453C7.93561 0.941408 0.855131 5.25529 0 12.7241Z",
    from: "--scene-flable-mark-top-from",
    to: "--scene-flable-mark-top-to",
    line: [14, 2.50942, 12.6693, 14.7631],
  },
  {
    d: "M13.34 11.9189H27.2616C26.6618 16.1801 23.1016 18.8113 19.7022 19.8385C17.0919 20.6272 14.6326 20.2078 13.34 20.4501C10.676 20.9496 8.22052 21.6697 5.67807 23.7338C3.91145 25.1681 2.17362 27.311 0 30.3334V20.5145C2.77062 14.591 7.90141 11.9189 13.34 11.9189Z",
    from: "--scene-flable-mark-mid-from",
    to: "--scene-flable-mark-mid-to",
    line: [13.6308, 11.9189, 10.8289, 21.4295],
  },
  {
    d: "M5.64386 23.7661C3.87725 25.2004 2.17362 27.4076 0 30.4301C2.12072 30.4301 4.68612 29.6989 6.80684 27.9834C10.9457 24.6353 8.41449 21.8023 13.3742 20.4502C10.7102 20.9497 8.18632 21.7019 5.64386 23.7661Z",
    from: "--scene-flable-mark-tail-from",
    to: "--scene-flable-mark-tail-to",
    line: [5.06237, 23.8627, 5.00712, 27.921],
  },
] as const;

export function FlableMark() {
  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const loader = new SVGLoader();
    markBars.forEach((bar) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 32"><path d="${bar.d}"/></svg>`;
      const shapes = loader.parse(svg).paths.flatMap((path) => path.toShapes());
      // Thick enough to read as an object on the desk, not a sticker.
      const extruded = new THREE.ExtrudeGeometry(shapes, { depth: 7, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.6, bevelSegments: 5, curveSegments: 24 });
      // The bar's own linear gradient, written into vertex colours along the SVG gradient line.
      const from = sceneColor(bar.from);
      const to = sceneColor(bar.to);
      const [x1, y1, x2, y2] = bar.line;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = dx * dx + dy * dy;
      const position = extruded.getAttribute("position");
      const colors = new Float32Array(position.count * 3);
      const mixed = new THREE.Color();
      for (let i = 0; i < position.count; i += 1) {
        const t = THREE.MathUtils.clamp(((position.getX(i) - x1) * dx + (position.getY(i) - y1) * dy) / length, 0, 1);
        mixed.copy(from).lerp(to, t);
        colors.set([mixed.r, mixed.g, mixed.b], i * 3);
      }
      extruded.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      parts.push(extruded);
    });
    const merged = new THREE.BufferGeometry();
    // Merge by hand (no extra import): concatenate non-indexed copies.
    const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part));
    for (const name of ["position", "normal", "color"]) {
      const total = flat.reduce((sum, part) => sum + part.getAttribute(name).array.length, 0);
      const array = new Float32Array(total);
      let offset = 0;
      flat.forEach((part) => {
        array.set(part.getAttribute(name).array as Float32Array, offset);
        offset += part.getAttribute(name).array.length;
      });
      merged.setAttribute(name, new THREE.BufferAttribute(array, 3));
    }
    // SVG y runs down: flip, stand it on its lowest point, centre it.
    merged.scale(1, -1, 1);
    merged.computeBoundingBox();
    const box = merged.boundingBox!;
    merged.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    merged.computeVertexNormals();
    return merged;
  }, []);
  const material = useMemo(
    () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, envMapIntensity: 1.1 }),
    [],
  );
  return <mesh geometry={geometry} material={material} scale={0.03} castShadow receiveShadow />;
}
