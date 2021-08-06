import {
	EventDispatcher,
	MOUSE,
	Euler,
	Quaternion,
	Spherical,
	TOUCH,
	Vector2,
	Vector3,
	Object3D
} from './three.module.js';
// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move
const _changeEvent = { type: 'change' };
const _startEvent = { type: 'start' };
const _endEvent = { type: 'end' };

const MMOUSE = { LEFT: 0, MIDDLE: 1, RIGHT: 2, ROTATEL: 0, DOLLY: 1, ROTATER: 2 };
const MMTOUCH = { ROTATEL: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATEL: 3 };

class MMOrbitControls extends EventDispatcher {
	constructor( object, player, moveForwardCallback, stopMovingCallback, domElement ) {
		super();
		if ( domElement === undefined ) console.warn( 'THREE.OrbitControls: The second parameter "domElement" is now mandatory.' );
		if ( domElement === document ) console.error( 'THREE.OrbitControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.' );
		this.object = object;
		this.player = player;
		this.camPlayer = new Object3D();
		this.moveForwardCallback = moveForwardCallback;
		this.stopMovingCallback = stopMovingCallback;
		this.domElement = domElement;
		this.domElement.style.touchAction = 'none'; // disable touch scroll
		// Set to false to disable this control
		this.enabled = true;
		// "target" sets the location of focus, where the object orbits around
		this.target = new Vector3();
		// How far you can dolly in and out ( PerspectiveCamera only )
		this.minDistance = 0;
		this.maxDistance = Infinity;
		// How far you can zoom in and out ( OrthographicCamera only )
		this.minZoom = 0;
		this.maxZoom = Infinity;
		// How far you can orbit vertically, upper and lower limits.
		// Range is 0 to Math.PI radians.
		this.minPolarAngle = 0; // radians
		this.maxPolarAngle = Math.PI; // radians
		// How far you can orbit horizontally, upper and lower limits.
		// If set, the interval [ min, max ] must be a sub-interval of [ - 2 PI, 2 PI ], with ( max - min < 2 PI )
		this.minAzimuthAngle = - Infinity; // radians
		this.maxAzimuthAngle = Infinity; // radians
		// Set to true to enable damping (inertia)
		// If damping is enabled, you must call controls.update() in your animation loop
		this.enableDamping = false;
		this.dampingFactor = 0.05;
		// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
		// Set to false to disable zooming
		this.enableZoom = true;
		this.zoomSpeed = 1.0;
		// Set to false to disable rotating
		this.enableRotate = true;
		this.rotateSpeed = 1.0;
		// Set to false to disable panning
		this.enablePan = true;
		this.panSpeed = 1.0;
		this.screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
		this.keyPanSpeed = 7.0;	// pixels moved per arrow key push
		// Set to true to automatically rotate around the target
		// If auto-rotate is enabled, you must call controls.update() in your animation loop
		this.autoRotate = false;
		this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60
		// The four arrow keys
		this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };
		// Mouse buttons
		this.mouseButtons = { LEFT: MMOUSE.ROTATEL, MIDDLE: MMOUSE.DOLLY, RIGHT: MMOUSE.ROTATER };
		this.mouseLDown = false;
		this.mouseRDown = false;
		this.mouseLWasDown = false;
		this.mouseRWasDown = false;
		// Touch fingers
		this.touches = { ONE: MMTOUCH.ROTATEL, TWO: MMTOUCH.DOLLY_PAN };
		// for reset
		this.target0 = this.target.clone();
		this.position0 = this.object.position.clone();
		this.zoom0 = this.object.zoom;
		// the target DOM element for key events
		this._domElementKeyEvents = null;
		//
		// public methods
		//
		this.getPolarAngle = function () {
			return spherical.phi;
		};
		this.getAzimuthalAngle = function () {
			return spherical.theta;
		};
		this.listenToKeyEvents = function ( domElement ) {
			domElement.addEventListener( 'keydown', onKeyDown );
			this._domElementKeyEvents = domElement;
		};
		this.saveState = function () {
			scope.target0.copy( scope.target );
			scope.position0.copy( scope.object.position );
			scope.zoom0 = scope.object.zoom;
		};
		this.reset = function () {
			scope.target.copy( scope.target0 );
			scope.object.position.copy( scope.position0 );
			scope.object.zoom = scope.zoom0;
			scope.object.updateProjectionMatrix();
			scope.dispatchEvent( _changeEvent );
			scope.update();
			state = STATE.NONE;
		};
		// this method is exposed, but perhaps it would be better if we can make it private...
		this.update = function () {

			const offset = new Vector3();
			// so camera.up is the orbit axis
			const quat = new Quaternion().setFromUnitVectors( object.up, new Vector3( 0, 1, 0 ) );
			console.log(`quat:`, quat);
			const quatInverse = quat.clone().invert();
			const lastPosition = new Vector3();
			const lastQuaternion = new Quaternion();
			const twoPI = 2 * Math.PI;
			return function update() {

				if (scope.mouseRDown && !scope.mouseRWasDown) {
					scope.player.quaternion.copy(scope.camPlayer.quaternion);
				}

				const position = scope.object.position;
				offset.copy( position ).sub( scope.player.position );
				// rotate offset to "y-axis-is-up" space
				offset.applyQuaternion( quat );
				// angle from z-axis around y-axis
				spherical.setFromVector3( offset );
				if ( scope.autoRotate && state === STATE.NONE ) {
					rotateLeft( getAutoRotationAngle() );
				}
				if ( scope.enableDamping ) {
					spherical.theta += sphericalDelta.theta * scope.dampingFactor;
					spherical.phi += sphericalDelta.phi * scope.dampingFactor;
				} else {
					spherical.theta += sphericalDelta.theta;
					spherical.phi += sphericalDelta.phi;
				}
				// restrict theta to be between desired limits
				let min = scope.minAzimuthAngle;
				let max = scope.maxAzimuthAngle;
				if ( isFinite( min ) && isFinite( max ) ) {
					if ( min < - Math.PI ) min += twoPI; else if ( min > Math.PI ) min -= twoPI;
					if ( max < - Math.PI ) max += twoPI; else if ( max > Math.PI ) max -= twoPI;
					if ( min <= max ) {
						spherical.theta = Math.max( min, Math.min( max, spherical.theta ) );
					} else {
						spherical.theta = ( spherical.theta > ( min + max ) / 2 ) ?
							Math.max( min, spherical.theta ) :
							Math.min( max, spherical.theta );
					}
				}
				// restrict phi to be between desired limits
				spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );
				spherical.makeSafe();

				spherical.radius *= scale;
				// restrict radius to be between desired limits
				spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

				
				// I think this will set the orbital position based on theta and phi, and the
				// distance based on the radius of the spherical.
				offset.setFromSpherical( spherical );

				// rotate offset back to "camera-up-vector-is-up" space
				offset.applyQuaternion( quatInverse );
				position.copy( scope.player.position ).add( offset );

				// then just make sure the camera is pointed at the player
				scope.object.lookAt( scope.player.position );
				// test: zero-out the x rotation
				//scope.object.rotation.x = 0;

				// Rotate the player about the Y axis with the camera
				const sphereQuat = new Quaternion().setFromEuler(new Euler(0, sphericalDelta.theta, 0));
				this.camPlayer.applyQuaternion(sphereQuat);
				if (scope.mouseRDown) {
					this.player.applyQuaternion(sphereQuat);
				}

				// console.log(`camera: `, scope.object.rotation.y);
				// console.log(`player: `, scope.player.rotation.y);

				// remember current state for next time
				scope.mouseRWasDown = scope.mouseRDown;
				scope.mouseLWasDown = scope.mouseLDown;
				
				// let's try a simple thing to see how crazy movement gets:				
				if (scope.mouseRDown && scope.mouseLDown) {
					const forward = new Vector3(0,0,1);
					forward.applyQuaternion(scope.player.quaternion);
					forward.normalize();
					forward.multiplyScalar(.1);
					const pos = scope.player.position.clone();
					pos.add(forward);
					const moveDelta = pos.clone();
					moveDelta.sub(scope.player.position);
					

					scope.player.position.copy(pos);
					scope.camPlayer.position.add(moveDelta);
					scope.object.position.add(moveDelta);
				}

				// here's the old pan-related movement code. I think
				// i want to abandon it perahps....
				scope.target.add( panOffset );

				if ( scope.enableDamping === true ) {
					sphericalDelta.theta *= ( 1 - scope.dampingFactor );
					sphericalDelta.phi *= ( 1 - scope.dampingFactor );
					panOffset.multiplyScalar( 1 - scope.dampingFactor );
				} else {
					sphericalDelta.set( 0, 0, 0 );
					panOffset.set( 0, 0, 0 );
				}
				scale = 1;
				// update condition is:
				// min(camera displacement, camera rotation in radians)^2 > EPS
				// using small-angle approximation cos(x/2) = 1 - x^2 / 8
				if ( zoomChanged ||
					lastPosition.distanceToSquared( scope.object.position ) > EPS ||
					8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {
					scope.dispatchEvent( _changeEvent );
					lastPosition.copy( scope.object.position );
					lastQuaternion.copy( scope.object.quaternion );
					zoomChanged = false;
					return true;
				}
				return false;
			};
		}();
		this.dispose = function () {
			scope.domElement.removeEventListener( 'contextmenu', onContextMenu );
			scope.domElement.removeEventListener( 'pointerdown', onPointerDown );
			scope.domElement.removeEventListener( 'pointercancel', onPointerCancel );
			scope.domElement.removeEventListener( 'wheel', onMouseWheel );
			scope.domElement.removeEventListener( 'pointermove', onPointerMove );
			scope.domElement.removeEventListener( 'pointerup', onPointerUp );

			if ( scope._domElementKeyEvents !== null ) {
				scope._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown );
			}
			//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
		};
		//
		// internals
		//
		const scope = this;
		const STATE = {
			NONE: - 1,
			ROTATEL: 0,
			DOLLY: 1,
			ROTATER: 2,
			TOUCH_ROTATE: 3,
			TOUCH_PAN: 4,
			TOUCH_DOLLY_PAN: 5,
			TOUCH_DOLLY_ROTATEL: 6
		};
		let state = STATE.NONE;
		const EPS = 0.000001;
		// current position in spherical coordinates
		const spherical = new Spherical();
		const sphericalDelta = new Spherical();
		let scale = 1;
		const panOffset = new Vector3();
		let zoomChanged = false;
		const rotateStart = new Vector2();
		const rotateEnd = new Vector2();
		const rotateDelta = new Vector2();
		const panStart = new Vector2();
		const panEnd = new Vector2();
		const panDelta = new Vector2();
		const dollyStart = new Vector2();
		const dollyEnd = new Vector2();
		const dollyDelta = new Vector2();
		const pointers = [];
		const pointerPositions = {};
		function getAutoRotationAngle() {
			return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
		}
		function getZoomScale() {
			return Math.pow( 0.95, scope.zoomSpeed );
		}
		function rotateLeft( angle ) {
			sphericalDelta.theta -= angle;
		}
		function rotateUp( angle ) {
			sphericalDelta.phi -= angle;
		}
		const panUp = function () {
			const v = new Vector3();
			return function panUp( distance, objectMatrix ) {
				if ( scope.screenSpacePanning === true ) {
					v.setFromMatrixColumn( objectMatrix, 1 );
				} else {
					v.setFromMatrixColumn( objectMatrix, 0 );
					v.crossVectors( scope.object.up, v );
				}
				v.multiplyScalar( distance );
				panOffset.add( v );
			};
		}();
		// deltaX and deltaY are in pixels; right and down are positive
		const pan = function () {
			const offset = new Vector3();
			return function pan( deltaX, deltaY ) {
				const element = scope.domElement;

                // assume perspective
                const position = scope.object.position;
                offset.copy( position ).sub( scope.target );
                let targetDistance = offset.length();
                // half of the fov is center to top of screen
                targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );
                // we use only clientHeight here so aspect ratio does not distort speed
                panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );
			};
		}();
		function dollyOut( dollyScale ) {
            scale /= dollyScale;
		}
		function dollyIn( dollyScale ) {
            scale *= dollyScale;
		}
		//
		// event callbacks - update the object state
		//
		function handleMouseDownRotate( event ) {
			rotateStart.set( event.clientX, event.clientY );
		}
		function handleMouseMoveRotate( event ) {
			rotateEnd.set( event.clientX, event.clientY );
			rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );
			const element = scope.domElement;
			const leftAngle = 2 * Math.PI * rotateDelta.x / element.clientHeight; // yes, height
			const upAngle = 2 * Math.PI * rotateDelta.y / element.clientHeight;
			rotateLeft( leftAngle );
			rotateUp( upAngle );
			rotateStart.copy( rotateEnd );
			scope.update();
		}
		function handleMouseMoveDolly( event ) {
			dollyEnd.set( event.clientX, event.clientY );
			dollyDelta.subVectors( dollyEnd, dollyStart );
			if ( dollyDelta.y > 0 ) {
				dollyOut( getZoomScale() );
			} else if ( dollyDelta.y < 0 ) {
				dollyIn( getZoomScale() );
			}
			dollyStart.copy( dollyEnd );
			scope.update();
		}
		function handleMouseUp( /*event*/ ) {
			// no-op
		}
		function handleMouseWheel( event ) {
			if ( event.deltaY < 0 ) {
				dollyIn( getZoomScale() );
			} else if ( event.deltaY > 0 ) {
				dollyOut( getZoomScale() );
			}
			scope.update();
		}
		function handleKeyDown( event ) {
			console.log(`keydown`, event);
			let needsUpdate = false;
			switch ( event.code ) {
				case scope.keys.UP:
					pan( 0, scope.keyPanSpeed );
					needsUpdate = true;
					break;
				case scope.keys.BOTTOM:
					pan( 0, - scope.keyPanSpeed );
					needsUpdate = true;
					break;
				case scope.keys.LEFT:
					pan( scope.keyPanSpeed, 0 );
					needsUpdate = true;
					break;
				case scope.keys.RIGHT:
					pan( - scope.keyPanSpeed, 0 );
					needsUpdate = true;
					break;
			}
			if ( needsUpdate ) {
				// prevent the browser from scrolling on cursor keys
				event.preventDefault();
				scope.update();
			}

		}
		function handleTouchStartRotate() {
			if ( pointers.length === 1 ) {
				rotateStart.set( pointers[ 0 ].pageX, pointers[ 0 ].pageY );
			} else {
				const x = 0.5 * ( pointers[ 0 ].pageX + pointers[ 1 ].pageX );
				const y = 0.5 * ( pointers[ 0 ].pageY + pointers[ 1 ].pageY );
				rotateStart.set( x, y );
			}
		}
		function handleTouchStartDolly() {
			const dx = pointers[ 0 ].pageX - pointers[ 1 ].pageX;
			const dy = pointers[ 0 ].pageY - pointers[ 1 ].pageY;
			const distance = Math.sqrt( dx * dx + dy * dy );
			dollyStart.set( 0, distance );
		}
		function handleTouchStartDollyRotate() {
			if ( scope.enableZoom ) handleTouchStartDolly();
			if ( scope.enableRotate ) handleTouchStartRotate();
		}
		function handleTouchMoveRotate( event ) {
			if ( pointers.length == 1 ) {
				rotateEnd.set( event.pageX, event.pageY );
			} else {
				const position = getSecondPointerPosition( event );
				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );
				rotateEnd.set( x, y );
			}
			rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );
			const element = scope.domElement;
			rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height
			rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );
			rotateStart.copy( rotateEnd );
		}
		function handleTouchMoveDolly( event ) {
			const position = getSecondPointerPosition( event );
			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;
			const distance = Math.sqrt( dx * dx + dy * dy );
			dollyEnd.set( 0, distance );
			dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, scope.zoomSpeed ) );
			dollyOut( dollyDelta.y );
			dollyStart.copy( dollyEnd );
		}
		function handleTouchMoveDollyRotate( event ) {
			if ( scope.enableZoom ) handleTouchMoveDolly( event );
			if ( scope.enableRotate ) handleTouchMoveRotate( event );
		}
		function handleTouchEnd( /*event*/ ) {
			// no-op
		}
		//
		// event handlers - FSM: listen for events and reset state
		//
		function onPointerDown( event ) {
			if ( scope.enabled === false ) return;
			if ( pointers.length === 0 ) {
				scope.domElement.setPointerCapture( event.pointerId );
				scope.domElement.addEventListener( 'pointermove', onPointerMove );
				scope.domElement.addEventListener( 'pointerup', onPointerUp );
			}
			//
			addPointer( event );
			if ( event.pointerType === 'touch' ) {
				onTouchStart( event );
			} else {
				onMouseDown( event );
			}
		}
		function onPointerMove( event ) {
			if ( scope.enabled === false ) return;
			if ( event.pointerType === 'touch' ) {
				onTouchMove( event );
			} else {
				onMouseMove( event );
			}
		}
		function onPointerUp( event ) {
			if ( scope.enabled === false ) return;
			if ( event.pointerType === 'touch' ) {
				onTouchEnd();
			} else {
				onMouseUp( event );
			}
			removePointer( event );
			//
			if ( pointers.length === 0 ) {
				scope.domElement.releasePointerCapture( event.pointerId );
				scope.domElement.removeEventListener( 'pointermove', onPointerMove );
				scope.domElement.removeEventListener( 'pointerup', onPointerUp );
			}
		}
		function onPointerCancel( event ) {
			removePointer( event );
		}
		function onMouseDown( event ) {
			let mouseAction;
			switch ( event.button ) {
				case 0:
					mouseAction = scope.mouseButtons.LEFT;
					scope.mouseLDown = true;
					break;
				case 1:
					mouseAction = scope.mouseButtons.MIDDLE;
					break;
				case 2:
					mouseAction = scope.mouseButtons.RIGHT;
					scope.mouseRDown = true;
					break;
				default:
					mouseAction = - 1;
			}
			switch ( mouseAction ) {
                case MMOUSE.ROTATER:
                    if ( scope.enablePan === false ) return;
                    handleMouseDownRotate( event );
                    state = STATE.ROTATER;
                    break;
				case MMOUSE.ROTATEL:
                    if ( scope.enableRotate === false ) return;
                    handleMouseDownRotate( event );
                    state = STATE.ROTATEL;
					break;
				default:
					state = STATE.NONE;
			}
			if (scope.mouseRDown && scope.mouseLDown) {
				scope.update();
				scope.moveForwardCallback();				
			}
			if ( state !== STATE.NONE ) {
				scope.dispatchEvent( _startEvent );
			}
		}
		function onMouseMove( event ) {
			if ( scope.enabled === false ) return;
			switch ( state ) {
				case STATE.ROTATEL:
					if ( scope.enableRotate === false ) return;
					handleMouseMoveRotate( event );
					break;
				case STATE.ROTATER:
					if ( scope.enablePan === false ) return;
					handleMouseMoveRotate( event );
					break;
			}
		}
		function onMouseUp( event ) {
			handleMouseUp( event );
			if (event.button == scope.mouseButtons.LEFT) {
				scope.mouseLDown = false;
			}
			if (event.button == scope.mouseButtons.RIGHT) {
				scope.mouseRDown = false;
			}
			if (!scope.mouseRDown || !scope.mouseLDown) {
				scope.stopMovingCallback();
				if (!scope.mouseRDown && !scope.mouseLDown) {
					state = STATE.NONE;
				}
			}
			scope.dispatchEvent( _endEvent );
		}
		function onMouseWheel( event ) {
			event.preventDefault();
			scope.dispatchEvent( _startEvent );
			handleMouseWheel( event );
			scope.dispatchEvent( _endEvent );
		}
		function onKeyDown( event ) {
			console.log(`onKeyDown`, event);
			if ( scope.enabled === false || scope.enablePan === false ) return;
			handleKeyDown( event );
		}
		function onTouchStart( event ) {
			trackPointer( event );
			switch ( pointers.length ) {
				case 1:
					switch ( scope.touches.ONE ) {
						case MMTOUCH.ROTATEL:
							if ( scope.enableRotate === false ) return;
							handleTouchStartRotate();
							state = STATE.TOUCH_ROTATEL;
							break;
						case MMTOUCH.PAN:
							if ( scope.enablePan === false ) return;
							handleTouchStartPan();
							state = STATE.TOUCH_PAN;
							break;
						default:
							state = STATE.NONE;
					}
					break;
				case 2:
					switch ( scope.touches.TWO ) {
						case MMTOUCH.DOLLY_PAN:
							if ( scope.enableZoom === false && scope.enablePan === false ) return;
							handleTouchStartDollyPan();
							state = STATE.TOUCH_DOLLY_PAN;
							break;
						case MMTOUCH.DOLLY_ROTATEL:
							if ( scope.enableZoom === false && scope.enableRotate === false ) return;
							handleTouchStartDollyRotate();
							state = STATE.TOUCH_DOLLY_ROTATEL;
							break;
						default:
							state = STATE.NONE;
					}
					break;
				default:
					state = STATE.NONE;
			}
			if ( state !== STATE.NONE ) {
				scope.dispatchEvent( _startEvent );
			}
		}
		function onTouchMove( event ) {
			trackPointer( event );
			switch ( state ) {
				case STATE.TOUCH_ROTATEL:
					if ( scope.enableRotate === false ) return;
					handleTouchMoveRotate( event );
					scope.update();
					break;
				case STATE.TOUCH_PAN:
					if ( scope.enablePan === false ) return;
					handleTouchMovePan( event );
					scope.update();
					break;
				case STATE.TOUCH_DOLLY_PAN:
					if ( scope.enableZoom === false && scope.enablePan === false ) return;
					handleTouchMoveDollyPan( event );
					scope.update();
					break;
				case STATE.TOUCH_DOLLY_ROTATEL:
					if ( scope.enableZoom === false && scope.enableRotate === false ) return;
					handleTouchMoveDollyRotate( event );
					scope.update();
					break;
				default:
					state = STATE.NONE;
			}
		}
		function onTouchEnd( event ) {
			handleTouchEnd( event );
			scope.dispatchEvent( _endEvent );
			state = STATE.NONE;
		}
		function onContextMenu( event ) {
			if ( scope.enabled === false ) return;
			event.preventDefault();
		}
		function addPointer( event ) {
			pointers.push( event );
		}
		function removePointer( event ) {
			delete pointerPositions[ event.pointerId ];
			for ( let i = 0; i < pointers.length; i ++ ) {
				if ( pointers[ i ].pointerId == event.pointerId ) {
					pointers.splice( i, 1 );
					return;
				}
			}
		}
		function trackPointer( event ) {
			let position = pointerPositions[ event.pointerId ];
			if ( position === undefined ) {
				position = new Vector2();
				pointerPositions[ event.pointerId ] = position;
			}
			position.set( event.pageX, event.pageY );
		}
		function getSecondPointerPosition( event ) {
			const pointer = ( event.pointerId === pointers[ 0 ].pointerId ) ? pointers[ 1 ] : pointers[ 0 ];
			return pointerPositions[ pointer.pointerId ];
		}
		//
		scope.domElement.addEventListener( 'contextmenu', onContextMenu );
		//scope.domElement.addEventListener( 'pointerdown', onPointerDown );
		//scope.domElement.addEventListener( 'pointercancel', onPointerCancel );
		scope.domElement.addEventListener("mousedown", onMouseDown);
		scope.domElement.addEventListener("mouseup", onMouseUp);
		scope.domElement.addEventListener("mousemove", onMouseMove);
		scope.domElement.addEventListener( 'wheel', onMouseWheel, { passive: false } );
		scope.domElement.addEventListener( 'keydown', onKeyDown );
		// force an update at start
		this.update();
	}
}

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
// This is very similar to OrbitControls, another set of touch behavior
//
//    Orbit - right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - left mouse, or arrow keys / touch: one-finger move
class MapControls extends MMOrbitControls {
	constructor( object, domElement ) {
		super( object, domElement );
		this.screenSpacePanning = false; // pan orthogonal to world-space direction camera.up
		this.mouseButtons.LEFT = MMOUSE.ROTATER;
		this.mouseButtons.RIGHT = MMOUSE.ROTATEL;
		this.touches.ONE = MMTOUCH.PAN;
		this.touches.TWO = MMTOUCH.DOLLY_ROTATEL;
	}
}
export { MMOrbitControls, MapControls };