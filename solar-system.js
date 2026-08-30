import * as THREE from "./vendor/three.module.min.js";

const canvas = document.querySelector("#solarCanvas");
const container = document.querySelector("#solarView");
const labels = document.querySelector("#solarLabels");
const leaders = document.querySelector("#solarLeaders");
const roster = document.querySelector("#solarRoster");
const status = document.querySelector("#solarStatus");
const scaleNote = document.querySelector("#solarScale");
const DEG = Math.PI / 180;
const KPC_TO_LY = 3261.56;

const SUN_GALACTOCENTRIC_RADIUS_LY = 8.3 * KPC_TO_LY;
const GALAXY_DISPLAY_RADIUS_KPC = 18;
const LOCAL_DETAIL_RADIUS_LY = 1000;
const LOCAL_CAMERA_DISTANCE_LY = 1900;
const HILL_FISH_FRAME_FILL = .8;
const HILL_FISH_MIN_CAMERA_DISTANCE_LY = 90;
const HILL_FISH_DEPTH_PADDING_LY = 8;
const HILL_FISH_CORPUS_FRAME_RADIUS_LY = 100;
const HILL_FISH_CASES = new Set(["hill_fish"]);
const CORPUS_NODE_MIN_PX = 6;
const CORPUS_NODE_MAX_PX = 50;
const CORPUS_NODE_EXPONENT = Math.log10(5);
const HILL_FISH_CORPUS_LABEL_LIMIT = 7;
const HILL_FISH_REFERENCE_LABEL_LIMIT = 3;
const HILL_FISH_VISIBLE_LABEL_IDS = new Set(["zeta_1_reticuli","zeta_2_reticuli"]);
const HILL_FISH_VISIBLE_TARGET_IDS = new Set(["aldebaran","arcturus"]);
const HILL_FISH_EDGE_LABEL_IDS = new Set(["gliese_86_1"]);
const HILL_FISH_EDGE_TARGET_IDS = new Set(["polaris"]);
const HILL_FISH_EDGE_NODE_MIN_PX = 12;
const HILL_FISH_PINNED_LABEL_GAP_PX = 16;
const MODEL_ROTATION_PERIOD_MS = 30_000;
const MODEL_ROTATION_SPEED = Math.PI * 2 / MODEL_ROTATION_PERIOD_MS;
const MODEL_AUTO_PLAY = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function localGalacticPosition(ra, dec, distance) {
  const R=ra*DEG,D=dec*DEG,x=Math.cos(D)*Math.cos(R),y=Math.cos(D)*Math.sin(R),z=Math.sin(D);
  const gx=(-.0548755604*x-.8734370902*y-.4838350155*z)*distance;
  const gy=(.4941094279*x-.4448296300*y+.7469822445*z)*distance;
  const gz=(-.8676661490*x-.1980763734*y+.4559837762*z)*distance;
  return new THREE.Vector3(gy,gz,-gx);
}

function galactocentricPosition(star) {
  return localGalacticPosition(star.ra,star.dec,star.distance).add(new THREE.Vector3(0,0,SUN_GALACTOCENTRIC_RADIUS_LY));
}

function spiralTracerPosition(tracer) {
  return new THREE.Vector3(tracer.x*KPC_TO_LY,tracer.z*KPC_TO_LY,tracer.y*KPC_TO_LY);
}

function astronomyTargetGroups(targets) {
  const sorted=[...(targets || [])].sort((a,b)=>(b.mentionCount || 0)-(a.mentionCount || 0) || a.name.localeCompare(b.name));
  const assigned=new Set();
  const take=predicate=>sorted.filter(target=>!assigned.has(target.targetId)&&predicate(target)&&assigned.add(target.targetId));
  const solar=take(target=>target.system==="Solar System" || target.targetId==="solar_system");
  const positioned=take(target=>target.position?.frame==="ICRS");
  const scene=take(target=>["milky_way","galactic_center"].includes(target.targetId));
  const unpositioned=take(()=>true);
  return {sorted,solar,positioned,scene,unpositioned};
}

class SolarModel {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0xf6f5ef, 0);
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 100, 300000);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.targets = []; this.hoveredNode = null; this.caseRoutes = []; this.hoveredRoute = null; this.caseTargetNodes = new Map(); this.casePositions = new Map(); this.caseDefaultView = null; this.spiralReady = false; this.skyReady = false; this.gaiaReady = false; this.gaiaUnavailable = false; this.caseReady = false; this.caseUnavailable = false; this.markerTexture = null; this.ringTexture = null; this.visible = false; this.distance = 64; this.yaw = -.45; this.pitch = .72; this.autoRotate = MODEL_AUTO_PLAY; this.frame = null; this.lastFrameTime = null; this.rotationAxis = new THREE.Vector3(0,1,0);
    this.drag = null; this.pointers = new Map(); this.pinchDistance = null; this.bind(); new ResizeObserver(() => this.resize()).observe(container);
  }
  bind() {
    const pinchDistance = () => { const [a,b]=[...this.pointers.values()]; return a&&b?Math.hypot(a.x-b.x,a.y-b.y):null; };
    const finishPointer = e => { this.pointers.delete(e.pointerId); this.pinchDistance=this.pointers.size===2?pinchDistance():null; const remaining=[...this.pointers.values()][0]; this.drag=remaining?{...remaining}:null;if(!remaining&&this.autoRotate)this.syncRotationAxis(); };
    canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId);if(!this.pointers.size){this.dragMoved=false;this.dragDistance=0;}this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(this.pointers.size===2){this.pinchDistance=pinchDistance();this.drag=null;}else this.drag={x:e.clientX,y:e.clientY}; });
    canvas.addEventListener("pointermove", e => { if(!this.pointers.has(e.pointerId)){this.updateNodeHover(e);return;}this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===2){const next=pinchDistance();if(this.pinchDistance&&next)this.zoomBy(this.pinchDistance/next);this.pinchDistance=next;this.dragMoved=true;return;}if (!this.drag||this.mode==="sky") return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.dragDistance+=Math.hypot(dx,dy);if(this.dragDistance>2)this.dragMoved=true; this.yaw += dx*.006; this.pitch = THREE.MathUtils.clamp(this.pitch+dy*.005,this.hillFishActive()?-1.5:.08,1.5); this.drag={x:e.clientX,y:e.clientY}; this.draw(); });
    canvas.addEventListener("pointerup", finishPointer); canvas.addEventListener("pointercancel", finishPointer);
    canvas.addEventListener("pointerleave",()=>this.updateNodeHover());
    canvas.addEventListener("click",e=>{if(this.dragMoved)return;const node=this.nodeAt(e);if(node){this.selectNode(node);return;}if(this.corpusClusterAt(e))window.dispatchEvent(new CustomEvent("ufo-solar-drilldown",{detail:{scale:"local"}}));});
    canvas.addEventListener("keydown",e=>{if(!["Enter"," "].includes(e.key))return;if(this.mode==="local"&&this.hoveredNode){e.preventDefault();this.selectNode(this.hoveredNode);return;}if(this.mode==="galaxy"){e.preventDefault();window.dispatchEvent(new CustomEvent("ufo-solar-drilldown",{detail:{scale:"local"}}));}});
    canvas.addEventListener("wheel", e => { e.preventDefault(); this.zoomBy(Math.exp(e.deltaY*.001)); }, {passive:false});
  }
  zoomBy(factor){this.distance=THREE.MathUtils.clamp(this.distance*factor,this.mode==="local"?10:18000,this.mode==="local"&&this.hillFishActive()?1200:this.mode==="local"?5000:220000);this.draw();}
  clear() {
    const geometries=new Set(),materials=new Set(),textures=new Set();
    while(this.root.children.length){const child=this.root.children[0];this.root.remove(child);child.traverse(object=>{if(object.geometry)geometries.add(object.geometry);const objectMaterials=Array.isArray(object.material)?object.material:[object.material];objectMaterials.filter(Boolean).forEach(material=>{materials.add(material);Object.values(material).filter(value=>value?.isTexture).forEach(texture=>textures.add(texture));});});}
    textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
    this.targets=[];this.hoveredNode=null;this.caseRoutes=[];this.hoveredRoute=null;this.caseTargetNodes=new Map();this.casePositions=new Map();this.caseDefaultView=null;this.spiralReady=false;this.skyReady=false;this.gaiaReady=false;this.gaiaUnavailable=false;this.caseReady=false;this.caseUnavailable=false;this.markerTexture=null;this.ringTexture=null;labels.replaceChildren();leaders.replaceChildren();roster.replaceChildren();canvas.classList.remove("has-corpus-cluster","has-node","has-case-route");canvas.title="";
  }
  line(points, opacity=.22, dashed=false, color=dashed?0x333333:0x111111, dashSize=2.5, gapSize=1.8) { const g=new THREE.BufferGeometry().setFromPoints(points);const material=dashed?new THREE.LineDashedMaterial({color,transparent:true,opacity,dashSize,gapSize}):new THREE.LineBasicMaterial({color,transparent:true,opacity});const line=new THREE.Line(g,material);if(dashed)line.computeLineDistances();this.root.add(line); }
  circularMarkerTexture() {
    if(this.markerTexture)return this.markerTexture;
    const marker=document.createElement("canvas");marker.width=256;marker.height=256;
    const context=marker.getContext("2d");context.fillStyle="#fff";context.beginPath();context.arc(128,128,126,0,Math.PI*2);context.fill();
    this.markerTexture=new THREE.CanvasTexture(marker);return this.markerTexture;
  }
  ringMarkerTexture() {
    if(this.ringTexture)return this.ringTexture;
    const marker=document.createElement("canvas");marker.width=32;marker.height=32;
    const context=marker.getContext("2d");context.strokeStyle="#fff";context.lineWidth=5;context.beginPath();context.arc(16,16,11,0,Math.PI*2);context.stroke();
    this.ringTexture=new THREE.CanvasTexture(marker);return this.ringTexture;
  }
  marker(position,color,size,screenSpace=false) {
    const mesh=screenSpace
      ? new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),new THREE.ShaderMaterial({uniforms:{pointSize:{value:size},pixelRatio:{value:this.renderer.getPixelRatio()},fillColor:{value:new THREE.Color(color)},borderColor:{value:new THREE.Color(0xf6f5ef)}},vertexShader:"uniform float pointSize;uniform float pixelRatio;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=(pointSize+2.0)*pixelRatio;}",fragmentShader:"uniform float pointSize;uniform vec3 fillColor;uniform vec3 borderColor;void main(){float spriteSize=pointSize+2.0;float distanceFromCenter=length(gl_PointCoord-vec2(.5));float antialias=.75/spriteSize;float outerAlpha=1.0-smoothstep(.5-antialias,.5+antialias,distanceFromCenter);float innerRadius=.5*pointSize/spriteSize;float fillMix=1.0-smoothstep(innerRadius-antialias,innerRadius+antialias,distanceFromCenter);gl_FragColor=vec4(mix(borderColor,fillColor,fillMix),outerAlpha);}",transparent:true,depthTest:false,depthWrite:false}))
      : new THREE.Mesh(new THREE.SphereGeometry(size,18,12),new THREE.MeshBasicMaterial({color}));
    mesh.position.copy(position);this.root.add(mesh);return mesh;
  }
  dot(name, position, color, size, secondary, labelOffset=null, screenSpace=false, priority=0,showMarker=true,nodeData=null) {
    const mesh=showMarker?this.marker(position,color,size,screenSpace):new THREE.Object3D();
    mesh.position.copy(position); mesh.userData={name,secondary,labelOffset,priority,...(nodeData || {}),baseMaterialSize:mesh.material?.uniforms?.pointSize?.value ?? mesh.material?.size,baseRenderOrder:mesh.renderOrder}; if(!showMarker)this.root.add(mesh);this.targets.push(mesh);
    const label=document.createElement("span");label.className="solar-label";const edgeProxy=document.createElement("i");edgeProxy.className="solar-edge-proxy";edgeProxy.hidden=true;edgeProxy.setAttribute("aria-hidden","true");const copy=document.createElement("span");copy.className="solar-label-copy";copy.textContent=name;if(secondary){const detail=document.createElement("small");detail.textContent=secondary;copy.append(detail);}label.append(edgeProxy,copy);label.addEventListener("pointerenter",()=>this.setHoveredNode(mesh));label.addEventListener("pointerleave",()=>this.setHoveredNode(null));label.addEventListener("click",event=>{event.stopPropagation();if(mesh.userData.selectable)this.selectNode(mesh);});labels.append(label);const leader=document.createElementNS("http://www.w3.org/2000/svg","line");leader.classList.add("solar-label-leader");leaders.append(leader);mesh.userData.label=label;mesh.userData.edgeProxy=edgeProxy;mesh.userData.leader=leader;return mesh;
  }
  render(detail) {
    this.mode=detail.scale || "galaxy";this.caseLayer=detail.caseLayer || "none";this.camera.near=this.mode==="local"?.5:100;this.camera.updateProjectionMatrix(); this.targetGroups=astronomyTargetGroups(detail.astronomy?.targets || []);this.astronomy=this.targetGroups.sorted; this.clear();
    if(this.mode==="sky"&&this.autoRotate)this.setPlaying(false);
    if (this.mode === "local") this.renderLocal(); else if(this.mode === "sky") this.renderSky(); else this.renderGalaxy();
    this.reset(); this.setVisible(true);
  }
  renderGalaxy() {
    this.addGalacticReferenceFrame();
    this.dot("Galactic Center",new THREE.Vector3(),0x111111,10,"",null,true,900000);
    const solarPosition=new THREE.Vector3(0,0,SUN_GALACTOCENTRIC_RADIUS_LY);
    this.marker(solarPosition,0x111111,8,true);
    this.targetGroups.solar.forEach((target,index)=>{const point=this.dot(target.name,solarPosition,0x111111,0,"",this.labelColumnOffset(index,this.targetGroups.solar.length,28),true,1000000-index,false);point.userData.corpusCluster=true;});
    this.targetGroups.positioned.forEach((target,index)=>{const {raDegrees:ra,decDegrees:dec,distanceLightYears:distance}=target.position;const point=this.dot(target.name,galactocentricPosition({ra,dec,distance}),0x333333,this.corpusScreenSize(target.mentionCount),`${distance.toFixed(1)} ly`,this.labelColumnOffset(index,this.targetGroups.positioned.length,155),true,500000-index);point.userData.corpusCluster=true;});
    this.renderCorpusRoster();
    scaleNote.replaceChildren();
    status.textContent="Loading observed spiral tracers and published arm fit…";
    this.addSpiralStructure();
  }
  renderSky() {
    this.renderCorpusRoster();
    scaleNote.replaceChildren();
    status.textContent="Loading Gaia EDR3 source-density measurements…";
    this.addGaiaDensityMap();
  }
  parseGaiaCSV(text) {
    return text.trim().split(/\r?\n/).slice(1).map(line=>{const [,ra,dec,parallax,magnitude]=line.split(",").map(Number);if(![ra,dec,parallax,magnitude].every(Number.isFinite)||parallax<=0)return null;return {ra,dec,distance:3261.56/parallax,magnitude};}).filter(Boolean);
  }
  parseSpiralTracerCSV(text) {
    return text.trim().split(/\r?\n/).slice(1).map(line=>{const [type,x,y,z,distanceBasis]=line.split(",");const coordinates=[x,y,z].map(Number);if(!coordinates.every(Number.isFinite))return null;return {type,x:coordinates[0],y:coordinates[1],z:coordinates[2],distanceBasis};}).filter(Boolean);
  }
  parseVlbiMaserCSV(text) {
    return text.trim().split(/\r?\n/).slice(1).map(line=>{const [name,x,y,z,parallax,parallaxError,arm]=line.split(",");const values=[x,y,z,parallax,parallaxError].map(Number);if(!values.every(Number.isFinite))return null;return {name,x:values[0],y:values[1],z:values[2],parallax:values[3],parallaxError:values[4],arm};}).filter(Boolean);
  }
  logarithmicArmPoints(arm,maximumRadiusKpc=GALAXY_DISPLAY_RADIUS_KPC) {
    const start=arm.startAngleDegrees*DEG,pitch=arm.pitchAngleDegrees*DEG;
    const minimum=arm.minimumAngleDegrees===undefined?start:arm.minimumAngleDegrees*DEG;
    const maximum=arm.maximumAngleDegrees===undefined?start+Math.log(maximumRadiusKpc/arm.initialRadiusKpc)/Math.tan(pitch):arm.maximumAngleDegrees*DEG;
    return Array.from({length:257},(_,index)=>{const theta=minimum+(maximum-minimum)*index/256,radius=arm.initialRadiusKpc*Math.exp((theta-start)*Math.tan(pitch));return new THREE.Vector3(radius*Math.cos(theta)*KPC_TO_LY,0,radius*Math.sin(theta)*KPC_TO_LY);});
  }
  async addSpiralStructure(){try{
    const [catalogResponse,vlbiResponse,fitResponse]=await Promise.all([fetch("data/milky-way-spiral-tracers.csv"),fetch("data/milky-way-vlbi-masers.csv"),fetch("data/milky-way-spiral-fit.json")]);
    if(!catalogResponse.ok||!vlbiResponse.ok||!fitResponse.ok)throw new Error("catalog");
    const tracers=this.parseSpiralTracerCSV(await catalogResponse.text()),vlbiMasers=this.parseVlbiMaserCSV(await vlbiResponse.text()),fit=await fitResponse.json();
    if(this.mode!=="galaxy")return;
    [...fit.arms,fit.localArm].forEach(arm=>this.line(this.logarithmicArmPoints(arm,fit.displayRadiusKpc),.48));
    const styles={molecular_cloud:{color:0x777777,size:3.1,opacity:.34},hii_region:{color:0x222222,size:3.8,opacity:.62},methanol_maser:{color:0x000000,size:4.8,opacity:.9}};
    const visible=tracers.filter(tracer=>Math.hypot(tracer.x,tracer.y)<=fit.displayRadiusKpc);
    Object.entries(styles).forEach(([type,style])=>{const positions=visible.filter(tracer=>tracer.type===type).map(spiralTracerPosition);this.root.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(positions),new THREE.PointsMaterial({...style,map:this.circularMarkerTexture(),alphaTest:.2,sizeAttenuation:false,transparent:true,depthWrite:false})));});
    const vlbiVisible=vlbiMasers.filter(tracer=>Math.hypot(tracer.x,tracer.y)<=fit.displayRadiusKpc);
    this.root.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(vlbiVisible.map(spiralTracerPosition)),new THREE.PointsMaterial({color:0x111111,size:7,map:this.ringMarkerTexture(),alphaTest:.2,sizeAttenuation:false,transparent:true,depthTest:false,depthWrite:false})));
      this.spiralReady=true;status.textContent="Milky Way ready";
    this.draw();
  }catch(_){if(this.mode==="galaxy")status.textContent="Milky Way spiral-tracer catalog unavailable";}}
  addGaiaDensityMap() {
    const image=new Image();
    image.onload=()=>{
      if(this.mode!=="sky")return;
      const output=document.createElement("canvas");output.width=752;output.height=374;
      const context=output.getContext("2d",{willReadFrequently:true});context.drawImage(image,47,66,752,374,0,0,752,374);
      const pixels=context.getImageData(0,0,752,374),data=pixels.data;
      for(let i=0;i<data.length;i+=4){const pixel=i/4,px=pixel%752,py=Math.floor(pixel/752),ellipse=((px-376)/376)**2+((py-187)/187)**2;
        if(ellipse>1){data[i+3]=0;continue;}
        const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
        if(max>.96&&delta<.04){data[i+3]=0;continue;}
        let hue=0;if(delta){if(max===r)hue=60*((g-b)/delta%6);else if(max===g)hue=60*((b-r)/delta+2);else hue=60*((r-g)/delta+4);if(hue<0)hue+=360;}
        const density=delta>.12?THREE.MathUtils.clamp((240-hue)/240,0,1):0;
        data[i]=17;data[i+1]=17;data[i+2]=17;data[i+3]=Math.round(255*(delta>.12?.08+.84*density:.18));
      }
      context.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(output);texture.colorSpace=THREE.SRGBColorSpace;
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(100000,49734),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));this.root.add(plane);
      this.skyReady=true;status.textContent="Gaia sky ready";this.draw();
    };
    image.onerror=()=>{if(this.mode==="sky")status.textContent="Gaia source-density map unavailable";};
    image.src="assets/map/gaia-edr3-source-density.png";
  }
  renderLocal() {
    this.addGaiaLocalCloud();
    const caseTargetIds=this.hillFishActive()?new Set(["sun","zeta_reticuli","tau_ceti"]):new Set();
    const solarTargets=this.targetGroups.solar;
    const visibleSolarTargets=solarTargets.filter(target=>!caseTargetIds.has(target.targetId));
    if(solarTargets.length){const solarPosition=new THREE.Vector3();visibleSolarTargets.forEach((target,index)=>this.dot(target.name,solarPosition,0x111111,this.corpusNodeSize(target.mentionCount),"",this.labelColumnOffset(index,visibleSolarTargets.length,28),true,1000000-index,true,this.corpusNodeData(target)));}
    const positioned=this.targetGroups.positioned.filter(target=>!caseTargetIds.has(target.targetId));
    positioned.forEach((target,index)=>{const {raDegrees,decDegrees,distanceLightYears}=target.position,p=localGalacticPosition(raDegrees,decDegrees,distanceLightYears);this.dot(target.name,p,0x333333,this.corpusNodeSize(target.mentionCount),`${distanceLightYears.toFixed(1)} ly`,this.labelColumnOffset(index,positioned.length,155),true,target.mentionCount || 0,true,this.corpusNodeData(target));});
    this.renderCorpusRoster();
    scaleNote.replaceChildren();
    if(this.hillFishActive())this.addHillFishLayer();
    this.updateLocalStatus();
  }
  hillFishActive(){return this.mode==="local"&&HILL_FISH_CASES.has(this.caseLayer);}
  isReady(){if(this.mode==="galaxy")return this.spiralReady;if(this.mode==="sky")return this.skyReady;return this.gaiaReady&&(!this.hillFishActive()||this.caseReady);}
  corpusNodeData(target){return {selectable:true,targetId:target.targetId,kind:target.kind,system:target.system,mentionCount:target.mentionCount,documentCount:target.documentCount,sourceCount:target.sourceCount,distanceLightYears:target.position?.distanceLightYears,labelPriority:3000000+(target.mentionCount||0)};}
  caseCorpusTarget(star){const targetId=({sun:"sun",zeta_1_reticuli:"zeta_reticuli",tau_ceti:"tau_ceti",82_eridani:"82_eridani"})[star.id];return targetId?this.astronomy.find(target=>target.targetId===targetId):null;}
  async addHillFishLayer(){const requestedCase=this.caseLayer;try{
    const response=await fetch("data/hill-fish-stars.json");if(!response.ok)throw new Error("catalog");const data=await response.json();if(!this.hillFishActive()||this.caseLayer!==requestedCase)return;
    this.casePositions=new Map(data.stars.map(star=>[star.id,star.position.distanceLightYears?localGalacticPosition(star.position.raDegrees,star.position.decDegrees,star.position.distanceLightYears):new THREE.Vector3()]));
    this.caseDefaultView=this.hillFishDefaultView(data);
    const caseNames=new Map(data.stars.map(star=>[star.id,star.name]));
    const routeDegrees=new Map();data.routes.forEach(route=>{routeDegrees.set(route.from,(routeDegrees.get(route.from)||0)+1);routeDegrees.set(route.to,(routeDegrees.get(route.to)||0)+1);});
    data.routes.forEach(route=>{const from=this.casePositions.get(route.from),to=this.casePositions.get(route.to);if(from&&to)this.addCaseRoute(route,from,to,caseNames);});
    data.stars.forEach((star,index)=>{const position=this.casePositions.get(star.id),corpus=this.caseCorpusTarget(star),distance=star.position.distanceLightYears;const secondary=corpus?`${Number(corpus.mentionCount || 0).toLocaleString()} corpus mentions · ${distance.toFixed(1)} ly`:`${distance.toFixed(1)} ly`;const anchor=["sun","zeta_1_reticuli","zeta_2_reticuli"].includes(star.id),pinnedLabel=HILL_FISH_VISIBLE_LABEL_IDS.has(star.id),edgeLabel=HILL_FISH_EDGE_LABEL_IDS.has(star.id),size=corpus?this.corpusScreenSize(corpus.mentionCount):edgeLabel?HILL_FISH_EDGE_NODE_MIN_PX:anchor?10:7,labelPriority=corpus?2000000+(corpus.mentionCount||0):pinnedLabel?1750000-index:anchor?1500000-index:500000+(routeDegrees.get(star.id)||0)*1000-index;const nodeData={selectable:true,claimLayer:"hill_fish",starId:star.id,historicalId:star.historicalId,hip:star.hip,targetId:corpus?.targetId,kind:corpus?.kind || "star",mentionCount:corpus?.mentionCount,documentCount:corpus?.documentCount,sourceCount:corpus?.sourceCount,distanceLightYears:distance,labelPriority};const point=this.dot(star.name,position,0x111111,size,secondary,this.labelColumnOffset(index,data.stars.length,145),true,anchor?1000000-index:500000-index,true,nodeData);this.caseTargetNodes.set(star.id,point);});
    const detail=document.createElement("span");detail.textContent=` · ${data.stars.length} Fish-identified stars`;roster.append(detail);this.caseReady=true;this.updateLocalStatus();this.reset();
  }catch(_){if(this.hillFishActive()&&this.caseLayer===requestedCase){this.caseUnavailable=true;this.updateLocalStatus();}}}
  hillFishDefaultView(data){
    const view=data.defaultView,foreground=this.casePositions.get(view?.foregroundStarId),anchor=this.casePositions.get(view?.screenAnchorStarId),reference=view?.occludedReference?.position;
    if(!foreground||!anchor||!reference)return null;
    const referencePosition=localGalacticPosition(reference.raDegrees,reference.decDegrees,reference.distanceLightYears);
    const offset=foreground.clone().sub(referencePosition).normalize();
    const projectedAnchor=anchor.clone().sub(foreground).addScaledVector(offset,-anchor.clone().sub(foreground).dot(offset)).normalize();
    const fallbackUp=Math.abs(offset.y)>.98?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    const baseRight=fallbackUp.clone().cross(offset).normalize(),baseUp=offset.clone().cross(baseRight).normalize();
    const currentAngle=Math.atan2(projectedAnchor.dot(baseRight),projectedAnchor.dot(baseUp));
    const roll=(Number(view.screenAnchorClockwiseDegreesFromUp)||0)*DEG-currentAngle;
    const up=baseRight.clone().multiplyScalar(-Math.sin(roll)).add(baseUp.clone().multiplyScalar(Math.cos(roll))).normalize();
    return {offset,up};
  }
  addCaseRoute(route,from,to,names){
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");line.classList.add("solar-case-route",route.kind==="reported_expedition"?"is-expedition":"is-route");leaders.insertBefore(line,leaders.firstChild);this.caseRoutes.push({from,to,fromId:route.from,toId:route.to,line,kind:route.kind,fromName:names.get(route.from)||route.from,toName:names.get(route.to)||route.to});
  }
  updateLocalStatus(){
    if(!this.hillFishActive()){status.textContent=this.gaiaUnavailable?"Gaia neighborhood unavailable":this.gaiaReady?"Gaia neighborhood ready":"Loading Gaia neighborhood around corpus targets…";return;}
    if(this.gaiaUnavailable){status.textContent=this.caseReady?"Hill–Fish layer ready · Gaia neighborhood unavailable":this.caseUnavailable?"Local astronomical data unavailable":"Loading Hill–Fish case layer…";return;}
    if(this.caseUnavailable){status.textContent=this.gaiaReady?"Gaia neighborhood ready · Hill–Fish layer unavailable":"Loading Gaia neighborhood…";return;}
    status.textContent=this.gaiaReady&&this.caseReady?"Gaia, corpus entities, and Hill–Fish layer ready":this.gaiaReady?"Gaia neighborhood ready · loading Hill–Fish layer":this.caseReady?"Hill–Fish layer ready · loading Gaia neighborhood":"Loading Gaia neighborhood and Hill–Fish case layer…";
  }
  async addGaiaLocalCloud(){const requestedCase=this.caseLayer;try{const response=await fetch("data/gaia-dr3-3d-local-stars.csv");if(!response.ok)throw new Error("catalog");const stars=this.parseGaiaCSV(await response.text()).filter(star=>star.distance<=LOCAL_DETAIL_RADIUS_LY);if(this.mode!=="local"||this.caseLayer!==requestedCase)return;const positions=stars.map(star=>localGalacticPosition(star.ra,star.dec,star.distance));this.root.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(positions),new THREE.PointsMaterial({color:0x111111,size:2.2,map:this.circularMarkerTexture(),alphaTest:.2,sizeAttenuation:true,transparent:true,opacity:.22,depthWrite:false})));this.gaiaReady=true;this.updateLocalStatus();this.draw();}catch(_){if(this.mode==="local"&&this.caseLayer===requestedCase){this.gaiaUnavailable=true;this.updateLocalStatus();}}}
  corpusScreenSize(value){const mentions=Math.max(0,Number(value)||0);return Math.min(CORPUS_NODE_MAX_PX,Math.max(CORPUS_NODE_MIN_PX,20*Math.pow(mentions/100,CORPUS_NODE_EXPONENT)));}
  corpusNodeSize(value){return this.corpusScreenSize(value);}
  addGalacticReferenceFrame(){
    this.line([new THREE.Vector3(-59000,0,0),new THREE.Vector3(59000,0,0)],.1);
    this.line([new THREE.Vector3(0,0,-59000),new THREE.Vector3(0,0,59000)],.1);
    this.line([new THREE.Vector3(0,-12000,0),new THREE.Vector3(0,12000,0)],.18);
  }
  renderCorpusRoster(){
    const groups=this.targetGroups;
    const accounted=groups.solar.length+groups.positioned.length+groups.scene.length+groups.unpositioned.length;
    const heading=document.createElement("strong");heading.textContent=`${accounted.toLocaleString()} corpus entities`;
    roster.replaceChildren(heading);
  }
  labelColumnOffset(index,count,distance){const side=index%2===0?1:-1,row=Math.floor(index/2),rows=Math.ceil(count/2);return {x:side*distance,y:(row-(rows-1)/2)*22};}
  corpusClusterAt(event){
    if(this.mode!=="galaxy"||!event)return null;
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    return this.targets.filter(target=>target.userData.corpusCluster).sort((a,b)=>(b.userData.priority || 0)-(a.userData.priority || 0)).find(target=>{const point=target.position.clone().project(this.camera),screenX=(point.x*.5+.5)*rect.width,screenY=(-point.y*.5+.5)*rect.height;return point.z>-1&&point.z<1&&Math.hypot(screenX-x,screenY-y)<=18;}) || null;
  }
  nodeAt(event){
    if(this.mode!=="local"||!event)return null;
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    return this.targets.filter(target=>target.userData.selectable).map(target=>{const point=target.position.clone().project(this.camera),screenX=(point.x*.5+.5)*rect.width,screenY=(-point.y*.5+.5)*rect.height,radius=Math.max(14,(target.userData.baseMaterialSize||0)/2+1);return {target,distance:Math.hypot(screenX-x,screenY-y),radius,depth:point.z};}).filter(item=>item.depth>-1&&item.depth<1&&item.distance<=item.radius).sort((a,b)=>a.distance/a.radius-b.distance/b.radius||(b.target.userData.priority||0)-(a.target.userData.priority||0))[0]?.target || null;
  }
  caseRouteAt(event){
    if(!this.hillFishActive()||!event)return null;
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    return this.caseRoutes.map(route=>{const a=route.from.clone().project(this.camera),b=route.to.clone().project(this.camera);if(a.z<=-1||a.z>=1||b.z<=-1||b.z>=1)return {route,distance:Infinity};const ax=(a.x*.5+.5)*rect.width,ay=(-a.y*.5+.5)*rect.height,bx=(b.x*.5+.5)*rect.width,by=(-b.y*.5+.5)*rect.height,dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy,t=lengthSquared?THREE.MathUtils.clamp(((x-ax)*dx+(y-ay)*dy)/lengthSquared,0,1):0;return {route,distance:Math.hypot(x-(ax+t*dx),y-(ay+t*dy))};}).filter(item=>item.distance<=7).sort((a,b)=>a.distance-b.distance)[0]?.route || null;
  }
  selectNode(node){
    const {label,leader,labelOffset,baseMaterialSize,priority,selectable,...detail}=node.userData;
    window.dispatchEvent(new CustomEvent("ufo-solar-select",{detail}));
  }
  setHoveredNode(node){
    if(this.hoveredNode===node)return;
    const apply=(target,active)=>{if(!target)return;target.userData.label?.classList.toggle("is-hovered",active);target.userData.leader?.classList.toggle("is-hovered",active);target.renderOrder=active?10:(target.userData.baseRenderOrder||0);target.scale.setScalar(active?1.45:1);if(Number.isFinite(target.userData.baseMaterialSize)&&target.material){const size=target.userData.baseMaterialSize*(active?1.45:1);if(target.material.uniforms?.pointSize)target.material.uniforms.pointSize.value=size;else target.material.size=size;}};
    apply(this.hoveredNode,false);this.hoveredNode=node;apply(node,true);canvas.classList.toggle("has-node",Boolean(node));canvas.title=node?`Inspect ${node.userData.name}`:"";this.draw();
  }
  setHoveredRoute(route){
    if(this.hoveredRoute===route)return;this.hoveredRoute?.line.classList.remove("is-hovered");this.hoveredRoute=route;route?.line.classList.add("is-hovered");canvas.classList.toggle("has-case-route",Boolean(route));if(route)canvas.title=`Hill–Fish ${route.kind==="reported_expedition"?"reported expedition":"reported route"}: ${route.fromName} to ${route.toName}`;this.draw();
  }
  updateNodeHover(event){
    const node=this.nodeAt(event);this.setHoveredNode(node);const route=node?null:this.caseRouteAt(event);this.setHoveredRoute(route);const cluster=!node&&!route&&Boolean(this.corpusClusterAt(event));canvas.classList.toggle("has-corpus-cluster",cluster);if(cluster)canvas.title="Inspect corpus entities near the Sun";
  }
  hillFishFrame(points,fitPoints=points){
    const offset=this.caseDefaultView?.offset?.clone().normalize(),up=this.caseDefaultView?.up?.clone().normalize();if(!offset||!up||!points.length)return null;
    const forward=offset.clone().negate(),right=forward.clone().cross(up).normalize(),midpoint=axis=>{const values=points.map(point=>point.dot(axis));return (Math.min(...values)+Math.max(...values))/2;};
    const focus=right.clone().multiplyScalar(midpoint(right)).add(up.clone().multiplyScalar(midpoint(up))).add(offset.clone().multiplyScalar(midpoint(offset)));
    const width=container.clientWidth||1,height=container.clientHeight||1,aspect=width/height||this.camera.aspect||1,tangent=Math.tan(this.camera.fov*DEG/2);
    const required=Math.max(...fitPoints.map(point=>{const relative=point.clone().sub(focus);return relative.dot(offset)+Math.max(Math.abs(relative.dot(up))/(tangent*HILL_FISH_FRAME_FILL),Math.abs(relative.dot(right))/(tangent*aspect*HILL_FISH_FRAME_FILL));}));
    return {focus,distance:Math.max(HILL_FISH_MIN_CAMERA_DISTANCE_LY,required+HILL_FISH_DEPTH_PADDING_LY)};
  }
  reset() { const hillFish=this.hillFishActive(),localPoints=hillFish?this.caseRoutes.flatMap(route=>[route.from,route.to]):this.targets.map(target=>target.position),nearbyCorpusPoints=hillFish?this.targets.filter(target=>target.userData.targetId&&target.userData.distanceLightYears<=HILL_FISH_CORPUS_FRAME_RADIUS_LY).map(target=>target.position):[],frame=hillFish?this.hillFishFrame(localPoints,[...localPoints,...nearbyCorpusPoints]):null;this.focus=frame?.focus || (this.mode==="local"&&localPoints.length?new THREE.Box3().setFromPoints(localPoints).getCenter(new THREE.Vector3()):new THREE.Vector3());this.distance=hillFish?frame?.distance||HILL_FISH_MIN_CAMERA_DISTANCE_LY:this.mode==="local"?LOCAL_CAMERA_DISTANCE_LY:this.mode==="sky"?105000:93000; const caseOffset=hillFish?this.caseDefaultView?.offset:null;this.yaw=caseOffset?Math.atan2(caseOffset.x,caseOffset.z):this.mode==="local"?-.12:0; this.pitch=caseOffset?Math.asin(caseOffset.y):this.mode==="local"?1.34:this.mode==="sky"?0:1.5;this.camera.up.copy(hillFish&&this.caseDefaultView?this.caseDefaultView.up:new THREE.Vector3(0,1,0)); this.draw();if(this.autoRotate)this.syncRotationAxis(); }
  resize(){ if(!this.visible)return; const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);leaders.setAttribute("viewBox",`0 0 ${w} ${h}`);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.draw(); }
  draw(){ if(!this.visible)return; const cp=Math.cos(this.pitch),focus=this.focus || new THREE.Vector3();this.camera.position.set(this.distance*cp*Math.sin(this.yaw),this.distance*Math.sin(this.pitch),this.distance*cp*Math.cos(this.yaw)).add(focus);this.camera.lookAt(focus);this.renderer.render(this.scene,this.camera);this.updateCaseRoutes();this.updateLabels(); }
  syncRotationAxis(){
    this.rotationAxis.set(0,1,0).applyQuaternion(this.camera.quaternion).normalize();
    this.camera.up.copy(this.rotationAxis);
  }
  animate(timestamp){
    this.frame=null;
    if(!this.visible||!this.autoRotate)return;
    if(this.lastFrameTime!==null&&!this.drag){
      const elapsed=Math.min(50,timestamp-this.lastFrameTime);
      const focus=this.focus || new THREE.Vector3();
      const offset=this.camera.position.clone().sub(focus).applyAxisAngle(this.rotationAxis,elapsed*MODEL_ROTATION_SPEED);
      this.distance=offset.length();
      this.yaw=Math.atan2(offset.x,offset.z);
      this.pitch=Math.asin(THREE.MathUtils.clamp(offset.y/this.distance,-1,1));
    }
    this.lastFrameTime=timestamp;
    this.draw();
    this.frame=requestAnimationFrame(nextTimestamp=>this.animate(nextTimestamp));
  }
  updateCaseRoutes(){
    const w=container.clientWidth,h=container.clientHeight;this.caseRoutes.forEach(route=>{const a=route.from.clone().project(this.camera),b=route.to.clone().project(this.camera),visible=a.z>-1&&a.z<1&&b.z>-1&&b.z<1;route.line.style.display=visible?"":"none";if(visible){route.line.setAttribute("x1",(a.x*.5+.5)*w);route.line.setAttribute("y1",(-a.y*.5+.5)*h);route.line.setAttribute("x2",(b.x*.5+.5)*w);route.line.setAttribute("y2",(-b.y*.5+.5)*h);}});
  }
  updateLabels(){
    const w=container.clientWidth,h=container.clientHeight,occupied=[],ranked=this.targets.slice().sort((a,b)=>(b.userData.labelPriority ?? b.userData.priority ?? 0)-(a.userData.labelPriority ?? a.userData.priority ?? 0) || (b.geometry?.parameters?.radius||0)-(a.geometry?.parameters?.radius||0) || b.position.length()-a.position.length());
    const pinned=ranked.filter(target=>HILL_FISH_VISIBLE_LABEL_IDS.has(target.userData.starId)||HILL_FISH_VISIBLE_TARGET_IDS.has(target.userData.targetId)),pinnedSet=new Set(pinned),pinnedCorpus=pinned.filter(target=>target.userData.targetId),pinnedReferences=pinned.filter(target=>!target.userData.targetId);
    const corpusLabels=[...pinnedCorpus,...ranked.filter(target=>target.userData.targetId&&!pinnedSet.has(target)).slice(0,HILL_FISH_CORPUS_LABEL_LIMIT-pinnedCorpus.length)],referenceLabels=[...pinnedReferences,...ranked.filter(target=>target.userData.claimLayer==="hill_fish"&&!target.userData.targetId&&!pinnedSet.has(target)).slice(0,HILL_FISH_REFERENCE_LABEL_LIMIT-pinnedReferences.length)];
    const isEdgeLabel=target=>HILL_FISH_EDGE_LABEL_IDS.has(target.userData.starId)||HILL_FISH_EDGE_TARGET_IDS.has(target.userData.targetId),edgeLabels=ranked.filter(isEdgeLabel),defaultAllowed=this.hillFishActive()?new Set([...corpusLabels,...referenceLabels,...edgeLabels]):new Set(ranked),allowed=new Set(defaultAllowed);if(this.hoveredNode)allowed.add(this.hoveredNode);if(this.hoveredRoute){allowed.add(this.caseTargetNodes.get(this.hoveredRoute.fromId));allowed.add(this.caseTargetNodes.get(this.hoveredRoute.toId));}
    ranked.forEach(m=>{
      const p=m.position.clone().project(this.camera),x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h,label=m.userData.label,edgeProxy=m.userData.edgeProxy,leader=m.userData.leader,depthVisible=p.z>-1&&p.z<1,edgeTarget=isEdgeLabel(m),offscreen=edgeTarget&&depthVisible&&(Math.abs(p.x)>=1.1||Math.abs(p.y)>=1.1),edgeSide=Math.abs(x-w/2)>Math.abs(y-h/2)?x<w/2?"left":"right":y<h/2?"top":"bottom";label.hidden=false;label.classList.toggle("is-offscreen",offscreen);edgeProxy.hidden=!offscreen;if(offscreen){const proxySize=THREE.MathUtils.clamp(Number(m.userData.baseMaterialSize)||HILL_FISH_EDGE_NODE_MIN_PX,HILL_FISH_EDGE_NODE_MIN_PX,CORPUS_NODE_MAX_PX);edgeProxy.style.width=`${proxySize}px`;edgeProxy.style.height=`${proxySize}px`;label.dataset.edgeSide=edgeSide;label.dataset.edgeArrow=({left:"←",right:"→",top:"↑",bottom:"↓"})[edgeSide];label.title="Displayed at the viewport edge; measured direction retained and distance compressed";}else{delete label.dataset.edgeSide;delete label.dataset.edgeArrow;label.removeAttribute("title");}const labelW=Math.max(1,label.offsetWidth),labelH=Math.max(1,label.offsetHeight),hoverOnly=m===this.hoveredNode&&!defaultAllowed.has(m),compactOffset=this.hillFishActive()&&HILL_FISH_VISIBLE_TARGET_IDS.has(m.userData.targetId)?{x:x<w/2?HILL_FISH_PINNED_LABEL_GAP_PX:-HILL_FISH_PINNED_LABEL_GAP_PX,y:0}:null,offset=hoverOnly?null:compactOffset||m.userData.labelOffset;
      const inFrame=allowed.has(m)&&depthVisible&&(offscreen||Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1);
      const candidates=offset?[[x+offset.x+(offset.x<0?-labelW:0),y+offset.y-labelH/2]]:[[x+8,y-labelH/2],[x-labelW-8,y-labelH/2],[x-labelW/2,y-labelH-10],[x-labelW/2,y+10]];
      const edgeX=THREE.MathUtils.clamp(x,4,w-4),edgeY=THREE.MathUtils.clamp(y,4,h-4),edgePlacement=offscreen?{left:THREE.MathUtils.clamp(edgeX+(x<0?8:x>w?-labelW-8:-labelW/2),6,w-labelW-6),top:THREE.MathUtils.clamp(edgeY+(y<0?8:y>h?-labelH-8:-labelH/2),6,h-labelH-6),width:labelW,height:labelH}:null;
      const placement=edgePlacement||candidates.map(([left,top])=>({left:THREE.MathUtils.clamp(left,6,w-labelW-6),top:THREE.MathUtils.clamp(top,6,h-labelH-6),width:labelW,height:labelH})).find(box=>offset||!occupied.some(other=>box.left<other.left+other.width+5&&box.left+box.width+5>other.left&&box.top<other.top+other.height+5&&box.top+box.height+5>other.top));
      const show=inFrame&&placement;m.userData.label.hidden=!show;label.classList.toggle("is-offscreen",Boolean(show&&offscreen));edgeProxy.hidden=!(show&&offscreen);
      leader.style.display=show&&offset&&!offscreen?"":"none";
      if(show){occupied.push(placement);label.style.transform=`translate(${placement.left}px,${placement.top}px)`;if(offset){const targetX=THREE.MathUtils.clamp(x,placement.left,placement.left+placement.width),targetY=THREE.MathUtils.clamp(y,placement.top,placement.top+placement.height);leader.setAttribute("x1",x);leader.setAttribute("y1",y);leader.setAttribute("x2",targetX);leader.setAttribute("y2",targetY);}}
    });
  }
  setVisible(v){
    this.visible=v;
    if(v){this.resize();if(this.autoRotate&&this.frame===null)this.frame=requestAnimationFrame(timestamp=>this.animate(timestamp));return;}
    if(this.frame!==null)cancelAnimationFrame(this.frame);
    this.frame=null;this.lastFrameTime=null;
  }
  setPlaying(playing){
    this.autoRotate=Boolean(playing)&&this.mode!=="sky";
    this.lastFrameTime=null;
    if(this.autoRotate)this.syncRotationAxis();
    if(this.autoRotate&&this.visible&&this.frame===null)this.frame=requestAnimationFrame(timestamp=>this.animate(timestamp));
    if(!this.autoRotate&&this.frame!==null){cancelAnimationFrame(this.frame);this.frame=null;}
    window.dispatchEvent(new CustomEvent("ufo-solar-playback",{detail:{playing:this.autoRotate}}));
    return this.autoRotate;
  }
}

try {
  const model=new SolarModel(); window.ufoSolar=model;
  window.addEventListener("ufo-solar-render",e=>model.render(e.detail));
  window.addEventListener("ufo-solar-visibility",e=>model.setVisible(e.detail.visible));
  if(window.pendingSolarRender)model.render(window.pendingSolarRender);
} catch (_) { status.textContent="Interactive astronomical model unavailable"; }
