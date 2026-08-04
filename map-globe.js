import * as THREE from "./vendor/three.module.min.js";
import { SVGLoader } from "./vendor/addons/SVGLoader.js";

const canvas = document.querySelector("#globeCanvas");
const container = document.querySelector("#mapView");
const labelLayer = document.querySelector("#globeLabels");
const status = document.querySelector("#mapStatus");
const DEFAULT_GLOBE_COVERAGE = .95;
const DEFAULT_GLOBE_ROTATION = { x: .66, y: .11 };
const AUTO_ROTATION_SPEED = .000025;

function cameraDistanceForCoverage(verticalFov, coverage) {
  const halfFov = THREE.MathUtils.degToRad(verticalFov / 2);
  return 1 / Math.sin(Math.atan(Math.tan(halfFov) * coverage));
}

class GlobeMap {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    this.camera.position.z = cameraDistanceForCoverage(this.camera.fov, DEFAULT_GLOBE_COVERAGE);
    this.globe = new THREE.Group();
    this.globe.rotation.set(DEFAULT_GLOBE_ROTATION.x, DEFAULT_GLOBE_ROTATION.y, 0);
    this.scene.add(this.globe);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.nodes = [];
    this.relationships = [];
    this.nodeGeometry = new THREE.SphereGeometry(1, 18, 12);
    this.labels = [];
    this.drag = null;
    this.dragDistance = 0;
    this.visible = false;
    this.frame = null;
    this.lastFrameTime = null;
    this.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.addEarth();
    this.bindEvents();
    new ResizeObserver(() => this.resize()).observe(container);
  }

  addEarth() {
    const earthMaterial = new THREE.MeshBasicMaterial({ color: 0xf6f5ef });
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      earthMaterial
    );
    earth.name = "countries";
    this.globe.add(earth);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.003, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: .5, side: THREE.BackSide })
    );
    this.globe.add(atmosphere);
    this.loadCountries(earthMaterial);
  }

  async loadCountries(earthMaterial) {
    try {
      const response = await fetch("assets/map/world-countries.svg");
      if (!response.ok) throw new Error(`Country SVG returned ${response.status}`);
      const svg = await response.text();
      await this.applyLandFill(earthMaterial, svg);
      const paths = new SVGLoader().parse(svg).paths;
      const segments = new Map();
      paths.forEach(path => path.subPaths.forEach(subPath => {
        const points = subPath.getPoints(1);
        for (let index = 1; index < points.length; index += 1) {
          const start = points[index - 1];
          const end = points[index];
          const startKey = `${start.x.toFixed(2)},${start.y.toFixed(2)}`;
          const endKey = `${end.x.toFixed(2)},${end.y.toFixed(2)}`;
          const edgeKey = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
          if (!segments.has(edgeKey)) segments.set(edgeKey, [start, end]);
        }
      }));
      const globePoints = [];
      segments.forEach(segment => segment.forEach(point => globePoints.push(this.coordinateVector(
        90 - point.y / 1000 * 180,
        point.x / 2000 * 360 - 180,
        1.004
      ))));
      const material = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: .34 });
      const countryLines = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(globePoints),
        material
      );
      countryLines.name = "country-outlines";
      this.globe.add(countryLines);
      status.textContent = "Drag to rotate · scroll to zoom";
      this.draw();
    } catch (_) {
      status.textContent = "Country boundaries unavailable · nodes still mapped";
      this.draw();
    }
  }

  async applyLandFill(material, svg) {
    const fillOnlySvg = svg
      .replace('fill="#e2e1da"', 'fill="#ecebe4"')
      .replace(/stroke="#111" stroke-width="[^"]+"/, 'stroke="none"');
    const url = URL.createObjectURL(new Blob([fillOnlySvg], { type: "image/svg+xml" }));
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Country fill could not be decoded"));
        image.src = url;
      });
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = 2048;
      textureCanvas.height = 1024;
      textureCanvas.getContext("2d").drawImage(image, 0, 0, textureCanvas.width, textureCanvas.height);
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  bindEvents() {
    canvas.addEventListener("pointerdown", event => {
      canvas.setPointerCapture(event.pointerId);
      this.drag = { x: event.clientX, y: event.clientY };
      this.dragDistance = 0;
    });
    canvas.addEventListener("pointermove", event => {
      if (this.drag) {
        const dx = event.clientX - this.drag.x;
        const dy = event.clientY - this.drag.y;
        this.dragDistance += Math.abs(dx) + Math.abs(dy);
        this.globe.rotation.y += dx * .006;
        this.globe.rotation.x = THREE.MathUtils.clamp(this.globe.rotation.x + dy * .004, -1.15, 1.15);
        this.drag = { x: event.clientX, y: event.clientY };
        this.draw();
      }
      this.updateHover(event);
    });
    canvas.addEventListener("pointerup", event => {
      if (this.dragDistance < 5) this.selectAt(event);
      this.drag = null;
    });
    canvas.addEventListener("pointercancel", () => { this.drag = null; });
    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z + event.deltaY * .002, 1.75, 5);
      this.draw();
    }, { passive: false });
    canvas.addEventListener("dblclick", () => this.reset());
    canvas.addEventListener("keydown", event => {
      const step = event.shiftKey ? .25 : .1;
      if (event.key === "ArrowLeft") this.globe.rotation.y -= step;
      else if (event.key === "ArrowRight") this.globe.rotation.y += step;
      else if (event.key === "ArrowUp") this.globe.rotation.x = Math.max(-1.15, this.globe.rotation.x - step);
      else if (event.key === "ArrowDown") this.globe.rotation.x = Math.min(1.15, this.globe.rotation.x + step);
      else if (["+", "="].includes(event.key)) this.camera.position.z = Math.max(1.75, this.camera.position.z - .2);
      else if (event.key === "-") this.camera.position.z = Math.min(5, this.camera.position.z + .2);
      else return;
      event.preventDefault();
      this.draw();
    });
  }

  coordinateVector(latitude, longitude, radius = 1.018) {
    const lat = THREE.MathUtils.degToRad(latitude);
    const lon = THREE.MathUtils.degToRad(longitude);
    return new THREE.Vector3(
      Math.cos(lat) * Math.cos(lon) * radius,
      Math.sin(lat) * radius,
      -Math.cos(lat) * Math.sin(lon) * radius
    );
  }

  render(payload) {
    this.clearNodes();
    const itemById = new Map(payload.items.map(item => [item.id, item]));
    (payload.relationships || []).forEach(relationship => {
      const source = itemById.get(relationship.source), target = itemById.get(relationship.target);
      if (!source || !target) return;
      const start = this.coordinateVector(source.lat, source.lon, 1.022);
      const end = this.coordinateVector(target.lat, target.lon, 1.022);
      const midpoint = start.clone().add(end);
      if (midpoint.lengthSq() < .01) midpoint.copy(start).add(new THREE.Vector3(0, .25, 0));
      midpoint.normalize().multiplyScalar(1.055 + Math.min(.08, start.distanceTo(end) * .035));
      const geometry = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(start, midpoint, end).getPoints(28));
      const material = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: payload.relationshipLayer === "always" ? payload.relationshipStrength : 0 });
      const line = new THREE.Line(geometry, material);
      line.userData = { ...relationship, baseOpacity: payload.relationshipStrength, mode: payload.relationshipLayer };
      this.globe.add(line);
      this.relationships.push(line);
    });
    payload.items.forEach(item => {
      const material = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: .35 + item.intensity * .65
      });
      const node = new THREE.Mesh(this.nodeGeometry, material);
      node.position.copy(this.coordinateVector(item.lat, item.lon));
      node.scale.setScalar((item.secondary ? .009 : .012) + item.intensity * (item.secondary ? .018 : .026));
      node.userData = item;
      this.globe.add(node);
      this.nodes.push(node);
      if (item.showLabel) {
        const label = document.createElement("span");
        label.className = "globe-label";
        label.textContent = item.name;
        label.style.fontSize = `${payload.labelSize}px`;
        labelLayer.append(label);
        this.labels.push({ node, label });
      }
    });
    status.textContent = "Drag to rotate · scroll to zoom";
    this.setVisible(true);
  }

  clearNodes() {
    this.nodes.forEach(node => {
      this.globe.remove(node);
      node.material.dispose();
    });
    this.nodes = [];
    this.relationships.forEach(line => {
      this.globe.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    });
    this.relationships = [];
    this.labels = [];
    labelLayer.replaceChildren();
  }

  pointerFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    this.pointer.set(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  intersectionAt(event) {
    this.pointerFromEvent(event);
    return this.raycaster.intersectObjects(this.nodes, false)[0]?.object || null;
  }

  updateHover(event) {
    const node = this.intersectionAt(event);
    this.relationships.forEach(line => {
      const connected = node && [line.userData.source, line.userData.target].includes(node.userData.id);
      line.material.opacity = node ? (connected ? .8 : .015) : (line.userData.mode === "always" ? line.userData.baseOpacity : 0);
    });
    canvas.classList.toggle("has-map-target", Boolean(node));
    canvas.title = node ? `${node.userData.name} · ${node.userData.formattedValue}` : "";
  }

  selectAt(event) {
    const node = this.intersectionAt(event);
    if (node) window.dispatchEvent(new CustomEvent("ufo-map-select", { detail: { entityId: node.userData.id } }));
  }

  updateLabels() {
    const cameraDirection = this.camera.position.clone().normalize();
    const bounds = canvas.getBoundingClientRect();
    this.labels.forEach(({ node, label }) => {
      const world = node.getWorldPosition(new THREE.Vector3());
      const visible = world.clone().normalize().dot(cameraDirection) > .15;
      const projected = world.clone().project(this.camera);
      label.hidden = !visible || projected.z < -1 || projected.z > 1;
      if (!label.hidden) {
        label.style.transform = `translate(-50%, -50%) translate(${(projected.x * .5 + .5) * bounds.width}px, ${(-projected.y * .5 + .5) * bounds.height}px)`;
      }
    });
  }

  resize() {
    if (container.hidden) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.draw();
  }

  draw() {
    if (!this.visible || container.hidden) return;
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }

  animate(timestamp) {
    if (!this.visible) {
      this.frame = null;
      this.lastFrameTime = null;
      return;
    }
    if (this.autoRotate && !this.drag && this.lastFrameTime !== null) {
      const elapsed = Math.min(50, timestamp - this.lastFrameTime);
      this.globe.rotation.y += elapsed * AUTO_ROTATION_SPEED;
    }
    this.lastFrameTime = timestamp;
    this.draw();
    this.frame = requestAnimationFrame(nextTimestamp => this.animate(nextTimestamp));
  }

  setVisible(visible) {
    this.visible = visible;
    if (visible) {
      this.resize();
      if (this.frame === null) this.frame = requestAnimationFrame(timestamp => this.animate(timestamp));
    }
  }

  reset() {
    this.globe.rotation.set(DEFAULT_GLOBE_ROTATION.x, DEFAULT_GLOBE_ROTATION.y, 0);
    this.camera.position.z = cameraDistanceForCoverage(this.camera.fov, DEFAULT_GLOBE_COVERAGE);
    this.draw();
  }

  exportPNG(filename) {
    this.draw();
    const link = document.createElement("a");
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.download = `${filename}.png`;
    link.click();
  }
}

try {
  const globe = new GlobeMap();
  window.ufoGlobe = globe;
  window.addEventListener("ufo-map-render", event => globe.render(event.detail));
  window.addEventListener("ufo-map-visibility", event => globe.setVisible(event.detail.visible));
  if (window.pendingGlobeRender) globe.render(window.pendingGlobeRender);
} catch (_) {
  status.textContent = "Interactive WebGL map unavailable";
}
