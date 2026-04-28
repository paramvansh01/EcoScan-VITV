// ── 3D VIT CAMPUS SCENE ──
(function(){
const cvs=document.getElementById('campus-3d-canvas');
if(!cvs)return;
const R=new THREE.WebGLRenderer({canvas:cvs,antialias:true,alpha:false});
R.setPixelRatio(Math.min(window.devicePixelRatio,2));
R.shadowMap.enabled=true;
R.shadowMap.type=THREE.PCFSoftShadowMap;
R.toneMapping=THREE.ACESFilmicToneMapping;
R.toneMappingExposure=0.9;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x090b0a);
scene.fog=new THREE.FogExp2(0x090b0a,0.012);
const cam=new THREE.PerspectiveCamera(45,1,0.1,300);
cam.position.set(0,3.5,18);
cam.lookAt(0,3,0);

// Lighting — dusk/night
scene.add(new THREE.AmbientLight(0x1a2a3a,0.6));
const sun=new THREE.DirectionalLight(0xffd8a0,0.7);
sun.position.set(-10,8,5);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=1;sun.shadow.camera.far=50;
sun.shadow.camera.left=-25;sun.shadow.camera.right=25;
sun.shadow.camera.top=15;sun.shadow.camera.bottom=-5;
scene.add(sun);
scene.add(new THREE.DirectionalLight(0x5588aa,0.3).copy(sun).position.set(10,6,-5));
const rimLight=new THREE.DirectionalLight(0xffaa66,0.4);
rimLight.position.set(0,5,-10);scene.add(rimLight);

// Materials
const wallMat=new THREE.MeshPhongMaterial({color:0xd8dce6,specular:0x222222,shininess:15});
const wallMat2=new THREE.MeshPhongMaterial({color:0xc8ccd6,specular:0x222222,shininess:15});
const roofMat=new THREE.MeshPhongMaterial({color:0x8a9098});
const winGlow=new THREE.MeshPhongMaterial({color:0xffeecc,emissive:0xffdd88,emissiveIntensity:0.6});
const winDark=new THREE.MeshPhongMaterial({color:0x2a4a6a,specular:0x446688,shininess:80,transparent:true,opacity:0.85});
const grassMat=new THREE.MeshPhongMaterial({color:0x1a3a20});
const pathMat=new THREE.MeshPhongMaterial({color:0x3a3a38});

// ── BUILD WIDE BUILDING (matches the image: wide multi-story white building) ──
function buildBuilding(){
  const g=new THREE.Group();
  // Main center block
  const cW=14,cH=7,cD=4;
  const center=new THREE.Mesh(new THREE.BoxGeometry(cW,cH,cD),wallMat);
  center.position.set(0,cH/2+0.3,0);center.castShadow=true;center.receiveShadow=true;
  g.add(center);
  // Left wing
  const lW=8,lH=6,lD=3.5;
  const left=new THREE.Mesh(new THREE.BoxGeometry(lW,lH,lD),wallMat2);
  left.position.set(-cW/2-lW/2+0.5,lH/2+0.3,0.3);left.castShadow=true;left.receiveShadow=true;
  g.add(left);
  // Right wing
  const right=new THREE.Mesh(new THREE.BoxGeometry(lW,lH,lD),wallMat2);
  right.position.set(cW/2+lW/2-0.5,lH/2+0.3,0.3);right.castShadow=true;right.receiveShadow=true;
  g.add(right);
  // Far left small block
  const fl=new THREE.Mesh(new THREE.BoxGeometry(5,5,3),wallMat);
  fl.position.set(-cW/2-lW+2,2.8,0.8);fl.castShadow=true;
  g.add(fl);
  // Far right small block
  const fr=new THREE.Mesh(new THREE.BoxGeometry(5,5,3),wallMat);
  fr.position.set(cW/2+lW-2,2.8,0.8);fr.castShadow=true;
  g.add(fr);
  // Roof slabs
  [[-0.5,cH+0.4,0,cW+1,0.2,cD+0.3],
   [-cW/2-lW/2+0.5,lH+0.4,0.3,lW+0.5,0.2,lD+0.2],
   [cW/2+lW/2-0.5,lH+0.4,0.3,lW+0.5,0.2,lD+0.2]].forEach(r=>{
    const roof=new THREE.Mesh(new THREE.BoxGeometry(r[3],r[4],r[5]),roofMat);
    roof.position.set(r[0],r[1],r[2]);g.add(roof);
  });
  // Floor lines
  const lineMat=new THREE.MeshPhongMaterial({color:0xaab0b6});
  for(let f=1;f<=8;f++){
    const y=f*0.85+0.3;
    const line=new THREE.Mesh(new THREE.BoxGeometry(cW+0.1,0.05,cD+0.1),lineMat);
    line.position.set(0,y,0);g.add(line);
  }
  // Windows on all faces of center block
  const wW=0.5,wH=0.55;
  for(let face=0;face<2;face++){
    const zOff=face===0?cD/2+0.02:-cD/2-0.02;
    for(let r=0;r<8;r++){
      for(let c=0;c<22;c++){
        const wx=-cW/2+0.5+c*(cW-1)/21;
        const wy=1+r*0.85;
        const isLit=Math.random()>0.5;
        const w=new THREE.Mesh(new THREE.BoxGeometry(wW,wH,0.05),isLit?winGlow:winDark);
        w.position.set(wx,wy,zOff);g.add(w);
      }
    }
  }
  // Windows on wings
  [[-cW/2-lW/2+0.5,lH,lW],[cW/2+lW/2-0.5,lH,lW]].forEach(wing=>{
    for(let face=0;face<2;face++){
      const zOff=face===0?lD/2+0.32:-lD/2+0.28;
      for(let r=0;r<7;r++){
        for(let c=0;c<13;c++){
          const wx=wing[0]-wing[2]/2+0.5+c*(wing[2]-1)/12;
          const wy=1+r*0.85;
          const isLit=Math.random()>0.55;
          const w=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.5,0.05),isLit?winGlow:winDark);
          w.position.set(wx,wy,zOff);g.add(w);
        }
      }
    }
  });
  // Base/foundation
  const base=new THREE.Mesh(new THREE.BoxGeometry(35,0.4,8),new THREE.MeshPhongMaterial({color:0x6a7068}));
  base.position.set(0,0.2,0);base.receiveShadow=true;g.add(base);

  // ── DARK VERTICAL COLUMN PAIRS (Inverted-U pattern across facade) ──
  const darkColMat=new THREE.MeshPhongMaterial({color:0x1a1a2a,specular:0x111111,shininess:10});
  // Evenly spaced tall dark column pairs running full building height
  const colSpacing=1.8;
  const numPairs=7; // 7 pairs on each side of center
  for(let i=-numPairs;i<=numPairs;i++){
    if(Math.abs(i)<=1) continue; // skip center (glass feature goes there)
    const cx=i*colSpacing;
    if(Math.abs(cx)>cW/2-0.5) continue;
    const colH=cH-0.5;
    // Left column of pair
    const colL=new THREE.Mesh(new THREE.BoxGeometry(0.25,colH,0.15),darkColMat);
    colL.position.set(cx-0.5,colH/2+0.5,cD/2+0.08);g.add(colL);
    // Right column of pair
    const colR=new THREE.Mesh(new THREE.BoxGeometry(0.25,colH,0.15),darkColMat);
    colR.position.set(cx+0.5,colH/2+0.5,cD/2+0.08);g.add(colR);
    // Top connector (makes the inverted-U shape)
    const conn=new THREE.Mesh(new THREE.BoxGeometry(1.25,0.3,0.15),darkColMat);
    conn.position.set(cx,colH+0.35,cD/2+0.08);g.add(conn);
  }
  // Also on wings
  [[-cW/2-lW/2+0.5,lW,lD],[cW/2+lW/2-0.5,lW,lD]].forEach(wing=>{
    for(let i=-3;i<=3;i++){
      const cx=wing[0]+i*1.6;
      const colH=lH-0.5;
      const colL=new THREE.Mesh(new THREE.BoxGeometry(0.2,colH,0.12),darkColMat);
      colL.position.set(cx-0.4,colH/2+0.5,wing[2]/2+0.38);g.add(colL);
      const colR=new THREE.Mesh(new THREE.BoxGeometry(0.2,colH,0.12),darkColMat);
      colR.position.set(cx+0.4,colH/2+0.5,wing[2]/2+0.38);g.add(colR);
      const conn=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.25,0.12),darkColMat);
      conn.position.set(cx,colH+0.35,wing[2]/2+0.38);g.add(conn);
    }
  });

  // ── CENTRAL GLASS FEATURE (tall dark strip with pointed top) ──
  const glassMat=new THREE.MeshPhongMaterial({color:0x1a2a3a,specular:0x446688,shininess:80,transparent:true,opacity:0.9});
  const glassStrip=new THREE.Mesh(new THREE.BoxGeometry(2.2,cH+0.5,0.2),glassMat);
  glassStrip.position.set(0,cH/2+0.5,cD/2+0.1);g.add(glassStrip);
  // Pointed chevron top
  const chevShape=new THREE.Shape();
  chevShape.moveTo(-1.3,0);chevShape.lineTo(0,2);chevShape.lineTo(1.3,0);chevShape.lineTo(-1.3,0);
  const chevGeo=new THREE.ExtrudeGeometry(chevShape,{depth:0.25,bevelEnabled:false});
  const chevron=new THREE.Mesh(chevGeo,darkColMat);
  chevron.rotation.x=-Math.PI/2;
  chevron.position.set(0,cH+0.5,cD/2-0.02);
  g.add(chevron);

  // ── TRIANGULAR ENTRANCE STRUCTURE ──
  const canopyW=3.5,canopyPeakH=1.8;
  // Create text texture — transparent background acts as a decal
  const signCanvas=document.createElement('canvas');
  signCanvas.width=1024;signCanvas.height=512;
  const sCtx=signCanvas.getContext('2d');
  sCtx.clearRect(0,0,1024,512); // Fully transparent background
  sCtx.fillStyle='#000000'; // Pure black text for max contrast
  sCtx.font='bold 160px Inter, Arial, sans-serif';
  sCtx.textAlign='center';sCtx.textBaseline='middle';
  sCtx.fillText('VIT',512,180);
  sCtx.font='bold 75px Inter, Arial, sans-serif';
  sCtx.fillText('TECHNOLOGY TOWER',512,330);
  const signTex=new THREE.CanvasTexture(signCanvas);
  signTex.anisotropy=16; // Crispy rendering
  
  const canopyMat=new THREE.MeshPhongMaterial({color:0xd0d4de,specular:0x444444,shininess:25});
  // Extruded grey triangle body
  const triShape=new THREE.Shape();
  triShape.moveTo(-canopyW/2,0);triShape.lineTo(0,canopyPeakH);triShape.lineTo(canopyW/2,0);triShape.lineTo(-canopyW/2,0);
  const triGeo=new THREE.ExtrudeGeometry(triShape,{depth:3,bevelEnabled:true,bevelThickness:0.06,bevelSize:0.05,bevelSegments:2});
  const triMesh=new THREE.Mesh(triGeo,canopyMat);
  triMesh.position.set(0,2.5,cD/2+0.2);
  triMesh.castShadow=true;
  g.add(triMesh);
  
  // Decal Plane for Text (perfect UV mapping, transparent background)
  const textMat=new THREE.MeshPhongMaterial({
    map:signTex,
    transparent:true,
    emissive:0x000000, // No glow, pure dark text
    depthWrite:false
  });
  // Plane preserves 2:1 aspect ratio of the canvas
  const textPlane=new THREE.Mesh(new THREE.PlaneGeometry(canopyW*0.7, canopyW*0.35), textMat);
  // Centered nicely in the bottom/wider half of the triangle
  textPlane.position.set(0, 2.5 + canopyPeakH*0.4, cD/2+3.28);
  g.add(textPlane);

  // ── ENTRANCE PILLARS ──
  const pillarMat=new THREE.MeshPhongMaterial({color:0xe0e4ea,specular:0x444444,shininess:30});
  const pillarGeo=new THREE.CylinderGeometry(0.12,0.12,2.5,12);
  [[-1.5,1.25,cD/2+3.1],[1.5,1.25,cD/2+3.1],[-1.5,1.25,cD/2+0.3],[1.5,1.25,cD/2+0.3]].forEach(p=>{
    const pil=new THREE.Mesh(pillarGeo,pillarMat);
    pil.position.set(p[0],p[1],p[2]);pil.castShadow=true;
    g.add(pil);
  });

  // ── SMALL FOUNTAIN IN FRONT ──
  const fountainBase=new THREE.Mesh(
    new THREE.CylinderGeometry(1.2,1.4,0.4,24),
    new THREE.MeshPhongMaterial({color:0x8a8a88})
  );
  fountainBase.position.set(0,0.5,cD/2+6);g.add(fountainBase);
  const fountainWater=new THREE.Mesh(
    new THREE.CylinderGeometry(1.0,1.0,0.15,24),
    new THREE.MeshPhongMaterial({color:0x1a3a5a,transparent:true,opacity:0.7,shininess:100,specular:0x88aacc})
  );
  fountainWater.position.set(0,0.55,cD/2+6);g.add(fountainWater);

  // Animated Fountain Particles
  const pCount = 400;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pVel = [];
  for (let i = 0; i < pCount; i++) {
    pPos[i*3] = (Math.random() - 0.5) * 0.1;
    pPos[i*3+1] = Math.random() * 1.5; // Start scattered
    pPos[i*3+2] = (Math.random() - 0.5) * 0.1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.35;
    pVel.push({
      vx: Math.cos(a) * r,
      vy: 1.0 + Math.random() * 1.2,
      vz: Math.sin(a) * r
    });
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xcceeff,
    size: 0.05,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const fountainParticles = new THREE.Points(pGeo, pMat);
  fountainParticles.position.set(0, 0.6, cD/2+6);
  fountainParticles.userData.vel = pVel;
  g.add(fountainParticles);
  window.fountainParticles = fountainParticles; // Exposed for animate loop

  return g;
}
const building=buildBuilding();
building.position.set(0,0,-4);
scene.add(building);

// ── TREES (realistic, mixed types) ──
function makeTree(h,leafR){
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(
    new THREE.CylinderGeometry(0.08,0.15,h*0.5,6),
    new THREE.MeshPhongMaterial({color:0x3d2817})
  );
  trunk.position.y=h*0.25;trunk.castShadow=true;g.add(trunk);
  const cols=[0x1a4a25,0x205530,0x183d20];
  for(let i=0;i<4;i++){
    const s=new THREE.Mesh(
      new THREE.SphereGeometry(leafR*(1-i*0.15),8,6),
      new THREE.MeshPhongMaterial({color:cols[i%3]})
    );
    s.position.set((Math.random()-0.5)*leafR*0.4, h*0.4+i*leafR*0.5, (Math.random()-0.5)*leafR*0.4);
    s.castShadow=true;g.add(s);
  }
  return g;
}
function makePalm(h){
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(
    new THREE.CylinderGeometry(0.06,0.1,h,8),
    new THREE.MeshPhongMaterial({color:0x5a4030})
  );
  trunk.position.y=h/2;g.add(trunk);
  for(let i=0;i<7;i++){
    const angle=i/7*Math.PI*2;
    const frond=new THREE.Mesh(
      new THREE.ConeGeometry(0.15,1.8,4),
      new THREE.MeshPhongMaterial({color:0x1a5528,side:THREE.DoubleSide})
    );
    frond.position.set(Math.cos(angle)*0.3,h-0.2,Math.sin(angle)*0.3);
    frond.rotation.z=Math.cos(angle)*1.0;
    frond.rotation.x=Math.sin(angle)*1.0;
    g.add(frond);
  }
  return g;
}
// Row of trees between building and lake
const treeData=[
  [-12,0,-1,2,0.8],[-10,0,-0.5,2.5,1],[-8,0,0,1.8,0.7],[-6,0,-0.8,2.2,0.9],
  [-4,0,0,2,0.8],[-2,0,-0.5,2.5,1],[0,0,0.2,1.8,0.7],[2,0,-0.3,2.3,0.9],
  [4,0,0,2,0.8],[6,0,-0.5,2.2,0.9],[8,0,0,2.5,1],[10,0,-0.8,1.8,0.7],
  [12,0,-0.5,2,0.8],[-14,0,-1.5,1.5,0.6],[14,0,-1.5,1.5,0.6]
];
treeData.forEach(d=>{
  const t=makeTree(d[3],d[4]);
  t.position.set(d[0],d[1],d[2]);scene.add(t);
});
// Palm trees
[[-9,0,1],[-3,0,1.5],[5,0,1],[11,0,0.5]].forEach(p=>{
  const palm=makePalm(3+Math.random());
  palm.position.set(p[0],p[1],p[2]);scene.add(palm);
});
// Bushes/shrubs along waterline
for(let i=0;i<20;i++){
  const x=-15+i*1.6+Math.random()*0.5;
  const bush=new THREE.Mesh(
    new THREE.SphereGeometry(0.25+Math.random()*0.2,6,5),
    new THREE.MeshPhongMaterial({color:0x1a4020+Math.floor(Math.random()*0x0a1010)})
  );
  bush.position.set(x,0.15,2+Math.random()*0.5);
  bush.scale.y=0.6;scene.add(bush);
}

// ── GROUND ──
const ground=new THREE.Mesh(
  new THREE.PlaneGeometry(50,15),grassMat
);
ground.rotation.x=-Math.PI/2;ground.position.set(0,0.01,-2);
ground.receiveShadow=true;scene.add(ground);

// ── LAKE WITH REALISTIC RIPPLES + REFLECTIONS ──
const wGeo=new THREE.PlaneGeometry(50,30,200,200);
const wMat=new THREE.ShaderMaterial({
  uniforms:{
    uTime:{value:0},
    uDark:{value:new THREE.Color(0x020406)},
    uMid:{value:new THREE.Color(0x0a1218)},
    uSky:{value:new THREE.Color(0x090b0a)}
  },
  vertexShader:`
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWP;
    varying vec3 vN;
    void main(){
      vUv=uv;
      vec3 p=position;
      // Large rolling waves (amplitude reduced to prevent flooding land)
      float w1=sin(p.x*0.4+uTime*0.8)*cos(p.y*0.3+uTime*0.5)*0.06;
      float w2=sin(p.x*1.2-uTime*1.1)*sin(p.y*0.8+uTime*0.9)*0.03;
      p.z+=w1+w2;
      vWP=(modelMatrix*vec4(p,1.0)).xyz;
      
      // Calculate normal from derivatives of large waves
      float dx=cos(p.x*0.4+uTime*0.8)*0.4*cos(p.y*0.3+uTime*0.5)*0.06
              +cos(p.x*1.2-uTime*1.1)*1.2*sin(p.y*0.8+uTime*0.9)*0.03;
      float dy=sin(p.x*0.4+uTime*0.8)*sin(p.y*0.3+uTime*0.5)*0.3*0.06 * -1.0
              +sin(p.x*1.2-uTime*1.1)*cos(p.y*0.8+uTime*0.9)*0.8*0.03;
      vN=normalize(normalMatrix*vec3(-dx,1.0,-dy));
      
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    }`,
  fragmentShader:`
    uniform float uTime;
    uniform vec3 uDark;
    uniform vec3 uMid;
    uniform vec3 uSky;
    varying vec2 vUv;
    varying vec3 vWP;
    varying vec3 vN;
    
    // Helper to create micro-ripples
    vec3 getNoiseBump(vec2 uv, float t) {
      vec3 bump = vec3(0.0);
      bump.x += sin(uv.x * 2.0 + t) * 0.05;
      bump.z += cos(uv.y * 2.0 + t) * 0.05;
      bump.x += sin(uv.y * 5.0 - t * 1.5) * 0.025;
      bump.z += cos(uv.x * 5.0 + t * 1.2) * 0.025;
      bump.x += sin(uv.x * 14.0 + t * 2.0) * 0.01;
      bump.z += cos(uv.y * 14.0 - t * 2.0) * 0.01;
      return bump;
    }

    void main(){
      // Base dark water gradient
      vec3 base=mix(uDark, uMid, vUv.y);
      
      // Perturb normal for micro-details
      vec3 n = normalize(vN);
      vec3 bump = getNoiseBump(vWP.xz * 1.2, uTime);
      n = normalize(n + bump);
      
      // View direction and Fresnel
      vec3 vDir=normalize(cameraPosition-vWP);
      float fres=pow(1.0-max(0.0,dot(n,vDir)), 5.0); // Stronger fresnel curve
      
      // Reflection of the sky
      vec3 refl = mix(vec3(0.0), uSky + vec3(0.05, 0.06, 0.08), fres);
      
      // Fake Distorted Building Reflection
      float distPx = vWP.x + bump.x * 30.0;
      float distPy = vUv.y + bump.z * 0.3;
      float reflZone = smoothstep(0.3, 0.8, vUv.y); 
      
      // Windows glow (distorted)
      float glowRefl=0.0;
      if(distPy > 0.35 && distPy < 0.75){
        float windowPattern=sin(distPx*3.5)*sin(distPy*25.0);
        glowRefl=smoothstep(0.7, 0.98, windowPattern) * 0.25 * reflZone;
      }
      
      // Main Specular highlight (moon/sun)
      vec3 sunDir=normalize(vec3(-10.0,8.0,5.0));
      vec3 hDir=normalize(sunDir+vDir);
      float spec=pow(max(0.0,dot(n,hDir)), 200.0);
      
      // Secondary rim light specular
      vec3 rimDir=normalize(vec3(0.0, 5.0, -10.0));
      vec3 hRim=normalize(rimDir+vDir);
      float specRim=pow(max(0.0,dot(n,hRim)), 120.0);
      
      // Combine all
      vec3 col = base + refl + vec3(1.0,0.85,0.5)*glowRefl;
      col += vec3(1.0,0.95,0.8) * spec * 0.7; // Crisp sun reflection
      col += vec3(0.7,0.5,0.3) * specRim * 0.4; // Soft rim light
      
      gl_FragColor=vec4(col,0.95);
    }`,
  transparent:true,side:THREE.DoubleSide
});
const water=new THREE.Mesh(wGeo,wMat);
water.rotation.x=-Math.PI/2;
water.position.set(0,-0.05,12);
water.receiveShadow=true;
scene.add(water);

// Sky removed to match globe hero background

// ── RESIZE ──
function resize(){
  const w=cvs.parentElement.clientWidth,h=cvs.parentElement.clientHeight;
  R.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();
}
resize();
window.addEventListener('resize',resize);

// ── INTRO ANIMATION ──
let introProgress = 0;
let isIntersecting = false;
const campusEl = document.getElementById('campus-scene');

// ── ANIMATE ──
let t=0;
function animate(){
  requestAnimationFrame(animate);
  t+=0.008;
  
  // Trigger animation only when the scene has almost completely taken over the screen (95% visible)
  if (!isIntersecting && campusEl.getBoundingClientRect().top < window.innerHeight * 0.05) {
    isIntersecting = true;
  }
  
  if (isIntersecting && introProgress < 1) {
    introProgress += 0.012; // ~1.5 seconds at 60fps
    if (introProgress > 1) introProgress = 1;
  }
  
  // Fountain Physics Update
  if (window.fountainParticles) {
    const pts = window.fountainParticles;
    const pos = pts.geometry.attributes.position.array;
    const vel = pts.userData.vel;
    for(let i=0; i<vel.length; i++){
      pos[i*3] += vel[i].vx * 0.016;
      pos[i*3+1] += vel[i].vy * 0.016;
      pos[i*3+2] += vel[i].vz * 0.016;
      vel[i].vy -= 0.035; // Gravity pull
      
      // Splash down into the water basin
      if(pos[i*3+1] < 0) {
        pos[i*3] = (Math.random() - 0.5) * 0.1;
        pos[i*3+1] = 0;
        pos[i*3+2] = (Math.random() - 0.5) * 0.1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.45; // Wider spray
        vel[i].vx = Math.cos(a) * r;
        vel[i].vy = 1.0 + Math.random() * 1.5;
        vel[i].vz = Math.sin(a) * r;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  }
  
  wMat.uniforms.uTime.value=t;
  
  // Base hover position
  const targetX = Math.sin(t*0.12)*0.4;
  const targetY = 3.5+Math.sin(t*0.08)*0.15;
  const targetZ = 18;
  
  // Easing function (easeOutQuart for a smooth, heavy landing)
  const ease = 1 - Math.pow(1 - introProgress, 4);
  
  // Camera dives down from high above the campus (Y=40, Z=5)
  cam.position.x = targetX;
  cam.position.y = 40 - (40 - targetY) * ease;
  cam.position.z = 5 + (targetZ - 5) * ease;
  
  // Look down initially, then tilt up to face the building
  cam.lookAt(0, 3 - (1-ease)*5, 0);
  
  R.render(scene,cam);
}
animate();
})();
