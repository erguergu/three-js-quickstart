import * as THREE from './three.module.js';

import Stats from './stats.module.js';
import { GUI } from './dat.gui.module.js';

import { OrbitControls } from './OrbitControls.js';
import { TransformControls } from './TransformControls.js';

let gui;
let guiControls = [];

let container, stats;
let camera, scene, renderer;
let controls;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDownPosition = new THREE.Vector2();

let transformControl;

const selectableObjects = [];
let selectedObjects = [];
let selectedBoxes = [];
let groups = [];

const params = {
    addCube: addCube,
    addCone: addCone,
    addCylinder: addCylinder,
    addPlane: addPlane,
    addSphere: addSphere,
    cloneObject: cloneObject,
    removeObject: removeObject,
    setScale: setScale,
    setRotate: setRotate,
    setMove: setMove,
    createGroup: createGroup,
    ungroup: ungroup
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
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
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

    gui = new GUI();
    setupGui();
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

    transformControl.addEventListener('objectChange', function (e) {

        // as you alter the object, you must also alter its bounding box
        selectedBoxes.forEach(box => box.update());
    });

    document.getElementById("container").addEventListener('pointerdown', onPointerDown);
    document.getElementById("container").addEventListener('pointerup', onPointerUp);
    document.getElementById("container").addEventListener('pointermove', onPointerMove);
}

function setupGui() {
    gui.destroy();
    gui = new GUI();

    const oneSelected = selectedObjects.length == 1;
    const multSelected = selectedObjects.length > 1;
    const groupSelected = oneSelected && groups.find(item => item == selectedObjects[0]);
    
    gui.add(params, 'addCube').name("Add Cube");
    gui.add(params, 'addCone').name("Add Cone");
    gui.add(params, 'addCylinder').name("Add Cylinder");
    gui.add(params, 'addPlane').name("Add Plane");
    gui.add(params, 'addSphere').name("Add Sphere");
    if (oneSelected) {
        if (groupSelected) {
            gui.add(params, 'ungroup').name('Ungroup');
        }
        gui.add(params, 'cloneObject').name("Clone");
        gui.add(params, 'removeObject').name("Remove");
        gui.add(params, 'setScale').name("Scale");
        gui.add(params, 'setRotate').name("Rotate");
        gui.add(params, 'setMove').name("Move");
    }
    if (multSelected) {
        gui.add(params, 'createGroup').name('Create Group');
    }
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

function addSphere(position) {
    const geometry = new THREE.SphereGeometry(40, 32, 16);
    return addObject(geometry, position);
}

function setObjectPosition(object, position) {

    if (position) {
        object.position.copy(position);
    } else {
        object.position.x = controls.target.x;
        object.position.y = controls.target.y;
        object.position.z = controls.target.z;
    }
}

function multiSelectObject(object) {
    // check if the object is already among the selected, if so remove it from the list
    const highestObject = getHighestLevelObject(object);
    const ind = selectedObjects.findIndex(p => p.uuid == highestObject.uuid);
    if (ind >= 0) {
        const [remObj] = selectedObjects.splice(ind, 1);
        const [remBox] = selectedBoxes.splice(ind, 1);
        scene.remove(remBox);
    } else {

        // otherwise just add the object to the list
        transformControl.detach();
        selectedObjects.push(highestObject);
        const box = new THREE.BoxHelper(highestObject, 0xffffff);
        selectedBoxes.push(box);
        scene.add(box);
    }
    setupGui();
}

function selectObject(object) {
    if (selectedObjects.length == 1 && selectedObjects[0] == object) {
        return;
    }
    deselectObject();
    const highestObject = getHighestLevelObject(object);
    selectedObjects.push(highestObject);
    selectedBoxes.push(new THREE.BoxHelper(highestObject, 0xffffff));
    scene.add(selectedBoxes[0]);
    setupGui();
    console.log(`selected object at `, highestObject.position);
}

function getHighestLevelObject(object) {
    if (object.parent.type == "Scene") {
        return object;
    } else {
        return getHighestLevelObject(object.parent);
    }
}

// group hierarchy...
function getParentGroup(object) {
    const group = groups.find((grp) => {
        const foundObj = group.children.find(child => child.uuid == object.uuid);
        return foundObj ? true : false;
    });
    return group;
}

function deselectObject() {
    transformControl.detach();
    selectedBoxes.forEach(box=>scene.remove(box));
    selectedBoxes.length = 0;
    selectedObjects.length = 0;
    setupGui();
}

function addObject(geometry, position, doubleSide) {
    const material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide });
    const object = new THREE.Mesh(geometry, material);

    setObjectPosition(object, position);

    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    selectableObjects.push(object);
    selectObject(object);
    return object;
}

function createGroup() {
    const group = new THREE.Object3D();
    const newPosition = new THREE.Vector3();
    selectedObjects.forEach((child) => {
        newPosition.x += child.position.x;
        newPosition.y += child.position.y;
        newPosition.z += child.position.z;
        group.attach(child);
        removeObjectFromArray(child, selectableObjects);
    });
    newPosition.x /= selectedObjects.length;
    newPosition.y /= selectedObjects.length;
    newPosition.z /= selectedObjects.length;
    group.position.copy(newPosition);
    selectedObjects.forEach((child) => {
        child.position.x -= group.position.x;
        child.position.y -= group.position.y;
        child.position.z -= group.position.z;
    });
    deselectObject();
    groups.push(group);
    scene.attach(group);
    selectableObjects.push(group);
    selectObject(group);
    console.log(`group created:`, group);
}

function ungroup() {
    const group = selectedObjects[0];
    removeObjectFromArray(group, groups);
    const children = [];
    group.children.forEach(child => children.push(child));
    children.forEach(child => {
        scene.attach(child);
        selectableObjects.push(child);
    });
    removeObject(group); // get rid of the group object
    children.forEach(child => multiSelectObject(child));
}

function cloneObject(objectToClone) {
    if (!objectToClone && selectedObjects.length == 1) {
        objectToClone = selectedObjects[0];
    }
    if (!objectToClone) {
        return null;
    }
    const clone = objectToClone.clone();
    scene.add(clone);
    selectableObjects.push(clone);
    selectObject(clone);
    setMove();
    return clone;
}

function activateTransformControl() {
    if (selectedObjects.length == 1) {
        transformControl.attach(selectedObjects[0]);
    }
}

function setScale() {
    transformControl.setSpace("world");
    transformControl.setMode("scale");
    activateTransformControl();
}

function setRotate() {
    transformControl.setSpace("local");
    transformControl.setMode("rotate");
    activateTransformControl();
}

function setMove() {
    transformControl.setSpace("world");
    transformControl.setMode("translate");
    activateTransformControl();
}

function removeObject(object) {    
    if (!object && selectedObjects.length == 1) {
        object = selectedObjects[0];
    }
    scene.remove(object);
    removeObjectFromArray(object, selectableObjects);
    deselectObject();
}

function removeObjectFromArray(object, array) {
    const ind = array.findIndex(p => p.uuid == object.uuid);
    if (ind >= 0) {
        array.splice(ind, 1);
    }
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

    const controlKeyPressed = event.ctrlKey;

    onUpPosition.x = event.clientX;
    onUpPosition.y = event.clientY;

    if (onDownPosition.distanceTo(onUpPosition) === 0) {
        const raytraceObject = getRaytraceObject(event);
        if (controlKeyPressed) {
            if (raytraceObject) {
                multiSelectObject(raytraceObject);
            }
        }
        else {
            if (raytraceObject) {
                selectObject(raytraceObject)
            } else {
                deselectObject();
            }
        }
    }
}

function onPointerMove(event) {
}

function getRaytraceObject(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(selectableObjects, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;   
        if (object !== transformControl.object) {
            console.log(`found it`);
            return object;
        }
    }
    return null;
}