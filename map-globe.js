import * as THREE from "./vendor/three.module.min.js";

const canvas = document.querySelector("#globeCanvas");
const container = document.querySelector("#mapView");
const labelLayer = document.querySelector("#globeLabels");
const status = document.querySelector("#mapStatus");

class GlobeMap {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    this.camera.position.z = 3.05;
    this.globe = new THREE.Group();
    this.globe.rotation.set(-.12, .08, 0);
    this.scene.add(this.globe);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.nodes = [];
    this.nodeGeometry = new THREE.SphereGeometry(1, 18, 12);
    this.labels = [];
    this.drag = null;
    this.dragDistance = 0;
    this.visible = false;
    this.frame = null;
    this.addEarth();
    this.bindEvents();
    new ResizeObserver(() => this.resize()).observe(container);
  }

  addEarth() {
    const texture = new THREE.TextureLoader().load(
      "assets/map/world-countries.svg",
      loaded => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        status.textContent = "Drag to rotate · scroll to zoom";
        this.draw();
      },
      undefined,
      () => { status.textContent = "Country map unavailable"; }
    );
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff })
    );
    earth.name = "countries";
    this.globe.add(earth);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.025, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: .04, side: THREE.BackSide })
    );
    this.globe.add(atmosphere);
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
    this.visible = true;
    this.clearNodes();
    payload.items.forEach(item => {
      const material = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: .35 + item.intensity * .65
      });
      const node = new THREE.Mesh(this.nodeGeometry, material);
      node.position.copy(this.coordinateVector(item.lat, item.lon));
      node.scale.setScalar(.012 + item.intensity * .026);
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
    this.resize();
  }

  clearNodes() {
    this.nodes.forEach(node => {
      this.globe.remove(node);
      node.material.dispose();
    });
    this.nodes = [];
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

  setVisible(visible) {
    this.visible = visible;
    if (visible) this.resize();
  }

  reset() {
    this.globe.rotation.set(-.12, .08, 0);
    this.camera.position.z = 3.05;
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
