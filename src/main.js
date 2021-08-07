
//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';
import { MMOrbitControls } from './MMOrbitControls.js';
import * as THREE from './three.module.js';

const PSTATE = { IDLE: "Idle", WALKFORWARD: "WalkForward", RUNFORWARD: "RunForward", WALKBACKWARD: 'WalkBackward', RUNBACKWARD: 'RunBackward' };

class OrbitTests {

  constructor() {
    this._Initialize();
  }

  _Initialize() {

		this._rotateStart = new THREE.Vector2();
		this._rotateEnd = new THREE.Vector2();
		this._rotateDelta = new THREE.Vector2();

    this._offset = new THREE.Vector3();
    const upVector = new THREE.Vector3( 0, 1, 0 );
    this._quat = new THREE.Quaternion().setFromUnitVectors( upVector, new THREE.Vector3( 0, 1, 0 ) );
    console.log(`quat:`, this._quat);
    this._quatInverse = this._quat.clone().invert();

    this._lastPosition = new THREE.Vector3();
    this._lastQuaternion = new THREE.Quaternion();
    this._twoPI = 2 * Math.PI;

    this._scale = 1;
    this._minDistance = 1;
    this._maxDistance = 100;

    // init mouse input
    this._rotateSpeed = 1.0;
    this._mouseMovementX = 0;
    this._mouseMovementY = 0;
    this._mouseDownLeft = false;
    this._mouseDownRight = false;
    this._wheelDelta = 0;
    this._keys = {
      mouseforward: false,
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    };

    // need a scene
    this._scene = new THREE.Scene();

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
    //this._rotationController = new THREE.Object3D();
    //this._scene.add(this._rotationController);
    this._ground = this.createPlane("ground", 0x00FF00);
    //this._cone = this.createCone(0x0000FF, new THREE.Vector3(0, 0, -1));
    this._player = this.createCone(0xFF0000, new THREE.Vector3(0, 0, 0));
    this._playerState = PSTATE.IDLE;

    // controls
    const controls = new MMOrbitControls(this._camera, this._player, this._walkForward, this._walkBackward, this._runForward, this._runBackward, this._stopMoving, this._groundCheck, this._collisionCheck, renderer.domElement);

    // create our lights
    const light = new THREE.AmbientLight(0xFFFFFF, .4);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);


    // set initial position and rotation of our objects and lights
    this._camera.position.z = -3;
    this._camera.position.y = 1;
    this._camera.position.x = -0;
    this._camera.lookAt(this._player.position);

    light.position.set(10, 0, 25);

    directionalLight.position.x = 4;
    directionalLight.position.y = 4;

    // add objects and lights to the scene
    this._scene.add(directionalLight);
    this._scene.add(light);

    var render = () => {
      requestAnimationFrame(render);
      controls.update();
      renderer.render(this._scene, this._camera);
    };
    render();
  }

  _walkForward = () => {
    if (this._playerState != PSTATE.WALKFORWARD) {
      this._playerState = PSTATE.WALKFORWARD;
      this._player.children[0].material.color.setHex(0x00AA00);
    }
  }

  _walkBackward = () => {
    if (this._playerState != PSTATE.WALKBACKWARD) {
      this._playerState = PSTATE.WALKBACKWARD;
      this._player.children[0].material.color.setHex(0x666666);
    }
  }

  _runForward = () => {
    if (this._playerState != PSTATE.RUNFORWARD) {
      this._playerState = PSTATE.RUNFORWARD;
      this._player.children[0].material.color.setHex(0x00FF00);
    }
  }

  _runBackward = () => {
    if (this._playerState != PSTATE.RUNBACKWARD) {
      this._playerState = PSTATE.RUNBACKWARD;
      this._player.children[0].material.color.setHex(0xDDDDDD);
    }
  }

  _stopMoving = () => {
    if (this._playerState != PSTATE.IDLE) {
      this._playerState = PSTATE.IDLE;
      this._player.children[0].material.color.setHex(0xFF0000);
    }
  }

  _groundCheck = () => {
    return true;
  }

  _collisionCheck = () => {
    return false;
  }

  createCone = (color, position) => {
    const obj3d = new THREE.Object3D();
    const geometry = new THREE.ConeGeometry(.1, .5, 32);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const cone = new THREE.Mesh(geometry, material);
    cone.position.y += .125;
    cone.rotation.x += Math.PI / 2;
    obj3d.add(cone);
    this._scene.add(obj3d);
    obj3d.position.copy(position);

    console.log(`cone:`, cone);
    console.log(`obj3d:`, obj3d);
    return obj3d;
  }

  createPlane = (name, color) => {

    const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
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
    line.rotateOnAxis(xAxis, 0.5 * Math.PI)

    this._scene.add(line);

    console.log(line);

    return line;
  }

}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new OrbitTests();
});

