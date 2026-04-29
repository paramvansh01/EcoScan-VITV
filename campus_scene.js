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


// ── REALISTIC CLASSROOM (based on reference image) ──
const classroomGroup = new THREE.Group();
classroomGroup.position.set(0, 0, -25);

// Room dimensions (local space): 30 wide, 12 tall, 28 deep
const RW = 30, RH = 12, RD = 28;

// Materials — warm beige/cream walls like reference
const wallMatC = new THREE.MeshPhongMaterial({color: 0xd4c5a9, specular: 0x111111, shininess: 5});
const wallMatLower = new THREE.MeshPhongMaterial({color: 0x8b7355}); // darker wainscoting
const ceilMat = new THREE.MeshPhongMaterial({color: 0xe8ddd0, specular: 0x222222, shininess: 10});
const floorMatC = new THREE.MeshPhongMaterial({color: 0x5a3d2b, specular: 0x222211, shininess: 20});
const deskTopMat = new THREE.MeshPhongMaterial({color: 0xc4a870, specular: 0x332211, shininess: 30});
const deskSideMat = new THREE.MeshPhongMaterial({color: 0x8b6914});
const deskLegMat = new THREE.MeshPhongMaterial({color: 0x6b4e2a});
const seatMat = new THREE.MeshPhongMaterial({color: 0x7a5c3a});
const metalMat = new THREE.MeshPhongMaterial({color: 0x555555, specular: 0x888888, shininess: 60});

// ── WALLS ──
// Back wall (behind the board)
const backWall = new THREE.Mesh(new THREE.BoxGeometry(RW+1, RH, 1), wallMatC);
backWall.position.set(0, RH/2, -RD/2); backWall.receiveShadow=true; classroomGroup.add(backWall);
// Left wall
const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, RH, RD), wallMatC);
leftWall.position.set(-RW/2, RH/2, 0); leftWall.receiveShadow=true; classroomGroup.add(leftWall);
// Right wall
const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, RH, RD), wallMatC);
rightWall.position.set(RW/2, RH/2, 0); rightWall.receiveShadow=true; classroomGroup.add(rightWall);
// Front wall (entrance side, partial — with a door gap)
const frontWallL = new THREE.Mesh(new THREE.BoxGeometry(RW/2-2, RH, 1), wallMatC);
frontWallL.position.set(-RW/4-1, RH/2, RD/2); classroomGroup.add(frontWallL);
const frontWallR = new THREE.Mesh(new THREE.BoxGeometry(RW/2-2, RH, 1), wallMatC);
frontWallR.position.set(RW/4+1, RH/2, RD/2); classroomGroup.add(frontWallR);
const frontWallTop = new THREE.Mesh(new THREE.BoxGeometry(4, RH-3.5, 1), wallMatC);
frontWallTop.position.set(0, RH-((RH-3.5)/2), RD/2); classroomGroup.add(frontWallTop);

// Lower wainscoting strip on side walls
const wainL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, RD-0.5), wallMatLower);
wainL.position.set(-RW/2+0.55, 0.6, 0); classroomGroup.add(wainL);
const wainR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, RD-0.5), wallMatLower);
wainR.position.set(RW/2-0.55, 0.6, 0); classroomGroup.add(wainR);

// ── CEILING ──
const ceiling = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.5, RD), ceilMat);
ceiling.position.set(0, RH, 0); classroomGroup.add(ceiling);
// Ceiling panels / trim
const ceilTrimMat = new THREE.MeshPhongMaterial({color: 0xc8bda8});
for(let i=-1; i<=1; i+=2){
  const trim = new THREE.Mesh(new THREE.BoxGeometry(RW-1, 0.15, 0.3), ceilTrimMat);
  trim.position.set(0, RH-0.3, i*5); classroomGroup.add(trim);
}
// Red accent strip along ceiling edge (like reference)
const redStrip = new THREE.MeshPhongMaterial({color: 0x8b2020});
const redTrimB = new THREE.Mesh(new THREE.BoxGeometry(RW-0.5, 0.2, 0.15), redStrip);
redTrimB.position.set(0, RH-0.5, -RD/2+0.6); classroomGroup.add(redTrimB);

// ── FLOOR ──
const roomFloor = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.3, RD), floorMatC);
roomFloor.position.set(0, 0, 0); roomFloor.receiveShadow=true; classroomGroup.add(roomFloor);

// ── FLUORESCENT TUBE LIGHTS (like reference) ──
const lightTubeMat = new THREE.MeshPhongMaterial({color: 0xffffff, emissive: 0xfff8e8, emissiveIntensity: 0.9});
const lightFixtureMat = new THREE.MeshPhongMaterial({color: 0xd0d0d0});
function addTubeLight(x, z){
  // Fixture housing
  const fix = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.35), lightFixtureMat);
  fix.position.set(x, RH-0.35, z); classroomGroup.add(fix);
  // Glowing tube
  const tube = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.08), lightTubeMat);
  tube.position.set(x, RH-0.42, z-0.08); classroomGroup.add(tube);
  const tube2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.08), lightTubeMat);
  tube2.position.set(x, RH-0.42, z+0.08); classroomGroup.add(tube2);
  // Point light for illumination
  const pl = new THREE.PointLight(0xfff0d0, 0.4, 15);
  pl.position.set(x, RH-0.8, z); classroomGroup.add(pl);
}
// 4 columns × 3 rows of lights across ceiling
for(let row=-1; row<=1; row++){
  for(let col=-1.5; col<=1.5; col++){
    addTubeLight(col*6, row*7);
  }
}

// ── PROJECTOR (hanging from ceiling) ──
const projBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), metalMat);
projBody.position.set(0, RH-1.2, -2); classroomGroup.add(projBody);
const projMount = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), metalMat);
projMount.position.set(0, RH-0.4, -2); classroomGroup.add(projMount);
const projLens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.15, 12), 
  new THREE.MeshPhongMaterial({color: 0x1a2a4a, specular: 0x8888ff, shininess: 100}));
projLens.rotation.x = Math.PI/2;
projLens.position.set(0, RH-1.3, -2.35); classroomGroup.add(projLens);

// ── WHITEBOARD / PROJECTION SCREEN ──
const wbMat = new THREE.MeshPhongMaterial({color: 0xf5f5f0, specular: 0x222222, shininess: 60});
const wb = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), wbMat);
wb.position.set(0, 6, -RD/2+0.6); classroomGroup.add(wb);

// Board frame (aluminium look)
const frameMat = new THREE.MeshPhongMaterial({color: 0x999999, specular: 0xaaaaaa, shininess: 50});
const frameT = new THREE.Mesh(new THREE.BoxGeometry(24.4, 0.25, 0.12), frameMat);
frameT.position.set(0, 11.1, -RD/2+0.6); classroomGroup.add(frameT);
const frameB = new THREE.Mesh(new THREE.BoxGeometry(24.4, 0.25, 0.12), frameMat);
frameB.position.set(0, 0.9, -RD/2+0.6); classroomGroup.add(frameB);
const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 10.45, 0.12), frameMat);
frameL.position.set(-12.2, 6, -RD/2+0.6); classroomGroup.add(frameL);
const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 10.45, 0.12), frameMat);
frameR.position.set(12.2, 6, -RD/2+0.6); classroomGroup.add(frameR);
// Marker tray
const tray = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 0.3), frameMat);
tray.position.set(0, 0.85, -RD/2+0.75); classroomGroup.add(tray);

// World-space corners of the whiteboard interior (inset from frame)
// Board center: local(0, 6, -RD/2+0.6) = local(0, 6, -13.4), world = (0, 6, -38.4)
const wbZ = -25 + (-RD/2 + 0.6); // world z of board
const wbCornerTL = new THREE.Vector3(-11.5, 10.5, wbZ + 0.05);
const wbCornerBR = new THREE.Vector3(11.5, 2.0, wbZ + 0.05);

// ── DESK ROWS (5 rows, center aisle, like reference image) ──
function buildDeskRow(zPos){
  const g = new THREE.Group();
  const deskW = 11, deskD = 1.8, deskH = 0.12, legH = 2.5;
  const aisleGap = 2.5; // center aisle

  [-1, 1].forEach(side => {
    const xOff = side * (aisleGap/2 + deskW/2);
    // Desk top
    const top = new THREE.Mesh(new THREE.BoxGeometry(deskW, deskH, deskD), deskTopMat);
    top.position.set(xOff, legH + deskH/2, 0); top.castShadow=true; top.receiveShadow=true; g.add(top);
    // Front panel (modesty panel)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(deskW, legH*0.6, 0.1), deskSideMat);
    panel.position.set(xOff, legH*0.35, -deskD/2); g.add(panel);
    // Legs (4 per desk half)
    for(let lx=-1; lx<=1; lx+=2){
      for(let lz=-1; lz<=1; lz+=2){
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, legH, 0.12), deskLegMat);
        leg.position.set(xOff + lx*(deskW/2-0.2), legH/2, lz*(deskD/2-0.15)); g.add(leg);
      }
    }
    // Attached bench/seat (slightly behind desk)
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.1, 0.9), seatMat);
    benchTop.position.set(xOff, 1.5, deskD/2+0.6); g.add(benchTop);
    // Bench legs
    for(let lx=-1; lx<=1; lx+=2){
      const bLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), deskLegMat);
      bLeg.position.set(xOff + lx*(deskW/2-0.3), 0.75, deskD/2+0.6); g.add(bLeg);
    }
  });
  g.position.set(0, 0.15, zPos);
  return g;
}
// 5 rows of desks from near the board to the back of the room
const deskRows = [];
const deskZPositions = [-6, -2, 2, 6, 10];
deskZPositions.forEach(z => {
  const row = buildDeskRow(z);
  classroomGroup.add(row);
  deskRows.push(row);
});

// ── DUSTBIN (always upright, with 3R recycle symbol) ──
const binGroup = new THREE.Group();
binGroup.position.set(10, 0, -8);
const binMat = new THREE.MeshStandardMaterial({color: 0x2a5a3a, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide});
const binMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 3, 16, 1, true), binMat);
binMesh.position.set(0, 1.5, 0); binGroup.add(binMesh);
const binBase = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 16), binMat);
binBase.position.set(0, 0.05, 0); binGroup.add(binBase);
// Rim at top of bin
const rimMat = new THREE.MeshStandardMaterial({color: 0x1a3a2a, metalness: 0.6, roughness: 0.2});
const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 8, 24), rimMat);
rim.rotation.x = Math.PI/2; rim.position.set(0, 3, 0); binGroup.add(rim);

// 3R Recycle symbol painted via canvas texture on bin surface
const recycleCanvas = document.createElement('canvas');
recycleCanvas.width = 256; recycleCanvas.height = 256;
const rCtx = recycleCanvas.getContext('2d');
rCtx.clearRect(0, 0, 256, 256);
const cx = 128, cy = 128, r = 80;
rCtx.lineWidth = 10; rCtx.lineCap = 'round';
rCtx.strokeStyle = '#40cc60';
// Draw three curved arrows
for(let i = 0; i < 3; i++){
  const startA = (i * Math.PI * 2 / 3) - Math.PI/2;
  const endA = startA + Math.PI * 0.55;
  rCtx.beginPath();
  rCtx.arc(cx, cy, r, startA, endA);
  rCtx.stroke();
  // Arrowhead
  const ax = cx + Math.cos(endA) * r;
  const ay = cy + Math.sin(endA) * r;
  const aDir = endA + Math.PI/2;
  rCtx.fillStyle = '#40cc60';
  rCtx.beginPath();
  rCtx.moveTo(ax + Math.cos(aDir)*16, ay + Math.sin(aDir)*16);
  rCtx.lineTo(ax + Math.cos(endA)*18, ay + Math.sin(endA)*18);
  rCtx.lineTo(ax - Math.cos(aDir)*16, ay - Math.sin(aDir)*16);
  rCtx.closePath();
  rCtx.fill();
}
// Draw "3R" text in center
rCtx.fillStyle = '#40cc60';
rCtx.font = 'bold 52px sans-serif';
rCtx.textAlign = 'center';
rCtx.textBaseline = 'middle';
rCtx.fillText('3R', cx, cy);

const recycleTex = new THREE.CanvasTexture(recycleCanvas);
recycleTex.needsUpdate = true;
const recyclePlaneMat = new THREE.MeshStandardMaterial({
  map: recycleTex, transparent: true, alphaTest: 0.1,
  roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide,
  depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
});
// Curved decal matching bin cylinder curvature (wraps around -x face)
// Bin is CylinderGeometry(1.2, 1.0, 3) — use slightly larger radii to sit on surface
// thetaStart = PI*1.3, thetaLength = PI*0.4 centers the arc at 3PI/2 (-x direction)
const decalGeo = new THREE.CylinderGeometry(1.22, 1.02, 1.8, 16, 1, true, Math.PI * 1.3, Math.PI * 0.4);
const recyclePlane = new THREE.Mesh(decalGeo, recyclePlaneMat);
recyclePlane.position.set(0, 1.5, 0); // same center as bin mesh
binGroup.add(recyclePlane);

// Bin is always upright - no rotation
binGroup.position.y = 0.15;
classroomGroup.add(binGroup);

// ── PULLEY SYSTEM (gear + two strings from ceiling) ──
const pulleyGroup = new THREE.Group();
pulleyGroup.position.set(10, 0, -8); // same x,z as bin
// Gear at ceiling
const gearMat = new THREE.MeshStandardMaterial({color: 0x555555, metalness: 0.9, roughness: 0.1});
const gearCore = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 24), gearMat);
gearCore.rotation.x = Math.PI/2; gearCore.position.set(0, RH-0.5, 0); pulleyGroup.add(gearCore);
// Gear teeth
for(let i=0; i<12; i++){
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.22), gearMat);
  const a = (i/12)*Math.PI*2;
  tooth.position.set(Math.cos(a)*0.58, RH-0.5, Math.sin(a)*0.58);
  tooth.rotation.y = a;
  pulleyGroup.add(tooth);
}
// Gear axle
const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), gearMat);
axle.rotation.x = Math.PI/2; axle.position.set(0, RH-0.5, 0); pulleyGroup.add(axle);

// Two strings (thin cylinders, initially hidden above ceiling)
const stringMat = new THREE.MeshStandardMaterial({color: 0x8b7355, roughness: 0.8});
const stringL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), stringMat);
stringL.position.set(-0.6, RH, 0); // starts at ceiling, length will be scaled
stringL.geometry.translate(0, -0.5, 0); // pivot from top
pulleyGroup.add(stringL);
const stringR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), stringMat);
stringR.position.set(0.6, RH, 0);
stringR.geometry.translate(0, -0.5, 0);
pulleyGroup.add(stringR);

// String hooks (small rings at bottom of strings)
const hookMat = new THREE.MeshStandardMaterial({color: 0x666666, metalness: 0.8, roughness: 0.2});
const hookL = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), hookMat);
hookL.rotation.x = Math.PI/2; pulleyGroup.add(hookL);
const hookR = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), hookMat);
hookR.rotation.x = Math.PI/2; pulleyGroup.add(hookR);

// Initially hide pulley strings (scale Y to 0)
stringL.scale.y = 0; stringR.scale.y = 0;
hookL.visible = false; hookR.visible = false;
classroomGroup.add(pulleyGroup);

// Trash pieces (scattered on floor near the dustbin)
const trashMat = new THREE.MeshStandardMaterial({color: 0xdddddd, roughness: 0.9});
const trashPieces = [];
for(let i=0; i<15; i++){
  const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random()*0.2, 1), trashMat);
  const pos = t.geometry.attributes.position;
  for(let j=0; j<pos.count; j++) pos.setXYZ(j, pos.getX(j)*(0.8+Math.random()*0.4), pos.getY(j)*(0.8+Math.random()*0.4), pos.getZ(j)*(0.8+Math.random()*0.4));
  t.geometry.computeVertexNormals();
  const startX = 10 - 2 - Math.random()*4;
  const startZ = -8 + (Math.random()-0.5)*3;
  t.position.set(startX, 0.3, startZ);
  t.userData = {
    startPos: new THREE.Vector3(startX, 0.3, startZ),
    // Target: inside the bin opening (x=10, y=2.5-3.5 arc into bin, z=-8)
    targetPos: new THREE.Vector3(10 + (Math.random()-0.5)*0.5, 2.8 + Math.random()*0.5, -8 + (Math.random()-0.5)*0.5),
    delay: Math.random() * 0.4
  };
  classroomGroup.add(t);
  trashPieces.push(t);
}

// ── CLASSROOM LIGHTING ──
// Main overhead warm lights
const classLight1 = new THREE.PointLight(0xfff0d0, 0.5, 40);
classLight1.position.set(0, RH-1, -5); classroomGroup.add(classLight1);
const classLight2 = new THREE.PointLight(0xfff0d0, 0.4, 40);
classLight2.position.set(0, RH-1, 5); classroomGroup.add(classLight2);
const classLight3 = new THREE.PointLight(0xfff0d0, 0.3, 30);
classLight3.position.set(-8, RH-1, 0); classroomGroup.add(classLight3);
const classLight4 = new THREE.PointLight(0xfff0d0, 0.3, 30);
classLight4.position.set(8, RH-1, 0); classroomGroup.add(classLight4);

scene.add(classroomGroup);
classroomGroup.visible = false; // hidden until camera approaches

window.classroomBin = binGroup;
window.classroomTrash = trashPieces;
window.classroomPulley = { group: pulleyGroup, stringL, stringR, hookL, hookR, gearCore, RH };

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
// Board world position: classroomGroup(0,0,-25) + local(0, 6, -13.4) = (0, 6, -38.4)
const boardLookAt = new THREE.Vector3(0, 6, -38.4);
// Camera positions for classroom traversal (world coords)
const classBackPos = new THREE.Vector3(0, 5, -12);   // back of room (behind all desks)
const classFrontPos = new THREE.Vector3(0, 5, -18); // same ~20 unit distance to board as original view

let t=0;
function animate(){
  requestAnimationFrame(animate);
  t+=0.008;
  const scrollY = window.scrollY || 0;
  const wh = window.innerHeight;
  const globeEnd = wh * 4;
  const hoverEnd = wh * 5;
  const classroomEnter = wh * 6;  // camera arrives at back of classroom
  const zoomEnd = wh * 8;          // camera past all benches, only board visible
  const wbStart = wh * 8;
  const maxScroll = Math.max(1, (document.body.scrollHeight || document.body.offsetHeight) - wh);
  
  if (window.fountainParticles) {
    const pts = window.fountainParticles;
    const pos = pts.geometry.attributes.position.array;
    const vel = pts.userData.vel;
    for(let i=0; i<vel.length; i++){
      pos[i*3] += vel[i].vx * 0.016;
      pos[i*3+1] += vel[i].vy * 0.016;
      pos[i*3+2] += vel[i].vz * 0.016;
      vel[i].vy -= 0.035; 
      if(pos[i*3+1] < 0) {
        pos[i*3] = (Math.random() - 0.5) * 0.1;
        pos[i*3+1] = 0;
        pos[i*3+2] = (Math.random() - 0.5) * 0.1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.45;
        vel[i].vx = Math.cos(a) * r;
        vel[i].vy = 1.0 + Math.random() * 1.5;
        vel[i].vz = Math.sin(a) * r;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  }
  wMat.uniforms.uTime.value=t;
  let targetX = Math.sin(t*0.12)*0.4;
  let targetY = 3.5+Math.sin(t*0.08)*0.15;
  let targetZ = 18;
  
  if (scrollY < globeEnd) {
     // Globe phase — camera far above
     cam.position.set(0, 40, 5);
     cam.lookAt(0, 3, 0);
     classroomGroup.visible = false;
  } else if (scrollY < hoverEnd) {
    // Descend to campus level
    let ease = (scrollY - globeEnd) / (hoverEnd - globeEnd);
    ease = 1 - Math.pow(1 - ease, 4);
    cam.position.x = targetX;
    cam.position.y = 40 - (40 - targetY) * ease;
    cam.position.z = 5 + (targetZ - 5) * ease;
    cam.lookAt(0, 3 - (1-ease)*5, 0);
    classroomGroup.visible = false;
  } else if (scrollY < classroomEnter) {
    // Zoom from campus into back of classroom
    let p = (scrollY - hoverEnd) / (classroomEnter - hoverEnd);
    // Only show classroom once camera is past the campus buildings
    classroomGroup.visible = p > 0.5;
    p = p * p * (3 - 2 * p); // smoothstep
    cam.position.x = targetX * (1-p) + classBackPos.x * p;
    cam.position.y = targetY * (1-p) + classBackPos.y * p;
    cam.position.z = targetZ * (1-p) + classBackPos.z * p;
    // Smoothly transition lookAt from campus (0,3,0) to the board
    const lx = 0, ly = 3*(1-p) + boardLookAt.y*p, lz = 0*(1-p) + boardLookAt.z*p;
    cam.lookAt(lx, ly, lz);
  } else if (scrollY < zoomEnd) {
    // Move through classroom benches toward the board
    let p = (scrollY - classroomEnter) / (zoomEnd - classroomEnter);
    p = p * p * (3 - 2 * p); // smoothstep
    cam.position.x = classBackPos.x * (1-p) + classFrontPos.x * p;
    cam.position.y = classBackPos.y * (1-p) + classFrontPos.y * p;
    cam.position.z = classBackPos.z * (1-p) + classFrontPos.z * p;
    cam.lookAt(boardLookAt.x, boardLookAt.y, boardLookAt.z);
  } else {
    // Locked in front of board — only board visible
    cam.position.set(classFrontPos.x, classFrontPos.y, classFrontPos.z);
    cam.lookAt(boardLookAt.x, boardLookAt.y, boardLookAt.z);
    
    let trashP = (scrollY - wbStart) / Math.max(1, (maxScroll - wbStart));
    trashP = Math.min(1, Math.max(0, trashP));
    
    // Phase 1 (0–50%): Trash balls arc into the upright bin
    if (window.classroomTrash) {
      window.classroomTrash.forEach(tr => {
        let p = (trashP * 2 - tr.userData.delay) / (1 - tr.userData.delay); // complete by 50%
        p = Math.min(1, Math.max(0, p));
        p = 1 - Math.pow(1-p, 3); // ease out
        const arcH = Math.sin(p * Math.PI) * 5; // high arc into bin
        tr.position.x = tr.userData.startPos.x * (1-p) + tr.userData.targetPos.x * p;
        tr.position.y = tr.userData.startPos.y * (1-p) + tr.userData.targetPos.y * p + arcH;
        tr.position.z = tr.userData.startPos.z * (1-p) + tr.userData.targetPos.z * p;
        // Hide trash once it reaches inside the bin
        tr.visible = (p < 0.95);
        // Spin the trash ball as it flies
        tr.rotation.x = p * Math.PI * 3;
        tr.rotation.z = p * Math.PI * 2;
      });
    }
    
    // Phase 2 (55–75%): Pulley strings descend from ceiling gear
    // Phase 3 (75–100%): Strings attach to bin and lift it up
    if (window.classroomPulley && window.classroomBin) {
      const pul = window.classroomPulley;
      const bin = window.classroomBin;
      
      // Gear spins when pulley is active (55%+)
      if (trashP > 0.55) {
        pul.gearCore.rotation.z = (trashP - 0.55) * Math.PI * 8;
      }
      
      // Strings descend (55% to 75%)
      let stringP = (trashP - 0.55) / 0.2;
      stringP = Math.min(1, Math.max(0, stringP));
      stringP = stringP * stringP * (3 - 2 * stringP); // smoothstep
      
      const binTopY = 3.15; // top of bin in local space
      const stringLen = (pul.RH - binTopY) * stringP;
      
      pul.stringL.scale.y = stringLen;
      pul.stringR.scale.y = stringLen;
      pul.hookL.visible = stringP > 0.1;
      pul.hookR.visible = stringP > 0.1;
      // Position hooks at bottom of strings
      const hookY = pul.RH - stringLen;
      pul.hookL.position.set(-0.6, hookY, 0);
      pul.hookR.position.set(0.6, hookY, 0);
      
      // Lift bin up (75% to 100%)
      let liftP = (trashP - 0.75) / 0.25;
      liftP = Math.min(1, Math.max(0, liftP));
      liftP = liftP * liftP; // ease in (accelerating lift)
      
      const liftHeight = liftP * (pul.RH + 5); // lift above ceiling
      bin.position.y = 0.15 + liftHeight;
      
      // Strings shorten as bin rises (retract)
      if (liftP > 0) {
        const remainLen = Math.max(0, (pul.RH - binTopY) - liftHeight);
        pul.stringL.scale.y = remainLen;
        pul.stringR.scale.y = remainLen;
        pul.hookL.position.set(-0.6, bin.position.y + binTopY, 0);
        pul.hookR.position.set(0.6, bin.position.y + binTopY, 0);
      }
    }
  }
  
  const wbDOM = document.getElementById('whiteboard-layer');
  const wbContent = document.getElementById('whiteboard-scroll-content');
  if(wbDOM && wbContent){
     if(scrollY >= zoomEnd){
        // Project 3D whiteboard corners to screen pixels for precise overlay alignment
        cam.updateMatrixWorld();
        const cw = cvs.clientWidth;
        const ch = cvs.clientHeight;
        
        const tlProj = wbCornerTL.clone().project(cam);
        const brProj = wbCornerBR.clone().project(cam);
        
        const sLeft = (tlProj.x * 0.5 + 0.5) * cw;
        const sTop = (-tlProj.y * 0.5 + 0.5) * ch;
        const sRight = (brProj.x * 0.5 + 0.5) * cw;
        const sBottom = (-brProj.y * 0.5 + 0.5) * ch;
        
        wbDOM.style.left = sLeft + 'px';
        wbDOM.style.top = sTop + 'px';
        wbDOM.style.width = (sRight - sLeft) + 'px';
        wbDOM.style.height = (sBottom - sTop) + 'px';
        
        // Fade in the whiteboard text overlay
        let fadeP = Math.min(1, (scrollY - zoomEnd) / (wh * 0.3));
        wbDOM.style.opacity = fadeP;
        wbDOM.style.pointerEvents = fadeP > 0.5 ? 'auto' : 'none';
        let scrollP = (scrollY - zoomEnd - wh*0.3) / Math.max(1, (maxScroll - zoomEnd - wh*0.3));
        scrollP = Math.min(1, Math.max(0, scrollP));
        const dist = Math.max(0, wbContent.offsetHeight - wbDOM.offsetHeight);
        wbContent.style.transform = `translateY(${-dist * scrollP}px)`;
     } else {
        wbDOM.style.opacity = 0;
        wbDOM.style.pointerEvents = 'none';
        wbContent.style.transform = `translateY(0px)`;
     }
  }
  
  const cOverlay = document.getElementById('campus-overlay');
  if (cOverlay) cOverlay.style.opacity = (scrollY >= globeEnd && scrollY < hoverEnd) ? 1 : 0;
  
  R.render(scene,cam);
}
animate();
})();
