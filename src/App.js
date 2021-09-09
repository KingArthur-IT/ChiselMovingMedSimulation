import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { Line2, LineGeometry, LineMaterial } from 'three-fatline';

//scene
let canvas, camera, scene, light, renderer,
	chiselObj, shiftObj, circlePlane, lineObj;
//popup
let popupPlaneMesh,
	popupBtn = document.getElementById('popupBtn'),
	popupTexts = JSON.parse(popupData);
//params
let params = {
	sceneWidth: 850,
	sceneHeight: 450,
	bgSrc: './assets/img/interaction_center_chisel_bg.jpg',
	popupSrc: './assets/img/popup.png',
	isSimulationActive: false,
	isChiselLocked: false,
	isSetChiselCorrect: undefined,
	successChiselAngle: 195.0 * Math.PI / 180.0,
	maxAngleOffset: 0.75 * Math.PI / 180.0,
	waitPopupTime: 1000,
	successColor: 0x0dff00,
}

let objectsParams = {
	modelPath: './assets/models/',
	chisel: {
		chiselObj: 'chisel.obj',
		chiselMtl: 'chisel.mtl',
		scale: new THREE.Vector3(1.0, 1.0, 1.3),
		position: new THREE.Vector3(-16.0, -4.0, -18.0),
		rotation: new THREE.Vector3(
			8.0 * Math.PI / 180.0,
			185.0 * Math.PI / 180.0, //185
			3.0 * Math.PI / 180.0),
		rotationPointShift: -15.0,
		rotationStep: 0.005,
		minAngle: 179.0 * Math.PI / 180.0,
		maxAngle: 208.0 * Math.PI / 180.0
	},
	circlePlane: {
		pathSrc: './assets/img/circle.png',
		width: 20,
		height: 20,
		scale: 		new THREE.Vector3(0.1, 0.1, 0.1),
		position: 	new THREE.Vector3(13.9, -3.4, 0.0)
	},
	line: {
		lineWidth: 2,
		lineColor: '#0dff00',
		lineEndsPositionArray: [ -15.2, 5.0, -15.0, -5.5, -8.0, 20.0 ]
	},
};

let touchParams = {
	objectLeftTopCorner: { x: 15, y: 400 },
	objectRightBottomCorner: { x: 140, y: 450 },
	mouseDown: { x: 0 },
	limits: {min: 15, max: 440}
}

class App {
	init() {
		canvas = document.getElementById('canvas');
		canvas.setAttribute('width', 	params.sceneWidth);
		canvas.setAttribute('height', 	params.sceneHeight);
		
		//scene and camera
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xffffff);
		camera = new THREE.PerspectiveCamera(40.0, params.sceneWidth / params.sceneHeight, 0.1, 5000);
		camera.position.set(0, 0, 40);
		//light
		light = new THREE.AmbientLight(0xffffff);
		scene.add(light);
		
		//renderer
		renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
		renderer.setClearColor(0xffffff);

		
		//Load background texture
		let loader = new THREE.TextureLoader();
		loader.load(params.bgSrc, function (texture) {
			texture.minFilter = THREE.LinearFilter;
			scene.background = texture;
		});

		//parent obj 
		shiftObj = new THREE.Object3D();
		
		//chisel obj		
		chiselObj = new THREE.Object3D();
		let mtlLoader = new MTLLoader();
		mtlLoader.setPath(objectsParams.modelPath);
		mtlLoader.load(objectsParams.chisel.chiselMtl, function (materials) {
			materials.preload();
			let objLoader = new OBJLoader();
			objLoader.setMaterials(materials);
			objLoader.setPath(objectsParams.modelPath);
			objLoader.load(objectsParams.chisel.chiselObj, function (object) {
				object.scale.copy(objectsParams.chisel.scale);
				chiselObj.add(object);
			});
		});
		//parent obj params
		shiftObj.position.copy(objectsParams.chisel.position);
		shiftObj.rotation.setFromVector3(objectsParams.chisel.rotation);
		shiftObj.add(chiselObj);
		scene.add(shiftObj);
		chiselObj.position.z = objectsParams.chisel.rotationPointShift;

		//line
		const lineMtl = new LineMaterial({
			color: objectsParams.line.lineColor,
			linewidth: objectsParams.line.lineWidth, // px
			resolution: new THREE.Vector2(params.sceneWidth, params.sceneHeight) // resolution of the viewport
		});
		const lineGeometry = new LineGeometry();
		lineGeometry.setPositions(objectsParams.line.lineEndsPositionArray);
		lineObj = new Line2(lineGeometry, lineMtl);

		//planeCircle
		const circlePlaneGeom = new THREE.PlaneGeometry(objectsParams.circlePlane.width, objectsParams.circlePlane.height, 10.0);
		loader = new THREE.TextureLoader();
		const circleMaterial = new THREE.MeshBasicMaterial({
			map: loader.load(objectsParams.circlePlane.pathSrc, function (texture) {
				texture.minFilter = THREE.LinearFilter;
			}),
			transparent: true
		});
		circlePlane = new THREE.Mesh(circlePlaneGeom, circleMaterial);
		circlePlane.scale.copy(objectsParams.circlePlane.scale);
		circlePlane.position.copy(objectsParams.circlePlane.position);
		circlePlane.rotation.y = Math.abs(params.successChiselAngle - shiftObj.rotation.y) * 2.0;
		scene.add(circlePlane);
			
		//popup
		createPopupPlane();
		addPopup();


		renderer.render(scene, camera);
		canvas.addEventListener('mousemove', onMouseMove, false);
		canvas.addEventListener('mousedown', onMouseDown, false);
		popupBtn.addEventListener('click', removePopup, false);
		
		canvas.addEventListener("touchstart",   touch_start_handler);
    	canvas.addEventListener("touchmove",    touch_move_handler);    
    	canvas.addEventListener("touchend",     touch_up_handler);

		animate();
	}
}

function onMouseMove(e) {
	if (params.isChiselLocked) {
		//get movement of the mouse in lock API
		let movementX = e.movementX ||
			e.mozMovementX ||
			e.webkitMovementX ||
			0;
		if (Math.abs(movementX) > 3.0)
			movementX = Math.sign(movementX) * 3.0;
		let newAngle = shiftObj.rotation.y + movementX * objectsParams.chisel.rotationStep;
		if (newAngle < objectsParams.chisel.maxAngle && newAngle > objectsParams.chisel.minAngle)
		{
			shiftObj.rotation.y += movementX * objectsParams.chisel.rotationStep;
			//circlePlane.rotation.y = Math.abs(params.successChiselAngle - shiftObj.rotation.y) * 2.0;
		}
		AlignmentSuccess();
	}
}

function AlignmentSuccess() {
	scene.remove(lineObj);
	//circlePlane.material.color.setHex( 0xffffff );
	if (Math.abs(shiftObj.rotation.y - params.successChiselAngle) < params.maxAngleOffset)
	{
		scene.add(lineObj);
		//circlePlane.material.color.setHex(params.successColor);
		shiftObj.rotation.y = params.successChiselAngle;
	}
}

function onMouseDown() {
	if (!params.isSimulationActive) return;
	if (params.isChiselLocked) {
		//unlock
		document.exitPointerLock = document.exitPointerLock ||
			document.mozExitPointerLock ||
			document.webkitExitPointerLock;
		document.exitPointerLock();
		params.isChiselLocked = false;
		CheckSuccessPosition();
	}
	else {
		//lock
		canvas.requestPointerLock = canvas.requestPointerLock ||
			canvas.mozRequestPointerLock ||
			canvas.webkitRequestPointerLock;
		canvas.requestPointerLock();
		params.isChiselLocked = true;
	}
}

function CheckSuccessPosition(){
	if (Math.abs(shiftObj.rotation.y - params.successChiselAngle) < params.maxAngleOffset)
	{
		params.isSetChiselCorrect = true;
		shiftObj.rotation.y = params.successChiselAngle;
	}
	else
		params.isSetChiselCorrect = false;
	setTimeout(() => {
			addPopup();
		}, params.waitPopupTime);
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

function createPopupPlane() {
	const popupPlane = new THREE.PlaneGeometry(params.sceneWidth, params.sceneHeight, 10.0);
	const loader = new THREE.TextureLoader();
	const popupMaterial = new THREE.MeshBasicMaterial({
		map: loader.load(params.popupSrc, function (texture) {
			texture.minFilter = THREE.LinearFilter; }),
		transparent: true
	});    
	popupPlaneMesh = new THREE.Mesh(popupPlane, popupMaterial);
	popupPlaneMesh.scale.set(0.04, 0.045, 0.04)
	popupPlaneMesh.position.z = 10;
}

function addPopup() {
	scene.add(popupPlaneMesh);
	
	params.isChiselLocked = false;
	params.isSimulationActive = false;
	//interface
	document.getElementById('popupTitle').style.display = 'block';
	document.getElementById('popupText').style.display = 'block';
	popupBtn.style.display = 'block';
	if (params.isSetChiselCorrect === undefined) {
		document.getElementById('popupTitle').value = popupTexts.introTitle;
		document.getElementById('popupText').value = popupTexts.introText;
		return;
	}
	if (params.isSetChiselCorrect) {
		document.getElementById('popupTitle').value = popupTexts.correctTitle;
		document.getElementById('popupText').value = popupTexts.correctText;
		return;
	}
	if (!params.isSetChiselCorrect) {
		document.getElementById('popupTitle').value = popupTexts.uncorrectTitle;
		document.getElementById('popupText').value = popupTexts.uncorrectText;
		return;
	}
}

function removePopup() {
	scene.remove(popupPlaneMesh);
	params.isSimulationActive = true;
	//interface
	document.getElementById('popupTitle').style.display = 'none';
	document.getElementById('popupText').style.display = 'none';
	popupBtn.style.display = 'none';
	if(!params.isSetChiselCorrect) {
		onMouseDown();
	}
}

function touch_start_handler(e) {
	if (!params.isSimulationActive) return;
	params.isChiselLocked = false;
	let evt = (typeof e.originalEvent === 'undefined') ? e : e.originalEvent;
	let touch = evt.touches[0] || evt.changedTouches[0];
	if (parseInt(touch.pageX) > touchParams.objectLeftTopCorner.x &&
		parseInt(touch.pageY) > touchParams.objectLeftTopCorner.y &&
		parseInt(touch.pageX) < touchParams.objectRightBottomCorner.x &&
		parseInt(touch.pageY) < touchParams.objectRightBottomCorner.y
	) {
		params.isChiselLocked = true;
	}
}

function touch_move_handler(e) {
	let evt = (typeof e.originalEvent === 'undefined') ? e : e.originalEvent;
	let touch = evt.touches[0] || evt.changedTouches[0];
	if (params.isChiselLocked) {
		let newMouseX = parseInt(touch.pageX);
		if (newMouseX < touchParams.limits.max && newMouseX > touchParams.limits.min) {
			let newAngle = (newMouseX - touchParams.limits.min) *
				(objectsParams.chisel.maxAngle - objectsParams.chisel.minAngle) /
				(touchParams.limits.max - touchParams.limits.min) + objectsParams.chisel.minAngle;
			shiftObj.rotation.y = newAngle;
			//circlePlane.rotation.y = Math.abs(params.successChiselAngle - shiftObj.rotation.y) * 2.0;
			touchParams.objectLeftTopCorner.x = newMouseX - 50;
			touchParams.objectRightBottomCorner.x = newMouseX + 50;
			AlignmentSuccess();
		}
	}
}

function touch_up_handler(e) {
	if (params.isChiselLocked) {
		CheckSuccessPosition();
	}
	params.isChiselLocked = false;
}

export default App;
