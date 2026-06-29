// === SAVE DATA ===
const DEFAULT_SAVE = { coins: 0, ownedCharacters: ['default'], ownedDimensions: ['city'], activeCharacter: 'default', activeDimension: 'city', ownedFlyMachine: false, ownedSlowDown: 0, playerName: '' };
let save = JSON.parse(localStorage.getItem('cityrunner_save') || 'null') || { ...DEFAULT_SAVE };
if (!save.playerName) save.playerName = '';
function saveToDisk() { localStorage.setItem('cityrunner_save', JSON.stringify(save)); }

// === SHOP DATA ===
const DIMENSIONS = [
  { id: 'city', name: 'Verlaten Stad', price: 0, colors: { ground: 0x3a3a4a, buildings: 0x4a4a5a, sky: 0x1a1a2e, accent: 0x6a6a7a } },
  { id: 'desert', name: 'Woestijnstad', price: 50, colors: { ground: 0xc2956b, buildings: 0xd4a574, sky: 0x87CEEB, accent: 0xe8c07a } },
  { id: 'ice', name: 'IJsstad', price: 80, colors: { ground: 0xb8d4e3, buildings: 0xddeeff, sky: 0x2c3e50, accent: 0x74b9ff } },
  { id: 'jungle', name: 'Jungle Stad', price: 120, colors: { ground: 0x4a7c3f, buildings: 0x6b8e5a, sky: 0x1a3a1a, accent: 0x2ecc71 } }
];
const CHARACTERS = [
  { id: 'default', name: 'Runner', price: 0, color: 0x00d4ff },
  { id: 'fire', name: 'Blaze', price: 30, color: 0xff4757 },
  { id: 'gold', name: 'Goldie', price: 60, color: 0xffd700 },
  { id: 'shadow', name: 'Shadow', price: 100, color: 0x9b59b6 }
];
const FLY_MACHINE_PRICE = 20;
const SLOW_DOWN_PRICE = 10;

// === GAME VARIABLES ===
let scene, camera, renderer, clock;
let player, playerLane = 1; // 0=left, 1=center, 2=right
let targetX = 0;
const LANE_WIDTH = 2.5;
const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
let speed = 0.12, baseSpeed = 0.12, maxSpeed = 0.5;
let lives = 3, coins = 0, distance = 0;
let isPlaying = false, isJumping = false, isFlying = false;
let jumpVelocity = 0;
let flyTimer = 0, flyDuration = 10, flyUsedThisRun = false;
let obstacles = [], coinObjects = [], buildings = [];
let groundTiles = [];
let invincibleTimer = 0;
let slowActive = false;
let particles = [];
let sunLight = null;

// === THREE.JS SETUP ===
function initScene() {
  scene = new THREE.Scene();
  const dim = DIMENSIONS.find(d => d.id === save.activeDimension);
  scene.background = new THREE.Color(dim.colors.sky);
  scene.fog = new THREE.Fog(dim.colors.sky, 30, 80);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 4, -6);
  camera.lookAt(0, 1.5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.insertBefore(renderer.domElement, document.getElementById('ui'));

  // Lighting for start screen background
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(5, 15, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -10;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x404060, 0.6));
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3));

  clock = new THREE.Clock();

  // Build a static world for the background of the start screen
  createWorld();
}

// === WORLD GENERATION ===
function createWorld() {
  const dim = DIMENSIONS.find(d => d.id === save.activeDimension);

  // Ground
  for (let i = 0; i < 10; i++) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ color: dim.colors.ground, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = i * 12;
    ground.receiveShadow = true;
    scene.add(ground);
    groundTiles.push(ground);
  }

  // Road markings
  for (let i = 0; i < 20; i++) {
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true })
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(0, 0.01, i * 6);
    scene.add(mark);
    groundTiles.push(mark);
  }

  // Buildings on both sides
  generateBuildings(dim);
}

function generateBuildings(dim) {
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 20; i++) {
      const h = 5 + Math.random() * 15;
      const w = 3 + Math.random() * 3;
      const d = 3 + Math.random() * 4;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(dim.colors.buildings).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
        roughness: 0.85
      });
      const building = new THREE.Mesh(geo, mat);
      building.position.set(side * (7 + Math.random() * 3), h / 2, i * 6 + Math.random() * 4);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
      buildings.push(building);

      // Windows
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffee88, opacity: 0.3 + Math.random() * 0.4, transparent: true });
      for (let wy = 1; wy < h - 1; wy += 1.5) {
        for (let wx = -w / 3; wx <= w / 3; wx += w / 3) {
          if (Math.random() > 0.4) continue;
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), winMat);
          win.position.set(building.position.x + (side < 0 ? w / 2 + 0.01 : -w / 2 - 0.01), wy, building.position.z + wx);
          win.rotation.y = side < 0 ? 0 : Math.PI;
          scene.add(win);
          buildings.push(win);
        }
      }
    }
  }
}

// === PLAYER ===
let playerParts = {};

function createPlayer() {
  const charData = CHARACTERS.find(c => c.id === save.activeCharacter);
  const group = new THREE.Group();
  const skin = 0xe8b88a;
  const mainColor = charData.color;
  const darkShirt = new THREE.Color(mainColor).offsetHSL(0, 0, -0.15).getHex();
  const pantsColor = 0x1c2833;
  const beltColor = 0x1a1a1a;
  const shoeColor = 0xf0f0f0;
  const soleColor = 0x222222;
  const laceColor = 0xff4444;

  // === TORSO GROUP ===
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.95;

  // Chest (wider at shoulders, narrow waist)
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.22, 12, 18), new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.4 }));
  chest.scale.set(1.1, 1, 0.85);
  chest.castShadow = true;
  torsoGroup.add(chest);

  // Shirt seam / collar
  const collarL = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 4, 8), new THREE.MeshStandardMaterial({ color: darkShirt }));
  collarL.position.set(-0.06, 0.2, 0.12);
  collarL.rotation.z = 0.3;
  torsoGroup.add(collarL);
  const collarR = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 4, 8), new THREE.MeshStandardMaterial({ color: darkShirt }));
  collarR.position.set(0.06, 0.2, 0.12);
  collarR.rotation.z = -0.3;
  torsoGroup.add(collarR);

  // Belt
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 24), new THREE.MeshStandardMaterial({ color: beltColor, metalness: 0.3 }));
  belt.position.y = -0.18;
  belt.rotation.x = Math.PI / 2;
  torsoGroup.add(belt);

  // Belt buckle
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.01), new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 }));
  buckle.position.set(0, -0.18, 0.16);
  torsoGroup.add(buckle);

  group.add(torsoGroup);

  // === HEAD GROUP ===
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.48;

  // Neck with adam's apple hint
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.09, 12), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.45 }));
  neck.position.y = -0.1;
  headGroup.add(neck);

  // Head (slightly oval, realistic proportions)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 32), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.4 }));
  head.scale.set(0.92, 1.05, 0.9);
  head.castShadow = true;
  headGroup.add(head);

  // Jaw definition
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.4 }));
  jaw.scale.set(1, 0.5, 0.8);
  jaw.position.set(0, -0.08, 0.03);
  headGroup.add(jaw);

  // Hair - modern short style
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.45), new THREE.MeshStandardMaterial({ color: 0x150a05, roughness: 1 }));
  hairTop.position.y = 0.03;
  headGroup.add(hairTop);
  // Hair sides
  const hairSideGeo = new THREE.CylinderGeometry(0.14, 0.13, 0.1, 20, 1, true);
  const hairSide = new THREE.Mesh(hairSideGeo, new THREE.MeshStandardMaterial({ color: 0x150a05, roughness: 1, side: THREE.DoubleSide }));
  hairSide.position.y = 0.01;
  headGroup.add(hairSide);

  // Eyebrows (thick, expressive)
  for (let s = -1; s <= 1; s += 2) {
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), new THREE.MeshStandardMaterial({ color: 0x150a05 }));
    brow.position.set(s * 0.04, 0.055, 0.13);
    brow.rotation.z = s * -0.15;
    headGroup.add(brow);
  }

  // Eyes (detailed with white, iris, pupil)
  for (let s = -1; s <= 1; s += 2) {
    const eyeSocket = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), new THREE.MeshStandardMaterial({ color: 0xfafafa }));
    eyeSocket.position.set(s * 0.04, 0.025, 0.12);
    headGroup.add(eyeSocket);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), new THREE.MeshStandardMaterial({ color: 0x4a6741, roughness: 0.3 }));
    iris.position.set(s * 0.04, 0.025, 0.14);
    headGroup.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pupil.position.set(s * 0.04, 0.025, 0.145);
    headGroup.add(pupil);
  }

  // Nose (bridge + tip)
  const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.025, 4, 8), new THREE.MeshStandardMaterial({ color: skin }));
  noseBridge.position.set(0, 0.01, 0.14);
  headGroup.add(noseBridge);
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), new THREE.MeshStandardMaterial({ color: skin }));
  noseTip.position.set(0, -0.005, 0.155);
  headGroup.add(noseTip);

  // Mouth (subtle line)
  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.025, 4, 8), new THREE.MeshStandardMaterial({ color: 0xc47a6a }));
  mouth.position.set(0, -0.04, 0.13);
  mouth.rotation.z = Math.PI / 2;
  headGroup.add(mouth);

  // Ears
  for (let s = -1; s <= 1; s += 2) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshStandardMaterial({ color: skin }));
    ear.scale.set(0.45, 1, 0.6);
    ear.position.set(s * 0.13, 0, 0);
    headGroup.add(ear);
  }

  group.add(headGroup);

  // === LEGS ===
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.07, 0.68, 0);
  const lThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 10, 14), new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.5 }));
  lThigh.position.y = -0.14;
  lThigh.castShadow = true;
  leftLegGroup.add(lThigh);
  const lKnee = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.5 }));
  lKnee.position.y = -0.27;
  leftLegGroup.add(lKnee);
  const lShin = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.2, 10, 14), new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.5 }));
  lShin.position.y = -0.4;
  leftLegGroup.add(lShin);
  // Sneaker
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.25 }));
  lShoe.position.set(0, -0.54, 0.02);
  leftLegGroup.add(lShoe);
  const lSole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.025, 0.25), new THREE.MeshStandardMaterial({ color: soleColor }));
  lSole.position.set(0, -0.58, 0.02);
  leftLegGroup.add(lSole);
  // Lace detail
  const lLace = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.08), new THREE.MeshBasicMaterial({ color: laceColor }));
  lLace.position.set(0, -0.5, 0.05);
  leftLegGroup.add(lLace);
  group.add(leftLegGroup);

  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.07, 0.68, 0);
  const rThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 10, 14), new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.5 }));
  rThigh.position.y = -0.14;
  rThigh.castShadow = true;
  rightLegGroup.add(rThigh);
  const rKnee = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.5 }));
  rKnee.position.y = -0.27;
  rightLegGroup.add(rKnee);
  const rShin = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.2, 10, 14), new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.5 }));
  rShin.position.y = -0.4;
  rightLegGroup.add(rShin);
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.25 }));
  rShoe.position.set(0, -0.54, 0.02);
  rightLegGroup.add(rShoe);
  const rSole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.025, 0.25), new THREE.MeshStandardMaterial({ color: soleColor }));
  rSole.position.set(0, -0.58, 0.02);
  rightLegGroup.add(rSole);
  const rLace = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.08), new THREE.MeshBasicMaterial({ color: laceColor }));
  rLace.position.set(0, -0.5, 0.05);
  rightLegGroup.add(rLace);
  group.add(rightLegGroup);

  // === ARMS ===
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.22, 1.15, 0);
  // Sleeve (short)
  const lSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.08, 6, 12), new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.4 }));
  lSleeve.position.y = -0.06;
  lSleeve.castShadow = true;
  leftArmGroup.add(lSleeve);
  // Bare forearm
  const lFore = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 8, 12), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.45 }));
  lFore.position.y = -0.22;
  leftArmGroup.add(lFore);
  // Wrist
  const lWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 8), new THREE.MeshStandardMaterial({ color: skin }));
  lWrist.position.y = -0.33;
  leftArmGroup.add(lWrist);
  // Hand (fist-like for running)
  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), new THREE.MeshStandardMaterial({ color: skin }));
  lHand.scale.set(1, 1.2, 0.8);
  lHand.position.y = -0.37;
  leftArmGroup.add(lHand);
  group.add(leftArmGroup);

  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.22, 1.15, 0);
  const rSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.08, 6, 12), new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.4 }));
  rSleeve.position.y = -0.06;
  rSleeve.castShadow = true;
  rightArmGroup.add(rSleeve);
  const rFore = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 8, 12), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.45 }));
  rFore.position.y = -0.22;
  rightArmGroup.add(rFore);
  const rWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 8), new THREE.MeshStandardMaterial({ color: skin }));
  rWrist.position.y = -0.33;
  rightArmGroup.add(rWrist);
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), new THREE.MeshStandardMaterial({ color: skin }));
  rHand.scale.set(1, 1.2, 0.8);
  rHand.position.y = -0.37;
  rightArmGroup.add(rHand);
  group.add(rightArmGroup);

  group.position.set(0, 0, 0);
  scene.add(group);
  player = group;
  playerParts = { torso: torsoGroup, head: headGroup, leftLeg: leftLegGroup, rightLeg: rightLegGroup, leftArm: leftArmGroup, rightArm: rightArmGroup };
}

// === OBSTACLE SPAWNING ===
function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const types = ['car', 'barrier', 'dumpster', 'trafficcone'];
  const type = types[Math.floor(Math.random() * types.length)];
  let mesh;

  if (type === 'car') {
    mesh = new THREE.Group();
    // Car body
    const bodyColor = [0x8b0000, 0x1a3a5c, 0x2f4f2f, 0x4a4a4a, 0xdaa520][Math.floor(Math.random() * 5)];
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.7, 3.2),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.4 })
    );
    body.position.y = 0.5;
    body.castShadow = true;
    mesh.add(body);
    // Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.55, 1.6),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.4 })
    );
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    mesh.add(cabin);
    // Windows (dark glass)
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.1, metalness: 0.8 });
    const frontWin = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.4), winMat);
    frontWin.position.set(0, 1.05, 0.61);
    mesh.add(frontWin);
    const backWin = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.4), winMat);
    backWin.position.set(0, 1.05, -1.01);
    backWin.rotation.y = Math.PI;
    mesh.add(backWin);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
    for (let wz of [-0.9, 0.9]) {
      for (let wx of [-0.7, 0.7]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.22, wz);
        mesh.add(wheel);
      }
    }
    // Headlights
    for (let s = -1; s <= 1; s += 2) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffaa }));
      light.position.set(s * 0.5, 0.5, 1.61);
      mesh.add(light);
    }
    // Taillights
    for (let s = -1; s <= 1; s += 2) {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      tail.position.set(s * 0.55, 0.5, -1.61);
      mesh.add(tail);
    }

  } else if (type === 'barrier') {
    mesh = new THREE.Group();
    // Jersey barrier (concrete)
    const barrierShape = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.9, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 })
    );
    barrierShape.position.y = 0.45;
    barrierShape.castShadow = true;
    mesh.add(barrierShape);
    // Top slant
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.15, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.9 })
    );
    top.position.y = 0.95;
    mesh.add(top);
    // Orange/white stripes
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.51, 0.15, 1.81),
      new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.7 })
    );
    stripe.position.y = 0.7;
    mesh.add(stripe);

  } else if (type === 'dumpster') {
    mesh = new THREE.Group();
    // Main bin
    const bin = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.0, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x2e5e2e, roughness: 0.7, metalness: 0.2 })
    );
    bin.position.y = 0.6;
    bin.castShadow = true;
    mesh.add(bin);
    // Lid
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.06, 1.45),
      new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.6, metalness: 0.3 })
    );
    lid.position.y = 1.13;
    lid.rotation.x = Math.random() * 0.3;
    mesh.add(lid);
    // Wheels
    for (let s = -1; s <= 1; s += 2) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 0.55, 0.1, 0.5);
      mesh.add(w);
    }

  } else {
    // Traffic cones (cluster)
    mesh = new THREE.Group();
    const coneCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < coneCount; i++) {
      const cone = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      base.position.y = 0.02;
      cone.add(base);
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 }));
      body.position.y = 0.3;
      cone.add(body);
      const stripe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      stripe1.position.y = 0.35;
      cone.add(stripe1);
      cone.position.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.8);
      cone.rotation.y = Math.random() * Math.PI;
      mesh.add(cone);
    }
  }

  mesh.position.set(LANES[lane], 0, player.position.z + 80 + Math.random() * 20);
  scene.add(mesh);
  obstacles.push({ mesh, lane, passed: false });
}

// === COIN SPAWNING ===
function spawnCoin() {
  const lane = Math.floor(Math.random() * 3);
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2, emissive: 0xffa500, emissiveIntensity: 0.3 })
  );
  coin.rotation.x = Math.PI / 2;
  coin.position.set(LANES[lane], 1.2 + Math.random() * 0.5, player.position.z + 60 + Math.random() * 30);
  scene.add(coin);
  coinObjects.push(coin);
}

// === PARTICLES ===
function spawnParticles(pos, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    p.position.copy(pos);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.2 + 0.1, (Math.random() - 0.5) * 0.3);
    scene.add(p);
    particles.push({ mesh: p, vel, life: 1 });
  }
}

// === GAME LOOP ===
let spawnTimer = 0, coinSpawnTimer = 0;

function update() {
  if (!isPlaying) return;
  const dt = clock.getDelta();
  distance += speed;

  // Increase speed over time
  if (!slowActive) {
    speed = Math.min(maxSpeed, baseSpeed + distance * 0.0001);
  }

  // Player lane movement (smooth)
  targetX = LANES[playerLane];
  player.position.x += (targetX - player.position.x) * 0.15;

  // Jump
  if (isJumping) {
    player.position.y += jumpVelocity;
    jumpVelocity -= 0.011;
    if (player.position.y <= 0) {
      player.position.y = 0;
      isJumping = false;
      jumpVelocity = 0;
    }
  }

  // Flying
  if (isFlying) {
    player.position.y = 3.5;
    flyTimer -= dt;
    document.querySelector('#fly-bar .fill').style.width = (flyTimer / flyDuration * 100) + '%';
    if (flyTimer <= 0) {
      isFlying = false;
      player.position.y = 0;
      document.getElementById('fly-bar').classList.add('hidden');
    }
  }

  // Invincibility timer
  if (invincibleTimer > 0) {
    invincibleTimer -= dt;
    player.visible = Math.floor(invincibleTimer * 10) % 2 === 0;
  } else {
    player.visible = true;
  }

  // Move camera forward (third-person: behind and above player)
  player.position.z += speed;
  camera.position.z = player.position.z - 8;
  camera.position.y = 3.5;
  camera.position.x += (player.position.x * 0.3 - camera.position.x) * 0.05;
  camera.lookAt(player.position.x * 0.3, 1, player.position.z + 10);

  // Sun follows player
  if (sunLight) {
    sunLight.position.z = player.position.z;
    sunLight.target.position.z = player.position.z;
    sunLight.target.updateMatrixWorld();
  }

  // Player running animation (realistic cycle)
  if (!isJumping && !isFlying && playerParts.leftLeg) {
    const t = distance * 14;
    const legSwing = Math.sin(t) * 0.55;
    const armSwing = Math.sin(t) * 0.6;
    const bounce = Math.abs(Math.sin(t * 2)) * 0.025;
    const sway = Math.sin(t) * 0.015;

    // Legs swing with natural stride
    playerParts.leftLeg.rotation.x = legSwing;
    playerParts.rightLeg.rotation.x = -legSwing;

    // Arms pump opposite to legs, elbows bent
    playerParts.leftArm.rotation.x = -armSwing;
    playerParts.leftArm.rotation.z = 0.1;
    playerParts.rightArm.rotation.x = armSwing;
    playerParts.rightArm.rotation.z = -0.1;

    // Torso leans forward, subtle side-to-side sway
    playerParts.torso.rotation.x = 0.1;
    playerParts.torso.rotation.z = sway;
    playerParts.torso.position.y = 0.95 + bounce;

    // Head stays stable with very slight bob
    playerParts.head.position.y = 1.48 + bounce * 0.3;
    playerParts.head.rotation.x = -0.05; // looking forward
  } else if (isJumping && playerParts.leftLeg) {
    // In-air pose: tucked legs, arms back
    playerParts.leftLeg.rotation.x = -0.4;
    playerParts.rightLeg.rotation.x = 0.2;
    playerParts.leftArm.rotation.x = -1.0;
    playerParts.leftArm.rotation.z = 0.2;
    playerParts.rightArm.rotation.x = -1.0;
    playerParts.rightArm.rotation.z = -0.2;
    playerParts.torso.rotation.x = 0.15;
  }

  // Spawn obstacles
  spawnTimer += speed;
  if (spawnTimer > 18 + Math.random() * 10) {
    spawnObstacle();
    spawnTimer = 0;
  }

  // Spawn coins
  coinSpawnTimer += speed;
  if (coinSpawnTimer > 12 + Math.random() * 8) {
    spawnCoin();
    coinSpawnTimer = 0;
  }

  // Update obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    // Remove if behind camera
    if (obs.mesh.position.z < player.position.z - 15) {
      scene.remove(obs.mesh);
      obstacles.splice(i, 1);
      continue;
    }
    // Collision
    if (!obs.passed && !isFlying && invincibleTimer <= 0) {
      const dz = Math.abs(obs.mesh.position.z - player.position.z);
      const dx = Math.abs(obs.mesh.position.x - player.position.x);
      if (dz < 1.2 && dx < 1.0 && player.position.y < 1.5) {
        obs.passed = true;
        hitPlayer(obs.mesh.position);
      }
    }
  }

  // Update coins
  for (let i = coinObjects.length - 1; i >= 0; i--) {
    const coin = coinObjects[i];
    coin.rotation.z += dt * 4;
    if (coin.position.z < player.position.z - 15) {
      scene.remove(coin);
      coinObjects.splice(i, 1);
      continue;
    }
    // Collect
    const dz = Math.abs(coin.position.z - player.position.z);
    const dx = Math.abs(coin.position.x - player.position.x);
    const dy = Math.abs(coin.position.y - player.position.y - 1);
    if (dz < 1 && dx < 1 && dy < 1.5) {
      spawnParticles(coin.position, 0xffd700, 6);
      scene.remove(coin);
      coinObjects.splice(i, 1);
      coins++;
      playCoinSound();
      updateHUD();
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.add(p.vel);
    p.vel.y -= 0.008;
    p.life -= dt * 2;
    p.mesh.material.opacity = p.life;
    p.mesh.material.transparent = true;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  // Recycle ground tiles
  for (const tile of groundTiles) {
    if (tile.position.z < player.position.z - 15) {
      tile.position.z += 120;
    }
  }

  // Recycle buildings
  for (const b of buildings) {
    if (b.position.z < player.position.z - 20) {
      b.position.z += 120;
    }
  }
}

function hitPlayer(pos) {
  lives--;
  playHitSound();
  spawnParticles(pos, 0xff4757, 12);
  invincibleTimer = 2;
  updateHUD();

  // Screen shake
  const shakeIntensity = 0.3;
  const origPos = camera.position.clone();
  let shakeTime = 0;
  const shakeInterval = setInterval(() => {
    shakeTime += 16;
    if (shakeTime > 300) {
      clearInterval(shakeInterval);
      return;
    }
    camera.position.x = origPos.x + (Math.random() - 0.5) * shakeIntensity * (1 - shakeTime / 300);
    camera.position.y = origPos.y + (Math.random() - 0.5) * shakeIntensity * (1 - shakeTime / 300);
  }, 16);

  if (lives <= 0) {
    gameOver();
  }
}

function gameOver() {
  isPlaying = false;
  stopMusic();
  playGameOverSound();
  save.coins += coins;
  saveToDisk();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('fly-btn').classList.add('hidden');
  document.getElementById('fly-bar').classList.add('hidden');
  document.getElementById('earned-coins').textContent = coins;

  // Submit score to API
  if (save.playerName && coins > 0) {
    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: save.playerName, score: coins })
    }).then(() => loadHighscores('highscore-list')).catch(() => {});
  } else {
    loadHighscores('highscore-list');
  }

  document.getElementById('gameover-screen').classList.remove('hidden');
}

// === CONTROLS ===
let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
});

document.addEventListener('touchend', (e) => {
  if (!isPlaying) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const dt = Date.now() - touchStartTime;
  if (dt > 300) return; // too slow, not a swipe

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
    if (dx > 0 && playerLane > 0) playerLane--;
    else if (dx < 0 && playerLane < 2) playerLane++;
  } else if (dy < -30 && !isJumping && !isFlying) {
    isJumping = true;
    jumpVelocity = 0.28;
    playJumpSound();
  }
});

// Keyboard fallback
document.addEventListener('keydown', (e) => {
  if (!isPlaying) return;
  if (e.key === 'ArrowLeft' && playerLane < 2) playerLane++;
  else if (e.key === 'ArrowRight' && playerLane > 0) playerLane--;
  else if ((e.key === 'ArrowUp' || e.key === ' ') && !isJumping && !isFlying) {
    isJumping = true;
    jumpVelocity = 0.28;
    playJumpSound();
  } else if (e.key === 'f') activateFly();
});

// Fly button
document.getElementById('fly-btn').addEventListener('touchstart', (e) => {
  e.stopPropagation();
  e.preventDefault();
  activateFly();
});
document.getElementById('fly-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  activateFly();
});

function activateFly() {
  if (!save.ownedFlyMachine || isFlying || flyUsedThisRun) return;
  isFlying = true;
  flyUsedThisRun = true;
  flyTimer = flyDuration;
  isJumping = false;
  jumpVelocity = 0;
  document.getElementById('fly-bar').classList.remove('hidden');
  document.getElementById('fly-btn').classList.add('hidden');
}

// === HUD ===
function updateHUD() {
  document.getElementById('coin-count').textContent = coins;
  const livesEl = document.getElementById('lives');
  livesEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart' + (i >= lives ? ' lost' : '');
    livesEl.appendChild(heart);
  }
}

// === UI SCREENS ===
function updateWallet() {
  document.querySelectorAll('.total-coins').forEach(el => el.textContent = save.coins);
}

function showStart() {
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('shop-screen').classList.add('hidden');
  document.getElementById('highscore-screen').classList.add('hidden');
  updateWallet();
}

function showShop() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('shop-screen').classList.remove('hidden');
  renderShop();
  updateWallet();
}

function renderShop() {
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';

  // Dimensions
  DIMENSIONS.forEach(dim => {
    const owned = save.ownedDimensions.includes(dim.id);
    const active = save.activeDimension === dim.id;
    const item = document.createElement('div');
    item.className = 'shop-item' + (owned ? ' owned' : '');
    item.innerHTML = `<div class="name">${dim.name}</div>` +
      (owned ? `<div class="status">${active ? '✓ ACTIEF' : 'Selecteer'}</div>` : `<div class="price">🪙 ${dim.price}</div>`);
    item.onclick = () => {
      if (owned) { save.activeDimension = dim.id; saveToDisk(); renderShop(); }
      else if (save.coins >= dim.price) { save.coins -= dim.price; save.ownedDimensions.push(dim.id); save.activeDimension = dim.id; saveToDisk(); renderShop(); updateWallet(); }
    };
    grid.appendChild(item);
  });

  // Characters
  CHARACTERS.forEach(ch => {
    const owned = save.ownedCharacters.includes(ch.id);
    const active = save.activeCharacter === ch.id;
    const item = document.createElement('div');
    item.className = 'shop-item' + (owned ? ' owned' : '');
    item.innerHTML = `<div class="name">${ch.name}</div>` +
      (owned ? `<div class="status">${active ? '✓ ACTIEF' : 'Selecteer'}</div>` : `<div class="price">🪙 ${ch.price}</div>`);
    item.onclick = () => {
      if (owned) { save.activeCharacter = ch.id; saveToDisk(); renderShop(); }
      else if (save.coins >= ch.price) { save.coins -= ch.price; save.ownedCharacters.push(ch.id); save.activeCharacter = ch.id; saveToDisk(); renderShop(); updateWallet(); }
    };
    grid.appendChild(item);
  });

  // Fly machine
  const flyItem = document.createElement('div');
  flyItem.className = 'shop-item' + (save.ownedFlyMachine ? ' owned' : '');
  flyItem.innerHTML = `<div class="name">Vliegmachine</div><div class="status">${save.ownedFlyMachine ? '✓ GEKOCHT' : '🪙 ' + FLY_MACHINE_PRICE}</div>`;
  flyItem.onclick = () => {
    if (!save.ownedFlyMachine && save.coins >= FLY_MACHINE_PRICE) {
      save.coins -= FLY_MACHINE_PRICE; save.ownedFlyMachine = true; saveToDisk(); renderShop(); updateWallet();
    }
  };
  grid.appendChild(flyItem);

  // Slow down
  const slowItem = document.createElement('div');
  slowItem.className = 'shop-item';
  slowItem.innerHTML = `<div class="name">Slow Down</div><div class="price">🪙 ${SLOW_DOWN_PRICE}</div><div class="status">Voorraad: ${save.ownedSlowDown}</div>`;
  slowItem.onclick = () => {
    if (save.coins >= SLOW_DOWN_PRICE) {
      save.coins -= SLOW_DOWN_PRICE; save.ownedSlowDown++; saveToDisk(); renderShop(); updateWallet();
    }
  };
  grid.appendChild(slowItem);
}

// === START GAME ===
function startGame() {
  // Clear existing scene objects (keep renderer/camera)
  if (scene) {
    // Remove all objects from scene
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
  }
  obstacles = []; coinObjects = []; buildings = []; groundTiles = []; particles = [];

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('shop-screen').classList.add('hidden');
  document.getElementById('hud').style.display = 'flex';

  if (save.ownedFlyMachine) {
    document.getElementById('fly-btn').classList.remove('hidden');
    document.getElementById('fly-btn').style.display = 'flex';
  }

  // Reset state
  lives = 3; coins = 0; distance = 0;
  speed = baseSpeed; playerLane = 1; targetX = 0;
  isJumping = false; isFlying = false; flyTimer = 0; flyUsedThisRun = false;
  invincibleTimer = 0; spawnTimer = 0; coinSpawnTimer = 0;
  slowActive = false;

  // Use slow down if owned
  if (save.ownedSlowDown > 0) {
    slowActive = true;
    speed = baseSpeed * 0.6;
    save.ownedSlowDown--;
    saveToDisk();
    setTimeout(() => { slowActive = false; }, 8000);
  }

  // Set dimension colors
  const dim = DIMENSIONS.find(d => d.id === save.activeDimension);
  scene.background = new THREE.Color(dim.colors.sky);
  scene.fog = new THREE.Fog(dim.colors.sky, 30, 80);

  // Re-add lighting
  sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  sunLight.position.set(5, 15, -5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 60;
  sunLight.shadow.camera.left = -15;
  sunLight.shadow.camera.right = 15;
  sunLight.shadow.camera.top = 30;
  sunLight.shadow.camera.bottom = -10;
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x404060, 0.6));
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3));

  // Reset camera and build world
  camera.position.set(0, 3.5, -8);
  camera.lookAt(0, 1, 10);

  createWorld();
  createPlayer();

  clock.getDelta(); // reset delta
  isPlaying = true;
  updateHUD();
  initAudio();
  startMusic();
}

// === RENDER LOOP ===
function animate() {
  requestAnimationFrame(animate);
  update();
  if (renderer) renderer.render(scene, camera);
}

// === RESIZE ===
window.addEventListener('resize', () => {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === INIT ===
updateWallet();

// Check if player has a name, show name screen if not
if (!save.playerName) {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('name-screen').classList.remove('hidden');
} else {
  initScene();
}

animate();

// === NAME SCREEN ===
function submitName() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) return;
  save.playerName = name;
  saveToDisk();
  document.getElementById('name-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  if (!renderer) initScene();
}

// === HIGHSCORES ===
async function loadHighscores(targetId) {
  try {
    const res = await fetch('/api/scores');
    const scores = await res.json();
    const el = document.getElementById(targetId);
    if (!el) return;
    el.innerHTML = scores.map((s, i) =>
      `<div class="highscore-entry${i === 0 ? ' first' : ''}"><span class="rank">${i + 1}.</span><span class="hs-name">${s.name}</span><span class="hs-score">🪙 ${s.score}</span></div>`
    ).join('') || '<div style="color:#aaa;text-align:center;padding:20px">Nog geen scores</div>';
  } catch (e) {
    const el = document.getElementById(targetId);
    if (el) el.innerHTML = '<div style="color:#aaa;text-align:center;padding:20px">Kan scores niet laden</div>';
  }
}

function showHighscores() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('highscore-screen').classList.remove('hidden');
  loadHighscores('highscore-board');
}

// Make functions available to HTML onclick
window.startGame = startGame;
window.showShop = showShop;
window.showStart = showStart;
window.submitName = submitName;
window.showHighscores = showHighscores;
