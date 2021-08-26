import * as THREE from './three.module.js';

import Stats from './stats.module.js';
import { GUI } from './dat.gui.module.js';

import { OrbitControls } from './OrbitControls.js';
import { TransformControls } from './TransformControls.js';

let container, stats;
let camera, scene, renderer;
let controls;
const sceneObjects = [];

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDownPosition = new THREE.Vector2();

let transformControl;

let hoverObject = null;
let selectedObject = null;

const params = {
    addCube: addCube,
    addCone: addCone,
    addCylinder: addCylinder,
    addPlane: addPlane,
    removeObject: removeObject,
    setScale: setScale,
    setRotate: setRotate,
    setMove: setMove
};

init();
animate();

function init() {
    container = document.getElementById('container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 250, 1000);
    scene.add(camera);

    scene.add(new THREE.AmbientLight(0xf0f0f0));
    const light = new THREE.SpotLight(0xffffff, 1.5);
    light.position.set(0, 1500, 200);
    light.angle = Math.PI * 0.2;
    light.castShadow = true;
    light.shadow.camera.near = 200;
    light.shadow.camera.far = 2000;
    light.shadow.bias = - 0.000222;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    scene.add(light);

    const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
    planeGeometry.rotateX(- Math.PI / 2);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.y = - 200;
    plane.receiveShadow = true;
    scene.add(plane);

    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = - 199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    stats = new Stats();
    container.appendChild(stats.dom);

    const gui = new GUI();
    gui.add(params, 'addCube');
    gui.add(params, 'addCone');
    gui.add(params, 'addCylinder');
    gui.add(params, 'addPlane');
    gui.add(params, 'removeObject');
    gui.add(params, 'setScale');
    gui.add(params, 'setRotate');
    gui.add(params, 'setMove');
    gui.open();

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    controls.addEventListener('change', render);

    transformControl = new TransformControls(camera, renderer.domElement);
    console.log(`transformControl:`, transformControl);
    transformControl.setMode("scale");
    transformControl.addEventListener('change', render);
    transformControl.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;
    });
    scene.add(transformControl);

    transformControl.addEventListener('objectChange', function () {
        // okay so the squares that represent the points on the spline
        // get updated somehow. I think this is custom stuff that
        // causes the splines to match the points. let's see...
        //updateSplineOutline();
    });

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointermove', onPointerMove);
}

function addCube(position) {
    const geometry = new THREE.BoxGeometry(40, 40, 40);
    return addObject(geometry, position);
}

function addCone(position) {
    const geometry = new THREE.ConeGeometry(40, 80, 32);
    return addObject(geometry, position);
}

function addCylinder(position) {
    const geometry = new THREE.CylinderGeometry(40, 40, 80, 32);
    return addObject(geometry, position);
}

function addPlane(position) {
    const geometry = new THREE.PlaneGeometry(80, 80, 20, 20);
    const doubleSide = true;
    return addObject(geometry, position, doubleSide);
}

function addObject(geometry, position, doubleSide) {
    const material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide });
    const object = new THREE.Mesh(geometry, material);

    if (position) {
        object.position.copy(position);
    } else {
        object.position.x = controls.target.x;
        object.position.y = controls.target.y;
        object.position.z = controls.target.z;
    }

    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    sceneObjects.push(object);
    return object;
}

function reattach() {
    if (selectedObject) {
        transformControl.attach(selectedObject);
    }
}

function setScale() {
    transformControl.setSpace("world");
    transformControl.setMode("scale");
    reattach();
}

function setRotate() {
    transformControl.setSpace("local");
    transformControl.setMode("rotate");
    reattach();
}

function setMove() {
    transformControl.setSpace("world");
    transformControl.setMode("translate");
    reattach();
}

function removeObject() {
    const point = sceneObjects.pop();

    if (transformControl.object === point) transformControl.detach();
    scene.remove(point);
}

function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();
}

function render() {
    renderer.render(scene, camera);
}

function onPointerDown(event) {
    onDownPosition.x = event.clientX;
    onDownPosition.y = event.clientY;
}

function onPointerUp(event) {
    onUpPosition.x = event.clientX;
    onUpPosition.y = event.clientY;

    // i get it, if you click without moving, de-select the object.
    // except it works funny, it doesn't know if you are clicking on a widget
    // or if you are clicking the object
    if (onDownPosition.distanceTo(onUpPosition) === 0) {
        const raytraceObject = getRaytraceObject(event);
        if (raytraceObject) {
            selectedObject = raytraceObject;
            transformControl.attach(selectedObject);
            console.log(`You clicked an object. What is going on with tranformControl:`, transformControl.object);
        } else {
            transformControl.detach();
        }
    }
}

function onPointerMove(event) {
}

function getRaytraceObject(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(sceneObjects);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object !== transformControl.object) {
            //transformControl.attach(object);
            return object;
        }
    }
    return null;
}