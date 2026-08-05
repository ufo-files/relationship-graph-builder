import * as THREE from "./vendor/three.module.min.js";
import { SVGLoader } from "./vendor/addons/SVGLoader.js";

const canvas = document.querySelector("#globeCanvas");
const container = document.querySelector("#mapView");
const labelLayer = document.querySelector("#globeLabels");
const status = document.querySelector("#mapStatus");
const DEFAULT_GLOBE_COVERAGE = .72;
const DEFAULT_CAMERA_TARGET_X = 0;
const DEFAULT_GLOBE_ROTATION = { x: .01375, y: 0 };
const AUTO_ROTATION_SPEED = .000025;
const EARTH_EQUATORIAL_RADIUS_KM = 6371;
const MOON_EQUATORIAL_RADIUS_KM = 1737.4;
const MOON_MEAN_ORBIT_RADIUS_KM = 384_400;
const MOON_ORBIT_DAYS = 27.322;
const MOON_ORBIT_INCLINATION = 5.145;
const MOON_RADIUS = MOON_EQUATORIAL_RADIUS_KM / EARTH_EQUATORIAL_RADIUS_KM;
const MOON_ORBIT_RADIUS = MOON_MEAN_ORBIT_RADIUS_KM / EARTH_EQUATORIAL_RADIUS_KM;
// Physical time is compressed so a complete orbit is observable in the interactive view.
const MOON_DISPLAY_ORBIT_PERIOD_MS = 300_000;
const MOON_ORBIT_SPEED = Math.PI * 2 / MOON_DISPLAY_ORBIT_PERIOD_MS;
const MIN_MOON_TRANSIT_SECONDS = 2;
const MAX_MOON_TRANSIT_SECONDS = 10;
const DEFAULT_MOON_TRANSIT_SECONDS = 5;
const DEFAULT_MOON_ORBIT_ANGLE = 1.545;
const DEFAULT_CAMERA_DISTANCE = 600;
const MIN_CAMERA_DISTANCE = 70;
const MAX_CAMERA_DISTANCE = 1_200;

function cameraDistanceForCoverage(verticalFov, coverage) {
  const halfFov = THREE.MathUtils.degToRad(verticalFov / 2);
  return 1 / Math.sin(Math.atan(Math.tan(halfFov) * coverage));
}

function verticalFovForCoverageAtDistance(distance, coverage) {
  const apparentHalfAngle = Math.asin(1 / distance);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(apparentHalfAngle) / coverage));
}

const DEFAULT_CAMERA_FOV = verticalFovForCoverageAtDistance(DEFAULT_CAMERA_DISTANCE, DEFAULT_GLOBE_COVERAGE);

class GlobeMap {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(DEFAULT_CAMERA_FOV, 1, 10, 1_500);
    this.camera.position.set(DEFAULT_CAMERA_TARGET_X, 0, cameraDistanceForCoverage(this.camera.fov, DEFAULT_GLOBE_COVERAGE));
    this.camera.lookAt(DEFAULT_CAMERA_TARGET_X, 0, 0);
    this.earthMoonSystem = new THREE.Group();
    this.earthMoonSystem.rotation.set(DEFAULT_GLOBE_ROTATION.x, DEFAULT_GLOBE_ROTATION.y, 0);
    this.scene.add(this.earthMoonSystem);
    this.globe = new THREE.Group();
    this.earthMoonSystem.add(this.globe);
    this.raycaster = new THREE.Raycaster();
    this.labelRaycaster = new THREE.Raycaster();
    this.viewFrustum = new THREE.Frustum();
    this.viewProjection = new THREE.Matrix4();
    this.moonVisibilityCenter = new THREE.Vector3();
    this.moonVisibilitySphere = new THREE.Sphere(this.moonVisibilityCenter, MOON_RADIUS);
    this.moonOrbitAxis = new THREE.Vector3(0, 1, 0);
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
    this.autoRotate = false;
    this.moonTransitSeconds = DEFAULT_MOON_TRANSIT_SECONDS;
    this.moonWasInViewport = false;
    this.activeMoonTransitArc = null;
    this.addEarth();
    this.addMoon();
    this.bindEvents();
    new ResizeObserver(() => this.resize()).observe(container);
  }

  addMoon() {
    const orbitPlane = new THREE.Group();
    orbitPlane.rotation.z = THREE.MathUtils.degToRad(MOON_ORBIT_INCLINATION);
    this.earthMoonSystem.add(orbitPlane);
    this.moonOrbitPlane = orbitPlane;
    this.moonOrbit = new THREE.Group();
    this.moonOrbit.rotation.y = DEFAULT_MOON_ORBIT_ANGLE;
    orbitPlane.add(this.moonOrbit);

    this.moonMaterial = new THREE.MeshBasicMaterial({ color: 0xd0cec7 });
    const moon = new THREE.Group();
    moon.name = "moon";
    moon.position.x = MOON_ORBIT_RADIUS;
    // SphereGeometry maps the source's central near-side meridian to +X. At the
    // starting +X orbital position, rotate it toward Earth (-X). Inheriting the
    // orbit group's rotation then keeps that same face Earth-facing at every angle.
    moon.rotation.y = Math.PI;
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS, 64, 48),
      this.moonMaterial
    );
    surface.name = "moon-surface";
    moon.add(surface);
    const outline = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS * 1.012, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: .5, side: THREE.BackSide })
    );
    outline.name = "moon-outline";
    moon.add(outline);
    this.moon = moon;
    this.moonOrbit.add(moon);
  }

  loadMoonTexture() {
    if (this.moonTextureRequested) return;
    this.moonTextureRequested = true;
    new THREE.TextureLoader().load(
      "assets/map/moon-paper.png",
      texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        this.moonMaterial.map = texture;
        this.moonMaterial.color.set(0xffffff);
        this.moonMaterial.needsUpdate = true;
        this.draw();
      }
    );
  }

  addEarth() {
    const earthMaterial = new THREE.MeshBasicMaterial({ color: 0xf6f5ef });
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      earthMaterial
    );
    earth.name = "countries";
    this.earth = earth;
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
        this.earthMoonSystem.rotation.y += dx * .006;
        this.earthMoonSystem.rotation.x = THREE.MathUtils.clamp(this.earthMoonSystem.rotation.x + dy * .004, -1.15, 1.15);
        this.invalidateMoonTransit();
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
      const zoomFactor = Math.exp(event.deltaY * .0015);
      this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z * zoomFactor, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
      this.invalidateMoonTransit();
      this.draw();
    }, { passive: false });
    canvas.addEventListener("dblclick", () => this.reset());
    canvas.addEventListener("keydown", event => {
      const step = event.shiftKey ? .25 : .1;
      if (event.key === "ArrowLeft") this.earthMoonSystem.rotation.y -= step;
      else if (event.key === "ArrowRight") this.earthMoonSystem.rotation.y += step;
      else if (event.key === "ArrowUp") this.earthMoonSystem.rotation.x = Math.max(-1.15, this.earthMoonSystem.rotation.x - step);
      else if (event.key === "ArrowDown") this.earthMoonSystem.rotation.x = Math.min(1.15, this.earthMoonSystem.rotation.x + step);
      else if (["+", "="].includes(event.key)) this.camera.position.z = Math.max(MIN_CAMERA_DISTANCE, this.camera.position.z / 1.35);
      else if (event.key === "-") this.camera.position.z = Math.min(MAX_CAMERA_DISTANCE, this.camera.position.z * 1.35);
      else return;
      event.preventDefault();
      this.invalidateMoonTransit();
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

  itemVector(item, surfaceOffset = 0) {
    const radius = item.body === "moon" ? MOON_RADIUS + surfaceOffset : 1.018 + surfaceOffset;
    return this.coordinateVector(item.lat, item.lon, radius);
  }

  itemParent(item) {
    return item.body === "moon" ? this.moon : this.globe;
  }

  updateMoonNodes() {
    const moonCenter = this.moon.getWorldPosition(new THREE.Vector3());
    const towardCamera = this.camera.position.clone().sub(moonCenter).normalize();
    this.nodes.filter(node => node.userData.body === "moon").forEach(node => {
      const world = moonCenter.clone().add(towardCamera.clone().multiplyScalar(MOON_RADIUS + .006));
      node.position.copy(this.moon.worldToLocal(world));
    });
  }

  nodeSystemVector(node) {
    const world = node.getWorldPosition(new THREE.Vector3());
    return this.earthMoonSystem.worldToLocal(world);
  }

  updateRelationshipGeometry(line) {
    const start = this.nodeSystemVector(line.userData.sourceNode);
    const end = this.nodeSystemVector(line.userData.targetNode);
    const midpoint = start.clone().add(end);
    if (line.userData.celestial) {
      midpoint.multiplyScalar(.5);
      midpoint.y += Math.min(4, start.distanceTo(end) * .06);
    } else {
      if (midpoint.lengthSq() < .01) midpoint.copy(start).add(new THREE.Vector3(0, .25, 0));
      midpoint.normalize().multiplyScalar(1.055 + Math.min(.08, start.distanceTo(end) * .035));
    }
    line.geometry.setFromPoints(new THREE.QuadraticBezierCurve3(start, midpoint, end).getPoints(28));
  }

  updateDynamicObjects() {
    this.scene.updateMatrixWorld(true);
    this.updateMoonNodes();
    this.scene.updateMatrixWorld(true);
    this.relationships.forEach(line => this.updateRelationshipGeometry(line));
  }

  render(payload) {
    this.clearNodes();
    this.setMoonTransitSeconds(payload.moonTransitSeconds);
    payload.items.forEach(item => {
      const material = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: .35 + item.intensity * .65
      });
      const node = new THREE.Mesh(this.nodeGeometry, material);
      node.position.copy(this.itemVector(item));
      node.scale.setScalar(item.body === "moon"
        ? .055 + item.intensity * .025
        : (item.secondary ? .009 : .012) + item.intensity * (item.secondary ? .018 : .026));
      node.userData = item;
      this.itemParent(item).add(node);
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
    this.scene.updateMatrixWorld(true);
    this.updateMoonNodes();
    this.scene.updateMatrixWorld(true);
    const nodeById = new Map(this.nodes.map(node => [node.userData.id, node]));
    (payload.relationships || []).forEach(relationship => {
      const sourceNode = nodeById.get(relationship.source), targetNode = nodeById.get(relationship.target);
      if (!sourceNode || !targetNode) return;
      const material = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: payload.relationshipLayer === "always" ? payload.relationshipStrength : 0 });
      const line = new THREE.Line(new THREE.BufferGeometry(), material);
      line.userData = {
        ...relationship,
        sourceNode,
        targetNode,
        celestial: sourceNode.userData.body === "moon" || targetNode.userData.body === "moon",
        baseOpacity: payload.relationshipStrength,
        mode: payload.relationshipLayer
      };
      this.earthMoonSystem.add(line);
      this.relationships.push(line);
      this.updateRelationshipGeometry(line);
    });
    status.textContent = "Drag to rotate · scroll to zoom";
    this.setVisible(true);
  }

  clearNodes() {
    this.nodes.forEach(node => {
      node.parent?.remove(node);
      node.material.dispose();
    });
    this.nodes = [];
    this.relationships.forEach(line => {
      line.parent?.remove(line);
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

  labelOccludedByEarth(world) {
    const cameraWorld = this.camera.getWorldPosition(new THREE.Vector3());
    const direction = world.clone().sub(cameraWorld);
    const labelDistance = direction.length();
    if (!labelDistance) return false;
    this.labelRaycaster.set(cameraWorld, direction.normalize());
    const earthHit = this.labelRaycaster.intersectObject(this.earth, false)[0];
    return Boolean(earthHit && earthHit.distance < labelDistance - .001);
  }

  updateLabels() {
    const cameraDirection = this.camera.getWorldDirection(new THREE.Vector3()).negate();
    const bounds = canvas.getBoundingClientRect();
    this.labels.forEach(({ node, label }) => {
      const world = node.getWorldPosition(new THREE.Vector3());
      const surfaceNormal = node.position.clone().normalize().transformDirection(node.parent.matrixWorld);
      const visible = surfaceNormal.dot(cameraDirection) > .15;
      const projected = world.clone().project(this.camera);
      const occluded = this.labelOccludedByEarth(world);
      label.hidden = !visible || occluded || projected.z < -1 || projected.z > 1;
      if (!label.hidden) {
        label.style.transform = `translate(-50%, -50%) translate(${(projected.x * .5 + .5) * bounds.width}px, ${(-projected.y * .5 + .5) * bounds.height}px)`;
      }
    });
  }

  invalidateMoonTransit() {
    this.moonWasInViewport = false;
    this.activeMoonTransitArc = null;
  }

  updateViewFrustum() {
    this.camera.updateMatrixWorld(true);
    this.moonOrbitPlane.updateWorldMatrix(true, false);
    this.viewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.viewFrustum.setFromProjectionMatrix(this.viewProjection);
  }

  moonVisibleAtAngle(angle) {
    this.moonVisibilityCenter.set(MOON_ORBIT_RADIUS, 0, 0)
      .applyAxisAngle(this.moonOrbitAxis, angle)
      .applyMatrix4(this.moonOrbitPlane.matrixWorld);
    return this.viewFrustum.intersectsSphere(this.moonVisibilitySphere);
  }

  visibleMoonTransitArc(angle) {
    const step = THREE.MathUtils.degToRad(1);
    const boundary = direction => {
      let visibleAngle = angle;
      for (let index = 0; index < 360; index += 1) {
        const candidate = visibleAngle + step * direction;
        if (!this.moonVisibleAtAngle(candidate)) {
          let inside = visibleAngle;
          let outside = candidate;
          for (let refinement = 0; refinement < 16; refinement += 1) {
            const midpoint = (inside + outside) / 2;
            if (this.moonVisibleAtAngle(midpoint)) inside = midpoint;
            else outside = midpoint;
          }
          return (inside + outside) / 2;
        }
        visibleAngle = candidate;
      }
      return null;
    };
    const start = boundary(-1);
    const end = boundary(1);
    return start === null || end === null ? Math.PI * 2 : end - start;
  }

  animationSpeeds() {
    this.updateViewFrustum();
    const angle = this.moonOrbit.rotation.y;
    const moonInViewport = this.moonVisibleAtAngle(angle);
    if (moonInViewport && (!this.moonWasInViewport || this.activeMoonTransitArc === null)) {
      this.activeMoonTransitArc = this.visibleMoonTransitArc(angle);
    } else if (!moonInViewport) {
      this.activeMoonTransitArc = null;
    }
    this.moonWasInViewport = moonInViewport;
    if (!moonInViewport || !this.activeMoonTransitArc) {
      return { moon: MOON_ORBIT_SPEED, earth: AUTO_ROTATION_SPEED };
    }
    const moon = this.activeMoonTransitArc / (this.moonTransitSeconds * 1_000);
    const earthSlowdown = MIN_MOON_TRANSIT_SECONDS / this.moonTransitSeconds;
    return { moon, earth: AUTO_ROTATION_SPEED * earthSlowdown };
  }

  resize() {
    if (container.hidden) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.invalidateMoonTransit();
    this.draw();
  }

  draw() {
    if (!this.visible || container.hidden) return;
    this.updateDynamicObjects();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }

  animate(timestamp) {
    if (!this.visible) {
      this.frame = null;
      this.lastFrameTime = null;
      return;
    }
    if (this.autoRotate && this.lastFrameTime !== null && !this.drag) {
      const elapsed = Math.min(50, timestamp - this.lastFrameTime);
      const speed = this.animationSpeeds();
      this.moonOrbit.rotation.y += elapsed * speed.moon;
      this.globe.rotation.y += elapsed * speed.earth;
    }
    this.lastFrameTime = timestamp;
    this.draw();
    this.frame = requestAnimationFrame(nextTimestamp => this.animate(nextTimestamp));
  }

  setVisible(visible) {
    this.visible = visible;
    if (visible) {
      this.loadMoonTexture();
      this.resize();
      if (this.frame === null) this.frame = requestAnimationFrame(timestamp => this.animate(timestamp));
    }
  }

  setPlaying(playing) {
    this.autoRotate = Boolean(playing);
    this.lastFrameTime = null;
    window.dispatchEvent(new CustomEvent("ufo-map-playback", { detail: { playing: this.autoRotate } }));
    return this.autoRotate;
  }

  setMoonTransitSeconds(seconds) {
    this.moonTransitSeconds = THREE.MathUtils.clamp(Number(seconds) || DEFAULT_MOON_TRANSIT_SECONDS, MIN_MOON_TRANSIT_SECONDS, MAX_MOON_TRANSIT_SECONDS);
    return this.moonTransitSeconds;
  }

  reset() {
    this.earthMoonSystem.rotation.set(DEFAULT_GLOBE_ROTATION.x, DEFAULT_GLOBE_ROTATION.y, 0);
    this.globe.rotation.set(0, 0, 0);
    this.moonOrbit.rotation.set(0, DEFAULT_MOON_ORBIT_ANGLE, 0);
    this.camera.position.set(DEFAULT_CAMERA_TARGET_X, 0, cameraDistanceForCoverage(this.camera.fov, DEFAULT_GLOBE_COVERAGE));
    this.camera.lookAt(DEFAULT_CAMERA_TARGET_X, 0, 0);
    this.invalidateMoonTransit();
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
