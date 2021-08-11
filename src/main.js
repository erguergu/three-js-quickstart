
//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';
import { MMOrbitControls } from './MMOrbitControls.js';
import * as THREE from './three.module.js';

// Player states
const PSTATE = { IDLE: "Idle", WALKFORWARD: "WalkForward", RUNFORWARD: "RunForward", WALKBACKWARD: 'WalkBackward', RUNBACKWARD: 'RunBackward', JUMP: 'Jump' };

// Ammo JS states
const ASTATE = { DISABLE_DEACTIVATION: 4 }

class OrbitTests {

  constructor() {
    this._Initialize();
  }

  _Initialize() {

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

    // create objects
    this._ground = this.createPlane("ground", 0x00FF00);
    this._player = this.createCone(0xFF0000, new THREE.Vector3(0, 1, 0), true);
    this._playerState = PSTATE.IDLE;

    // controls
    const controls = new MMOrbitControls(this._camera, this._player.obj3d, this._mvPlr, this._walkForward, this._walkBackward, this._runForward, this._runBackward, this._stopMoving, this._jump, this._groundCheck, this._collisionCheck, renderer.domElement);

    // create our lights
    const light = new THREE.AmbientLight(0xFFFFFF, .4);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);


    // set initial position and rotation of our objects and lights
    this._camera.position.z = -3;
    this._camera.position.y = 1;
    this._camera.position.x = -0;
    this._camera.lookAt(this._player.obj3d.position);

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

  _movePlayerCallback = (moveDelta) => {
    // this._player.obj3d.position.add(moveDelta);
    // return moveDelta;

    // int numManifolds = world->getDispatcher()->getNumManifolds();
    // printf("numManifolds = %d\n",numManifolds);

    const numMan = this._physicsWorld.getDispatcher().getNumManifolds();
    if (numMan == 0) {
      return;
    }

    console.log(`_movePlayerCallback: Touching the ground, will apply impulse.`);
    console.log(`Movement vector:`, moveDelta);
    const scalingFactor = 60;
    const resultantImpulse = new Ammo.btVector3(moveDelta.x, moveDelta.y, moveDelta.z)
    resultantImpulse.op_mul(scalingFactor);

    const body = this._player.physicsBody;
    body.setLinearVelocity(resultantImpulse);

  }

  _walkForward = () => {
    if (this._playerState != PSTATE.WALKFORWARD) {
      this._playerState = PSTATE.WALKFORWARD;
      this._player.obj3d.children[0].material.color.setHex(0x00AA00);
    }
  }

  _walkBackward = () => {
    if (this._playerState != PSTATE.WALKBACKWARD) {
      this._playerState = PSTATE.WALKBACKWARD;
      this._player.obj3d.children[0].material.color.setHex(0x666666);
    }
  }

  _runForward = () => {
    if (this._playerState != PSTATE.RUNFORWARD) {
      this._playerState = PSTATE.RUNFORWARD;
      this._player.obj3d.children[0].material.color.setHex(0x00FF00);
    }
  }

  _runBackward = () => {
    if (this._playerState != PSTATE.RUNBACKWARD) {
      this._playerState = PSTATE.RUNBACKWARD;
      this._player.obj3d.children[0].material.color.setHex(0xDDDDDD);
    }
  }

  _stopMoving = () => {
    if (this._playerState != PSTATE.IDLE) {
      this._playerState = PSTATE.IDLE;
      this._player.obj3d.children[0].material.color.setHex(0xFF0000);
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

  createCone = (color, position, isPlayer) => {

    const radius = .1;
    const mass = 1;

    // Create the three js object
    const obj3d = new THREE.Object3D();
    const geometry = new THREE.ConeGeometry(radius, .5, 32);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const cone = new THREE.Mesh(geometry, material);
    cone.position.y += .125;
    cone.rotation.x += Math.PI / 2;
    obj3d.add(cone);
    this._scene.add(obj3d);
    obj3d.position.copy(position);

    // Create the ammo js object
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
    transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
    const motionState = new Ammo.btDefaultMotionState(transform);
    let colShape = new Ammo.btSphereShape(radius);
    colShape.setMargin(0.05);
    let localInertia = new Ammo.btVector3(0, 0, 0);
    colShape.calculateLocalInertia(mass, localInertia);
    let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, colShape, localInertia);
    let body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(.4);
    body.setRollingFriction(.10);
    body.setActivationState(ASTATE.DISABLE_DEACTIVATION);
    // body.setAngularFactor( 1, 0, 1 );
    // body.setLinearFactor( 0, 1, 0 );
    this._physicsWorld.addRigidBody(body);

    const retVal = { obj3d: obj3d, physicsBody: body, isPlayer: isPlayer };
    this._rigidBodies.push(retVal);

    return retVal;
  }

  createPlane = (name, color) => {

    const mass = 0;
    let scale = { x: 100, y: .2, z: 100 };

    const geometry = new THREE.PlaneGeometry(scale.x, scale.z, 100, 100);
    const wireframe = new THREE.WireframeGeometry(geometry);
    const line = new THREE.LineSegments(wireframe);

    const material = new THREE.LineBasicMaterial({
      color: color,
      opacity: 0.25,
      transparent: true
    });
    line.material = material;
    line.name = name;
    const xAxis = new THREE.Vector3(1, 0, 0);
    line.rotateOnAxis(xAxis, 0.5 * Math.PI);

    this._scene.add(line);

    
    // Create the ammo js object
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(0, 0, 0));
    transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
    const motionState = new Ammo.btDefaultMotionState(transform);
    
    let colShape = new Ammo.btBoxShape(new Ammo.btVector3(scale.x/2, scale.y, scale.z/2));
    colShape.setMargin(0.05);
    let localInertia = new Ammo.btVector3(0, 0, 0);
    colShape.calculateLocalInertia(mass, localInertia);
    let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, colShape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(1);
    body.setRollingFriction(2);
    body.setActivationState(ASTATE.DISABLE_DEACTIVATION);
    body.setAngularFactor( 0, 0, 0 );
    this._physicsWorld.addRigidBody(body);

    const retVal = { obj3d: line, physicsBody: body, isPlayer: false };
    this._rigidBodies.push(retVal);

    
    console.log(body);
    console.log(body.getFriction());
    return retVal;
  }

  resetCone = () => {
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(0, 0, 0));
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
    this._physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));

  }

  updatePhysics = (deltaTime) => {

    if (!this._enablePhysics) {
      return;
    }

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
      let myMotionState = objAmmo.getMotionState();

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
          //console.log(`Player y: ${y}`);
          if (y < -5) {
            this.resetCone();
          }
          const moveDelta = obj3d.position.clone();
          moveDelta.sub(oldObj3dPos);
          this._camera.position.add(moveDelta);
        }
        
      }
    }

  }

}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  Ammo().then(() => {
    _APP = new OrbitTests();
  })
});

