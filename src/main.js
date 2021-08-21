
//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';
import { MMOrbitControls } from './MMOrbitControls.js';
import { HeightMapGenerator } from './HeightMap.js';
import { ArrayResizer } from './ArrayResizer.js';
import * as THREE from './three.module.js';

// Player states
const PSTATE = { IDLE: "Idle", WALKFORWARD: "WalkForward", RUNFORWARD: "RunForward", WALKBACKWARD: 'WalkBackward', RUNBACKWARD: 'RunBackward', JUMP: 'Jump' };

// Ammo JS states
const ASTATE = { DISABLE_DEACTIVATION: 4 }

const WorldParams = {
  MaxFall: -10,
  PlayerStart: {x: 10, y: 20, z: 10},
  PlayerFallReset: -80,
  TerrainHeight: 50,
  Gravity: -9,
  GroundScale: [1000,1000],
  ScaleSegRatio: 1, // number of segments per ground scale (if it's .6, 1000 scale will have 600 segments)
  HeightMapFile: './src/heightSimplex1920.png'
};

const PlayerParams = {
  FootHeightThreshold: -0.58, // negative, the closer to zero the more you can wall walk
  MaxWalk: 2.5,
  MaxRun: 4.5,
  JumpPower: 20,
  Friction: .4,
  RollingFriction: .1,
  CapsuleRadius: .3,
  Mass: 1,
};

class OrbitTests {

  constructor() {
    // this didn't need to go here...
    new THREE.ImageBitmapLoader().load(WorldParams.HeightMapFile, (texture) => {
      this._Initialize({ groundHeightMapTexture: texture });
    });
  }

  _Initialize(textures) {

    // need a scene
    this._scene = new THREE.Scene();

    // clock for physics
    this._clock = new THREE.Clock();

    // physics
    this._enablePhysics = true;
    this._mvPlr = this._movePlayerCallback;

    this._physicsWorld = null;
    this._rigidBodies = [];
    this._tmpTrans = new Ammo.btTransform();

    this.setupPhysicsWorld();
    this._cbContactPairResult = null; // for collision detection
    this.setupFeetOnGroundResultCallback();

    // camera aspect ratio starts out matching viewport aspect ratio
    this._camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    //const camera = new THREE.OrthographicCamera(window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 1, 1000);

    // antialias gets rid of the jaggies
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    this._canv = document.getElementById('maindiv');

    // black background
    renderer.setClearColor("#000000");

    // fill the whole viewport with the 3d scene
    renderer.setSize(window.innerWidth, window.innerHeight);

    // need to add this to the DOM
    document.getElementById('maindiv').appendChild(renderer.domElement);

    // listen for window resize events
    window.addEventListener('resize', () => {

      // make sure scene always matches viewport size and aspect ratio
      renderer.setSize(window.innerWidth, window.innerHeight);
      this._camera.aspect = window.innerWidth / window.innerHeight;

      // make sure aspect ratio changes do not warp object shapes
      this._camera.updateProjectionMatrix();
    });

    //environment cube texture
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    this._cubeTexture = cubeTextureLoader.load([
      './src/stars1920.png',
      './src/stars1920.png',
      './src/stars1920.png',
      './src/stars1920.png',
      './src/stars1920.png',
      './src/stars1920.png'
    ]);
    this._scene.background = this._cubeTexture;

    const flatArray = new Array(100 * 100);
    const widthSegments = Math.ceil(WorldParams.GroundScale[0] * WorldParams.ScaleSegRatio);
    const heightSegments = Math.ceil(WorldParams.GroundScale[1] * WorldParams.ScaleSegRatio);
    const groundHeightMapTexture = textures.groundHeightMapTexture;
    this.loadTexture(groundHeightMapTexture, widthSegments, heightSegments, flatArray);

    const terrainHeight = WorldParams.TerrainHeight;
    this._groundPlane = this.createPlane("ground", 0xDD55FF, WorldParams.GroundScale, [0, 0, 0], [0, 0, 0], widthSegments, heightSegments, terrainHeight, flatArray);

    this._playerResetHeight = WorldParams.PlayerFallReset;
    this._player = this.createPlayer(new THREE.Vector3(WorldParams.PlayerStart.x, WorldParams.PlayerStart.y, WorldParams.PlayerStart.z));
    this._playerState = PSTATE.IDLE;

    // controls
    const controls = new MMOrbitControls(this._camera, this._player.obj3d, this._mvPlr, this._walkForward, this._walkBackward, this._runForward, this._runBackward, this._stopMoving, this._jump, this._groundCheck, this._collisionCheck, renderer.domElement);

    // create our lights
    const light = new THREE.AmbientLight(0xFFFFFF, .4);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);


    // set initial position and rotation of our objects and lights
    this._camera.position.z = WorldParams.PlayerStart.z - 3;
    this._camera.position.y = WorldParams.PlayerStart.y + 2;
    this._camera.position.x = WorldParams.PlayerStart.x - 0;
    this._camera.lookAt(WorldParams.PlayerStart);

    light.position.set(10, 0, 25);

    directionalLight.position.x = 4;
    directionalLight.position.y = 4;

    // add objects and lights to the scene
    this._scene.add(directionalLight);
    this._scene.add(light);

    var render = () => {
      let deltaTime = this._clock.getDelta();
      requestAnimationFrame(render);
      controls.update(deltaTime);
      this.updatePhysics(deltaTime);
      renderer.render(this._scene, this._camera);
    };
    render();
  }

  loadTexture = (texture, desiredWidth, desiredHeight, flatArray) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.display = 'none';
    canvas.height = texture.height;
    canvas.width = texture.width;
    const initial2d = new Array(texture.width);
    try {
      ctx.drawImage(texture, 0, 0);

      // okay so loop through the returned image
      // but need to put that in a separate 2d array I think...
      // then convert that 2d array into the desired size (need params)
      // then convert that resized 2d array into a flat array...
      for (let y = 0; y < texture.height; y++) {
        const row = new Array(texture.height);
        initial2d[y] = row;
        for (let x = 0; x < texture.width; x++) {
          const thing = ctx.getImageData(x, y, 1, 1);
          const avgColor = (thing.data[0] + thing.data[1] + thing.data[2]) / 3;

          // okay so we can take the average of these levels
          row[x] = avgColor;
        }
      }

      // now initial2d should be the average colors of all the pixels
      // resize it:
      const arrRes = new ArrayResizer();
      const desired2d = arrRes.resizeMatrix(initial2d, desiredWidth, desiredHeight);
      let flatIndex = 0;
      for (let y = 0; y < desired2d.length; y++) {
        const row = desired2d[y];
        for (let x = 0; x < row.length; x++) {
          flatArray[flatIndex++] = row[x];
        }
      }
    } catch (ex) {
      console.log(`bad`, ex);
    }
  }

  _movePlayerCallback = (moveDelta) => {

    if (!this._isTouchingGround()) {
      return;
    }

    // get player's physics object
    const body = this._player.physicsBody;

    // here we apply ONLY a force vector. then in the tick we have to clamp linear velocity manually
    const totalScalingFactor = 2;
    const xzScalingFactor = 2.5;
    const yScalingFactor = PlayerParams.JumpPower;

    const calcImpulse = {
      x: moveDelta.y === 0 ? (moveDelta.x * xzScalingFactor) : 0,
      y: moveDelta.y * yScalingFactor,
      z: moveDelta.y === 0 ? (moveDelta.z * xzScalingFactor) : 0

    };

    //const resultantImpulse = new Ammo.btVector3(moveDelta.x * xyScalingFactor, moveDelta.y * 20, moveDelta.z * xyScalingFactor)
    const resultantImpulse = new Ammo.btVector3(calcImpulse.x, calcImpulse.y, calcImpulse.z);
    resultantImpulse.op_mul(totalScalingFactor);

    body.applyCentralImpulse(resultantImpulse);

  }

  _isTouchingGround = () => {

    // Okay I think I know how to fix all of this. I can do one of two things:
    // 1. figure out if the bottom of the player is touching something, not sure how to do that.
    // 2. maybe a hack, but could also have two ammo objects, one that represents the player
    //    and is a standard rigid body, and the other is a massless collision trigger at the
    //    bottom of the player, like the "feet", which signals whether or not an impulse should
    //    be applied. In order to accomplish this I need to get that guy's contact pair stuff
    //    so that I know what two objects are touching at any time, and I also need to figure
    //    out how to add a massless object and lock it to where the player's feet should be.
    //    Hopefully that object can be massless and also trigger the contact pair callback...
    //    Oh I just realized mass only affects if the object will move. I think I need to do 
    //    something more if I want the object to serve only as a trigger and not impact other
    //    rigid bodies...

    return this._betterDetectCollision();

  }

  _betterDetectCollision() {
    this._cbContactPairResult.hasContact = false;
    this._physicsWorld.contactPairTest(this._player.physicsBody, this._groundPlane.physicsBody, this._cbContactPairResult);
    const feetOnGround = this._cbContactPairResult.hasContact;
    const feetLocation = this.getPhysObjCoords(this._player.physicsBody);
    //console.log(`we ${feetOnGround ? 'are' : 'are not'} touching the ground... right?`, feetLocation);
    return feetOnGround;
  }

  _detectCollision() {

    const dispatcher = this._physicsWorld.getDispatcher();
    const numManifolds = dispatcher.getNumManifolds();
    let totalContacts = 0;

    for (let i = 0; i < numManifolds; i++) {

      const contactManifold = dispatcher.getManifoldByIndexInternal(i);
      const numContacts = contactManifold.getNumContacts();
      totalContacts += numContacts;

      for (let j = 0; j < numContacts; j++) {

        let contactPoint = contactManifold.getContactPoint(j);
        let distance = contactPoint.getDistance();

        //console.log({manifoldIndex: i, contactIndex: j, distance: distance});

      }
    }
    return totalContacts > 0;
  }

  _walkForward = () => {
    if (this._playerState != PSTATE.WALKFORWARD) {
      this._playerState = PSTATE.WALKFORWARD;
      const color = 0x00AA00;
      this._player.obj3d.children[0].material.color.setHex(color);
      this._player.obj3d.children[0].material.emissive.setHex(color * .5);
      this._player.obj3d.children[0].material.specular.setHex(color * .5);
    }
  }

  _walkBackward = () => {
    if (this._playerState != PSTATE.WALKBACKWARD) {
      this._playerState = PSTATE.WALKBACKWARD;
      const color = 0x666666;
      this._player.obj3d.children[0].material.color.setHex(color);
      this._player.obj3d.children[0].material.emissive.setHex(color * .5);
      this._player.obj3d.children[0].material.specular.setHex(color * .5);
    }
  }

  _runForward = () => {
    if (this._playerState != PSTATE.RUNFORWARD) {
      this._playerState = PSTATE.RUNFORWARD;
      const color = 0x00FF00;
      this._player.obj3d.children[0].material.color.setHex(color);
      this._player.obj3d.children[0].material.emissive.setHex(color * .5);
      this._player.obj3d.children[0].material.specular.setHex(color * .5);
    }
  }

  _runBackward = () => {
    if (this._playerState != PSTATE.RUNBACKWARD) {
      this._playerState = PSTATE.RUNBACKWARD;
      const color = 0xDDDDDD;
      this._player.obj3d.children[0].material.color.setHex(color);
      this._player.obj3d.children[0].material.emissive.setHex(color * .5);
      this._player.obj3d.children[0].material.specular.setHex(color * .5);
    }
  }

  _stopMoving = () => {
    if (this._playerState != PSTATE.IDLE) {
      this._playerState = PSTATE.IDLE;
      const color = 0xFF0000;
      this._player.obj3d.children[0].material.color.setHex(color);
      this._player.obj3d.children[0].material.emissive.setHex(color * .5);
      this._player.obj3d.children[0].material.specular.setHex(color * .5);
    }
  }

  _jump = () => {
    if (this._playerState != PSTATE.JUMP) {
      this._playerState = PSTATE.JUMP;
    }
  }

  _groundCheck = () => {
    return true;
  }

  _collisionCheck = () => {
    return false;
  }

  createPlayer = (position) => {

    const mass = PlayerParams.Mass;

    // Create the three js object
    const obj3d = new THREE.Object3D();
    const material = new THREE.MeshPhongMaterial({
      transparent: false,
      opacity: 1,
      color: 0xFF0000,
      emissive: 0xFF0000 * .5,
      specular: 0xFF0000 * .5,
      shininess: 67,
      flatShading: true,
      envMap: this._cubeTexture,
      reflectivity: .4
    });

    const capsuleHeight = .75;

    // create our "capsule"
    const geometry = new THREE.CylinderGeometry(PlayerParams.CapsuleRadius, PlayerParams.CapsuleRadius, capsuleHeight);
    const cylinder = new THREE.Mesh(geometry, material);
    cylinder.position.y -= .125;
    obj3d.add(cylinder);

    const cylinderBottomGeo = new THREE.SphereGeometry(PlayerParams.CapsuleRadius, 10, 10);
    const cylinderBottom = new THREE.Mesh(cylinderBottomGeo, material);
    cylinderBottom.position.y -= .4125;
    obj3d.add(cylinderBottom);

    this._scene.add(obj3d);
    obj3d.position.copy(position);

    // Create the ammo js object
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
    transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
    const motionState = new Ammo.btDefaultMotionState(transform);
    let colShape = null;

    colShape = new Ammo.btCapsuleShape(PlayerParams.CapsuleRadius, capsuleHeight);

    colShape.setMargin(0.05);
    let localInertia = new Ammo.btVector3(0, 0, 0);
    colShape.calculateLocalInertia(mass, localInertia);
    let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, colShape, localInertia);
    let body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(PlayerParams.Friction); //.4
    body.setRollingFriction(PlayerParams.RollingFriction); // .1
    body.setActivationState(ASTATE.DISABLE_DEACTIVATION);
    body.setAngularFactor(0, 0, 0);
    this._physicsWorld.addRigidBody(body);

    const maxWalk = PlayerParams.MaxWalk;
    const maxRun = PlayerParams.MaxRun;

    const retVal = {
      obj3d: obj3d,
      physicsBody: body,
      isPlayer: true,
      maxWalk: maxWalk,
      maxRun: maxRun
    };
    this._rigidBodies.push(retVal);

    return retVal;
  }

  createPlane = (name, color, scale, position, rotation, widthSegments, heightSegments, terrainMaxHeight, heightMapArr) => {

    const mass = 0;

    const [xScale, yScale, zScale] = [scale[0], .2, scale[1]];
    const [xPos, yPos, zPos] = position;
    const [xRot, yRot, zRot] = rotation;

    const obj3d = new THREE.Object3D();
    const segmentMult = 4;
    const xSegments = widthSegments;
    const zSegments = heightSegments;
    const geometry = new THREE.PlaneGeometry(xScale, zScale, xSegments - 1, zSegments - 1);
    geometry.rotateX(- Math.PI / 2);

    const hmap = new HeightMapGenerator();
    let hmapData = [];
    const terrainMinHeight = 0; // has to be zero right now or my physics will derp i think...

    hmapData = hmap.generateTextureHeightData(widthSegments, heightSegments, terrainMinHeight, terrainMaxHeight, heightMapArr);

    hmap.applyHeightToPlane(geometry, hmapData);

    const doWireframe = true;
    const doMesh = true;
    const mesh = new THREE.Object3D();

    if (doWireframe) {
      const wireframe = new THREE.WireframeGeometry(geometry);
      const lineMat = new THREE.LineBasicMaterial({ color: color, opacity: 0.5, transparent: true });
      mesh.add(new THREE.LineSegments(wireframe, lineMat));
    }
    if (doMesh) {
      const meshMaterial = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: .9,


        color: 0x7f00ff,
        emissive: 0xff,
        specular: 0x191900,
        shininess: 67,
        flatShading: true,

        envMap: this._cubeTexture,
        reflectivity: .6,

        side: THREE.DoubleSide
      });
      mesh.add(new THREE.Mesh(geometry, meshMaterial));
    }

    mesh.position.y = 0 - ((terrainMaxHeight - terrainMinHeight) / 2);

    mesh.name = name;
    const xAxis = new THREE.Vector3(1, 0, 0);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3(0, 0, 1);

    mesh.position.z = yScale / 2;
    obj3d.add(mesh);

    obj3d.position.set(xPos, yPos, zPos);
    console.log(`${name} position`, obj3d.position);

    obj3d.rotateOnAxis(xAxis, xRot);
    obj3d.rotateOnAxis(yAxis, yRot);
    obj3d.rotateOnAxis(zAxis, zRot);

    const obj3dQuat = obj3d.quaternion;

    this._scene.add(obj3d);


    // Create the ammo js object
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    console.log(`Setting ${name} phys origin to ${xPos},${yPos},${zPos}`);
    transform.setRotation(new Ammo.btQuaternion(obj3dQuat.x, obj3dQuat.y, obj3dQuat.z, obj3dQuat.w));
    transform.setOrigin(new Ammo.btVector3(xPos, yPos, zPos));
    const motionState = new Ammo.btDefaultMotionState(transform);

    let colShape = hmap.createTerrainShape(hmapData, xSegments, zSegments, terrainMinHeight, terrainMaxHeight, xScale, zScale);
    colShape.setMargin(0.05);

    let localInertia = new Ammo.btVector3(0, 0, 0);
    colShape.calculateLocalInertia(mass, localInertia);
    let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, colShape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(1); // was 1
    body.setRollingFriction(1); // was 1
    body.setActivationState(ASTATE.DISABLE_DEACTIVATION);
    body.setAngularFactor(0, 0, 0);
    this._physicsWorld.addRigidBody(body);

    const retVal = { obj3d: obj3d, physicsBody: body, isPlayer: false, planeGeo: geometry };
    this._rigidBodies.push(retVal);


    return retVal;
  }

  resetCone = () => {
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(WorldParams.PlayerStart.x, WorldParams.PlayerStart.y, WorldParams.PlayerStart.z));
    transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
    const motionState = new Ammo.btDefaultMotionState(transform);
    this._player.physicsBody.setMotionState(motionState);
  }

  setupPhysicsWorld = () => {
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(),
      dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration),
      overlappingPairCache = new Ammo.btDbvtBroadphase(),
      solver = new Ammo.btSequentialImpulseConstraintSolver();

    this._physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
    this._physicsWorld.setGravity(new Ammo.btVector3(0, WorldParams.Gravity, 0));
    console.log(`physicsWOrld`, this._physicsWorld);

  }

  getPhysObjCoords = (objAmmo) => {
    const transf = objAmmo.getWorldTransform();
    const ammoPosInWorldCoords = transf.getOrigin();
    const x = ammoPosInWorldCoords.x();
    const y = ammoPosInWorldCoords.y();
    const z = ammoPosInWorldCoords.z();
    const ret = { x: x, y: y, z: z };
    return ret;
  }

  limitSpeed = (ammoObj, maxXZ, maxY) => {
    const linVel = ammoObj.getLinearVelocity();
    const linXYZ = { x: linVel.x(), y: linVel.y(), z: linVel.z() };
    const speed = Math.abs(Math.sqrt(linXYZ.x * linXYZ.x + linXYZ.z * linXYZ.z));

    let newX = linXYZ.x;
    let newY = linXYZ.y;
    let newZ = linXYZ.z;

    if (linXYZ.y < maxY) {
      newY = maxY;
    }

    const speeding = speed > maxXZ;
    if (speeding) {
      const ratio = maxXZ / speed;
      newX = linXYZ.x * ratio;
      newZ = linXYZ.z * ratio;
    }
    ammoObj.setLinearVelocity(new Ammo.btVector3(newX, newY, newZ));
  }

  updatePhysics = (deltaTime) => {

    if (!this._enablePhysics) {
      return;
    }


    // Speed Limit
    const maxSpeed = (this._playerState == PSTATE.WALKBACKWARD || this._playerState == PSTATE.WALKFORWARD) ? this._player.maxWalk : this._player.maxRun;
    const maxFall = WorldParams.MaxFall;
    this.limitSpeed(this._player.physicsBody, maxSpeed, maxFall);


    // Step world
    this._physicsWorld.stepSimulation(deltaTime, 10);

    // Loop through all the rigid bodies and update them
    for (let i = 0; i < this._rigidBodies.length; i++) {

      // get the current object
      const obj = this._rigidBodies[i];

      // get its physics object
      const objAmmo = obj.physicsBody;

      // get the three js object
      const obj3d = obj.obj3d;

      // figure out location/rotation of the given physics object
      const myMotionState = objAmmo.getMotionState();

      if (myMotionState) {

        // convert the position from local to world coords
        myMotionState.getWorldTransform(this._tmpTrans);
        const ammoPosInWorldCoords = this._tmpTrans.getOrigin();
        const x = ammoPosInWorldCoords.x();
        const y = ammoPosInWorldCoords.y();
        const z = ammoPosInWorldCoords.z();

        const oldObj3dPos = obj3d.position.clone();

        // Set the three js object's position. (in world coords??)
        obj3d.position.set(x, y, z);

        if (obj.isPlayer) {

          if (y < this._playerResetHeight) {
            this.resetCone();
          }
          const moveDelta = obj3d.position.clone();
          moveDelta.sub(oldObj3dPos);
          this._camera.position.add(moveDelta);
        }

      }
    }

  }

  setupFeetOnGroundResultCallback = () => {

    this._cbContactPairResult = new Ammo.ConcreteContactResultCallback();
    this._cbContactPairResult.hasContact = false;

    this._cbContactPairResult.addSingleResult = function (cp, colObj0Wrap, partId0, index0, colObj1Wrap, partId1, index1) {

      let contactPoint = Ammo.wrapPointer(cp, Ammo.btManifoldPoint);
      const distance = contactPoint.getDistance();
      const mlocal = contactPoint.get_m_localPointA();
      const xyz = {x: mlocal.x(), y: mlocal.y(), z: mlocal.z()};

      // okay so distance might not matter that much. i'll keep it in...
      if (distance > 0.01) return;

      const footContactDetected = xyz.y < PlayerParams.FootHeightThreshold;
      if (!footContactDetected) {
        console.log(`Player is touching the 'ground' but not with their feet. You can't move.`, xyz);
      }
      if (!footContactDetected) return; // need to return in case we are touching the ground and a wall

      this.hasContact = footContactDetected;
    }
  }

  setupContactResultCallback = () => {

    cbContactResult = new Ammo.ConcreteContactResultCallback();

    cbContactResult.addSingleResult = function (cp, colObj0Wrap, partId0, index0, colObj1Wrap, partId1, index1) {

      let contactPoint = Ammo.wrapPointer(cp, Ammo.btManifoldPoint);

      const distance = contactPoint.getDistance();

      if (distance > 0) return;

      let colWrapper0 = Ammo.wrapPointer(colObj0Wrap, Ammo.btCollisionObjectWrapper);
      let rb0 = Ammo.castObject(colWrapper0.getCollisionObject(), Ammo.btRigidBody);

      let colWrapper1 = Ammo.wrapPointer(colObj1Wrap, Ammo.btCollisionObjectWrapper);
      let rb1 = Ammo.castObject(colWrapper1.getCollisionObject(), Ammo.btRigidBody);

      let threeObject0 = rb0.threeObject;
      let threeObject1 = rb1.threeObject;

      let tag, localPos, worldPos

      if (threeObject0.userData.tag != "ball") {

        tag = threeObject0.userData.tag;
        localPos = contactPoint.get_m_localPointA();
        worldPos = contactPoint.get_m_positionWorldOnA();

      }
      else {

        tag = threeObject1.userData.tag;
        localPos = contactPoint.get_m_localPointB();
        worldPos = contactPoint.get_m_positionWorldOnB();

      }

      let localPosDisplay = { x: localPos.x(), y: localPos.y(), z: localPos.z() };
      let worldPosDisplay = { x: worldPos.x(), y: worldPos.y(), z: worldPos.z() };

      console.log({ tag, localPosDisplay, worldPosDisplay });

    }

  }

}



let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  Ammo().then(() => {
    _APP = new OrbitTests();
  })
});

