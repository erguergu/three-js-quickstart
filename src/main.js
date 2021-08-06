
//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';
import { MMOrbitControls } from './MMOrbitControls.js';
import * as THREE from './three.module.js';

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
    this._spherical = new THREE.Spherical();
    this._sphericalDelta = new THREE.Spherical();

    // need a scene
    this._scene = new THREE.Scene();

    // camera aspect ratio starts out matching viewport aspect ratio
    this._camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    //const camera = new THREE.OrthographicCamera(window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 1, 1000);

    // antialias gets rid of the jaggies
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    this._canv = document.getElementById('threejs');


    // black background
    renderer.setClearColor("#000000");

    // fill the whole viewport with the 3d scene
    renderer.setSize(window.innerWidth, window.innerHeight);

    // need to add this to the DOM
    document.body.appendChild(renderer.domElement);

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
    this._circle = this.createCircle("circle1", 0x00FF00);
    this._cone = this.createCone(0x0000FF, new THREE.Vector3(0, 0, -1));
    this._player = this.createCone(0xFF0000, new THREE.Vector3(0, 0, 0));

    // controls
    const controls = new MMOrbitControls(this._cone, this._player, this._moveForward, this._stopMoving, renderer.domElement);

    // create our lights
    const light = new THREE.AmbientLight(0xFFFFFF, .4);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);


    // set initial position and rotation of our objects and lights
    this._camera.position.z = -3;
    this._camera.position.y = 1;
    this._camera.position.x = -0;
    this._camera.lookAt(this._circle.position);

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

  _moveForward = () => {
    this._player.children[0].material.color.setHex(0x00FF00);
  }

  _stopMoving = () => {
    this._player.children[0].material.color.setHex(0xFF0000);
  }

  createCone = (color, position) => {
    const obj3d = new THREE.Object3D();
    const geometry = new THREE.ConeGeometry(.1, .5, 32);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const cone = new THREE.Mesh(geometry, material);
    cone.name = "cameraCone";
    cone.rotation.x += Math.PI / 2;
    obj3d.add(cone);
    this._scene.add(obj3d);
    obj3d.position.copy(position);

    console.log(`cone:`, cone);
    console.log(`obj3d:`, obj3d);
    return obj3d;
  }

  createCircle = (name, color) => {

    const geometry = new THREE.SphereGeometry(this._spherical.radius, 10, 10);
    const wireframe = new THREE.WireframeGeometry(geometry);
    const line = new THREE.LineSegments(wireframe);

    const material = new THREE.LineBasicMaterial({
        color: color,        
        opacity: 0.25,
        transparent: true
    });
    line.material = material;
    line.name = name;

    this._scene.add(line);

    console.log(line);

    return line;
  }

}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new OrbitTests();
});

