
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
    this._useMyRotation = false;
    if (!this._useMyRotation) {
      const controls = new MMOrbitControls(this._cone, this._player, this._moveForward, this._stopMoving, renderer.domElement);
    } else {
      this._canv.addEventListener('mouseup', (e) => this._onMouseUp(e), false);
      this._canv.addEventListener('mousedown', (e) => this._onMouseDown(e), false);
      this._canv.addEventListener('mousemove', (e) => this._onMouseMove(e), false);
      this._canv.addEventListener('contextmenu', event => event.preventDefault());
      this._canv.addEventListener('wheel', (e) => this._onMouseWheel(e), false);      
    }

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
      renderer.render(this._scene, this._camera);
    };
    render();
  }

  _moveForward = () => {
    //console.log(`okay change the color:`, this._player.children[0].material);
    this._player.children[0].material.color.setHex(0x00FF00);
  }

  _stopMoving = () => {
    //this._player.children[0].material.color = 0xFF0000;
    this._player.children[0].material.color.setHex(0xFF0000);
  }

  createCone = (color, position) => {
    const obj3d = new THREE.Object3D();
    const geometry = new THREE.ConeGeometry(.1, .5, 32);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const cone = new THREE.Mesh(geometry, material);
    cone.name = "cameraCone";
    //cone.up.set(0, 1, 0);
    //cone.lookAt(0, 0, 0);
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

  _applyRotation = () => {

    // okay this sort of works now...
    // Issues I noticed:
    // 1. When the cone is on the left side of the screen, the cone rotates fine but the
    //    sphere rotates in reverse about the x axis. When the cone is on the right side,
    //    both cone and sphere rotate as expected about both axes.
    // 2. much less important: the sphere now rotates nicely, but it doesn't get the same benefit
    //    from the _spherical.makeSafe thing.

    const position = this._cone.position;
    this._offset.copy(position).sub(this._circle.position);
    this._offset.applyQuaternion(this._quat);
    this._spherical.setFromVector3(this._offset);
    this._spherical.theta += this._sphericalDelta.theta;
    this._spherical.phi += this._sphericalDelta.phi;
    this._spherical.makeSafe();
    this._spherical.radius *= this._scale;
    this._spherical.radius = Math.max( this._minDistance, Math.min( this._maxDistance, this._spherical.radius ) );
    this._offset.setFromSpherical( this._spherical );
    this._offset.applyQuaternion( this._quatInverse );
    position.copy( this._circle.position ).add( this._offset );
    this._cone.lookAt( this._circle.position );
    
    //this._sphericalDelta.makeSafe();
    const sphereQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this._sphericalDelta.phi, this._sphericalDelta.theta, 0));
    this._circle.applyQuaternion(sphereQuat);
    
    this._sphericalDelta.set(0,0,0);
    



    // const position = scope.object.position;
    // offset.copy( position ).sub( scope.target );
    // // rotate offset to "y-axis-is-up" space
    // offset.applyQuaternion( quat );
    // // angle from z-axis around y-axis
    // spherical.setFromVector3( offset );
    // if ( scope.autoRotate && state === STATE.NONE ) {
    //   rotateLeft( getAutoRotationAngle() );
    // }
    // if ( scope.enableDamping ) {
    //   spherical.theta += sphericalDelta.theta * scope.dampingFactor;
    //   spherical.phi += sphericalDelta.phi * scope.dampingFactor;
    // } else {
    //   spherical.theta += sphericalDelta.theta;
    //   spherical.phi += sphericalDelta.phi;
    // }
    // // restrict theta to be between desired limits
    // let min = scope.minAzimuthAngle;
    // let max = scope.maxAzimuthAngle;
    // if ( isFinite( min ) && isFinite( max ) ) {
    //   if ( min < - Math.PI ) min += twoPI; else if ( min > Math.PI ) min -= twoPI;
    //   if ( max < - Math.PI ) max += twoPI; else if ( max > Math.PI ) max -= twoPI;
    //   if ( min <= max ) {
    //     spherical.theta = Math.max( min, Math.min( max, spherical.theta ) );
    //   } else {
    //     spherical.theta = ( spherical.theta > ( min + max ) / 2 ) ?
    //       Math.max( min, spherical.theta ) :
    //       Math.min( max, spherical.theta );
    //   }
    // }
    // // restrict phi to be between desired limits
    // spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );
    // spherical.makeSafe();
    // spherical.radius *= scale;
    // // restrict radius to be between desired limits
    // spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );
    // // move target to panned location
    // if ( scope.enableDamping === true ) {
    //   scope.target.addScaledVector( panOffset, scope.dampingFactor );
    // } else {
    //   scope.target.add( panOffset );
    // }
    // offset.setFromSpherical( spherical );
    // // rotate offset back to "camera-up-vector-is-up" space
    // offset.applyQuaternion( quatInverse );
    // position.copy( scope.target ).add( offset );
    // scope.object.lookAt( scope.target );
    // if ( scope.enableDamping === true ) {
    //   sphericalDelta.theta *= ( 1 - scope.dampingFactor );
    //   sphericalDelta.phi *= ( 1 - scope.dampingFactor );
    //   panOffset.multiplyScalar( 1 - scope.dampingFactor );
    // } else {
    //   sphericalDelta.set( 0, 0, 0 );
    //   panOffset.set( 0, 0, 0 );
    // }
    // scale = 1;
    // // update condition is:
    // // min(camera displacement, camera rotation in radians)^2 > EPS
    // // using small-angle approximation cos(x/2) = 1 - x^2 / 8
    // if ( zoomChanged ||
    //   lastPosition.distanceToSquared( scope.object.position ) > EPS ||
    //   8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {
    //   scope.dispatchEvent( _changeEvent );
    //   lastPosition.copy( scope.object.position );
    //   lastQuaternion.copy( scope.object.quaternion );
    //   zoomChanged = false;
    //   return true;
    // }
    // return false;
  }

  _onMouseWheel(event) {
    this._wheelDelta = event.wheelDelta;
  }

  _onMouseMove(event) {
    event.preventDefault();

    if (this._mouseDownLeft) {

      this._rotateEnd.set( event.clientX, event.clientY );
      this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this._rotateSpeed );
      const element = this._canv;
      const leftAngle = 2 * Math.PI * this._rotateDelta.x / element.clientHeight; // yes, height
      const upAngle = 2 * Math.PI * this._rotateDelta.y / element.clientHeight;
      console.log(`leftAngle: ${leftAngle}, upAngle: ${upAngle}`);
      this._rotateLeft( leftAngle );
      this._rotateUp( upAngle );
      this._rotateStart.copy( this._rotateEnd );
      this._applyRotation();
    }

    return false;
  }

  _onMouseDown(event) {
    event.preventDefault();
    
    this._rotateStart.set( event.clientX, event.clientY );

    if (event.button == 0) {
      this._mouseDownLeft = true;
    } else if (event.button == 2) {
      this._mouseDownRight = true;
    }

    if (this._mouseDownLeft && this._mouseDownRight) {
      this._keys.mouseforward = true;
    }
    return false;
  }

  _rotateLeft = ( angle ) => {
    this._sphericalDelta.theta -= angle;
  }
  _rotateUp = ( angle ) => {
    this._sphericalDelta.phi -= angle;
  }

  _onMouseUp(event) {
    event.preventDefault();

    if (event.button == 0) {
      this._mouseDownLeft = false;
    } else if (event.button == 2) {
      this._mouseDownRight = false;
    }

    if (!this._mouseDownLeft || !this._mouseDownRight) {
      this._keys.mouseforward = false;
    }
  }

}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new OrbitTests();
});

