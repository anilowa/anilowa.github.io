const game = document.getElementById("game");
const level = document.getElementById("level");
const ground = document.getElementById("ground");
const ceiling = document.getElementById("ceiling");
const cube = document.getElementById("cube");
const ship = document.getElementById("ship");
const groundContainer = document.getElementById("ground-container");

let levelData = level1Data;

let deathHitboxes = [];
let blockHitboxes = [];
let ceilingHitboxes = [];
let orbHitboxes = [];
let padHitboxes = [];
let portalHitboxes = [];
let triggerHitboxes = [];

const speed = 0.3;
const playerX = 60;
const playerSize = 30;
const groundY = 360;
const ceilingY = -60;
const groundSize = 120;
const jumpForce = -0.516;
const orbForce = -0.45;
const padForce = -0.7;
let gravity = 0.00216;
let playerY = 330;
let isShip = false;
const shipGravityMultiplier = 0.5;
let fakeGravityMultiplier = 1;
let lastX = 0;
const lastXOffset = 180;
let onGround = true;
let onCeiling = false;

let started = false;

let keyPress = false;
let didJump = false;

// adds an object's hitbox to a specified array
const addHitboxToArray = (id, x, y, rotation, hitbox, array) => {

	// offsets the hitbox of an upside-down slab
	if (id === "slab" && rotation === 180) {
		y += 15;
	}

	if (hitbox) {
		const rect = hitbox.querySelector("rect");

		array.push({
			"x": x + parseFloat(rect.getAttribute("x")),
			"y": y + parseFloat(rect.getAttribute("y")),
			"width": parseFloat(rect.getAttribute("width")),
			"height": parseFloat(rect.getAttribute("height"))
		});
	}

};

// readds orbs and pads as they are removed from their arrays after bouncing
const loadSpecialHitbox = (id, x, y) => {

	addHitboxToArray(id, x, y, 0, document.getElementById(id).querySelector("#orb-hitbox"), orbHitboxes);
	addHitboxToArray(id, x, y, 0, document.getElementById(id).querySelector("#pad-hitbox"), padHitboxes);

};

// adds a portal's hitbox to `portalHitboxes`
const addHitboxToPortalHitboxes = (x, y, hitbox, id) => {

	if (hitbox) {
		const rect = hitbox.querySelector("rect");

		portalHitboxes.push({
			"x": x + parseFloat(rect.getAttribute("x")),
			"y": y + parseFloat(rect.getAttribute("y")),
			"width": parseFloat(rect.getAttribute("width")),
			"height": parseFloat(rect.getAttribute("height")),
			"id": id
		});
	}

};

// clones an object from `<defs>` into the specified element
const cloneSvg = (id, x, y, rotation, element) => {

	const use = document.createElementNS("http://www.w3.org/2000/svg", "use");

	use.setAttribute("href", `#${id}`);
	use.setAttribute("x", x);
	use.setAttribute("y", y);
	use.setAttribute("transform", `rotate(${rotation} ${x + 15} ${y + 15})`);

	element.appendChild(use);

	const deathHitbox = document.getElementById(id).querySelector("#death-hitbox");

	if (deathHitbox) {
		const rect = deathHitbox.querySelector("rect");
		let new_x = parseFloat(rect.getAttribute("x"));
		let new_y = parseFloat(rect.getAttribute("y"));
		let new_width = parseFloat(rect.getAttribute("width"));
		let new_height = parseFloat(rect.getAttribute("height"));

		// offsets the hitbox of an upside-down slab
		if (id === "slab" && rotation === 180) {
			new_y += 15;
		}

		// rotates the death hitbox
		if (["spike", "ground-spikes", "small-spike"].includes(id)) {
			if (rotation === 90) {
				[new_x, new_y, new_width, new_height] = [30 - new_y - new_height, new_x, new_height, new_width];
			} else if (rotation === 180) {
				[new_x, new_y] = [30 - new_x - new_width, 30 - new_y - new_height];
			} else if (rotation === 270) {
				[new_x, new_y, new_width, new_height] = [new_y, 30 - new_x - new_width, new_height, new_width];
			}
		}

		deathHitboxes.push({
			"x": x + new_x,
			"y": y + new_y,
			"width": new_width,
			"height": new_height
		});
	}

	addHitboxToArray(id, x, y, rotation, document.getElementById(id).querySelector("#block-hitbox"), blockHitboxes);
	addHitboxToArray(id, x, y, rotation, document.getElementById(id).querySelector("#ceiling-hitbox"), ceilingHitboxes);

	addHitboxToPortalHitboxes(x, y, document.getElementById(id).querySelector("#ship-portal-hitbox"), "ship-portal");
	addHitboxToPortalHitboxes(x, y, document.getElementById(id).querySelector("#cube-portal-hitbox"), "cube-portal");
	addHitboxToPortalHitboxes(x, y, document.getElementById(id).querySelector("#upside-down-portal-hitbox"), "upside-down-portal");
	addHitboxToPortalHitboxes(x, y, document.getElementById(id).querySelector("#normal-gravity-portal-hitbox"), "normal-gravity-portal");

	loadSpecialHitbox(id, x, y);

	return use;

};

// smoothly changes the background/ground color
const changeColor = (type, targetColor, duration) => {
	let element;

	if (type === "bg-trigger") {
		element = document.getElementById("bg");
	} else {
		element = document.getElementById("ground-container");
	}

	// cancels ongoing animations
	for (const animation of element.getAnimations()) {
		animation.cancel();
	}

	if (duration > 0) {
		element.style.transition = `fill ${duration}s linear, color ${duration}s linear`;
		element.style.fill = targetColor;
		element.style.color = targetColor;
	} else {
		element.style.transition = "none";
		element.style.fill = targetColor;
		element.style.color = targetColor;
	}
};

// loads level data
const loadLevel = (levelData) => {

	// empties the level
	level.replaceChildren();
	triggerHitboxes = [];

	levelData.objects.forEach(obj => {
		cloneSvg(obj.id, obj.x, obj.y, obj.rotation, level);

		// adds triggers to `triggerHitboxes`
		if (["bg-trigger", "ground-trigger"].includes(obj.id)) {
			triggerHitboxes.push({
				"x": obj.x,
				"id": obj.id,
				"color": obj.color,
				"duration": obj.duration,
				"triggered": false
			});
		}
	});

};

// updates the player sprite and position
const updatePlayerPos = () => {

	let transform;

	if (gravity < 0) {
		// inverts the sprite if in upside-down gravity
		transform = `translate(0, ${playerY + playerSize}) scale(1, -1)`;
	} else {
		transform = `translate(0, ${playerY})`;
	}

	cube.setAttribute("transform", transform);
	ship.setAttribute("transform", transform);

};

// spawns the player at the beginning of the level and resets variables
const spawnPlayer = () => {

	offset = 0;
	groundOffset = 0;
	alive = true;
	playerY = 330;
	velocity = 0;
	didJump = false;
	isShip = false;
	gravity = Math.abs(gravity);
	fakeGravityMultiplier = 1;
	ceiling.style.display = "none";
	orbHitboxes = [];
	padHitboxes = [];
	onGround = true;
	onCeiling = false;

	for (const object of levelData.objects) {
		if (["jump-orb", "jump-pad"].includes(object.id)) {
			loadSpecialHitbox(object.id, object.x, object.y);
		}
	}

	for (const trigger of triggerHitboxes) {
		trigger.triggered = false;
	}

	const bg = document.getElementById("bg");
	const ground = document.getElementById("ground-container");

	// stops color change animations
	for (element of [bg, ground]) {
		if (!element) return;

		for (const animation of element.getAnimations()) {
			if (typeof animation.commitStyles === "function") {
				animation.commitStyles();
			}
			animation.cancel();
		}
		element.style.transition = "none";
	};

	changeColor("bg-trigger", levelData.startBgColor, 0);
	changeColor("ground-trigger", levelData.startGroundColor, 0);

	updatePlayerPos();

	cube.style.display = "block";
	ship.style.display = "none";
	game.querySelector("text").style.display = "none";

	previousTime = performance.now();

	requestAnimationFrame(mainLoop);

};

// prepares the level and variables
const setUpLevel = (newLevelData) => {

	levelData = newLevelData;
	started = false;
	alive = false;
	offset = 0;
	groundOffset = 0;
	playerY = 330;
	velocity = 0;
	gravity = Math.abs(gravity);
	isShip = false;

	level.setAttribute("transform", "translate(0, 0)");
	groundContainer.setAttribute("transform", "translate(0, 0)");
	ground.setAttribute("transform", "translate(0, 0)");
	ceiling.setAttribute("transform", "translate(0, 0)");

	deathHitboxes = [];
	blockHitboxes = [];
	ceilingHitboxes = [];
	orbHitboxes = [];
	padHitboxes = [];
	portalHitboxes = [];
	triggerHitboxes = [];

	// empties `groundContainer`
	groundContainer.replaceChildren();
	for (const element of game.querySelectorAll('use[href="#cube"], use[href="#ship"]')) {
		element.remove();
	}

	loadLevel(levelData);

	changeColor("bg-trigger", levelData.startBgColor, 0);
	changeColor("ground-trigger", levelData.startGroundColor, 0);

	// create ground/ceiling sections
	for (let x = 0; x <= 5 * groundSize; x += groundSize) {
		cloneSvg("ground", x, groundY, 0, groundContainer);
		cloneSvg("ceiling", x, ceilingY, 0, groundContainer);
	}

	ceiling.style.display = "none";

	lastX = 0;
	for (const hitbox of [...blockHitboxes, ...deathHitboxes]) {
		lastX = Math.max(hitbox.x + hitbox.width, lastX);
	}

	lastX += lastXOffset;

	blockHitboxes.push({
		"x": 0,
		"y": groundY,
		"width": lastX,
		"height": groundSize
	});

	cloneSvg("cube", playerX, 0, 0, game);
	cloneSvg("ship", playerX, 0, 0, game);

	cube.style.display = "block";
	ship.style.display = "none";
	game.querySelector("text").style.display = "none";

	updatePlayerPos();

};

// kills the player and restarts after 1 second
const die = () => {

	const template = document.getElementById("death-effect");

	const clone = template.cloneNode(true);
	clone.removeAttribute("id");
	clone.setAttribute("transform", `translate(${playerX}, ${playerY})`);

	game.appendChild(clone);

	const animates = clone.querySelectorAll("animate");

	for (const animate of animates) {
		animate.beginElement();
	}

	cube.style.display = "none";
	ship.style.display = "none";

	alive = false;

	setTimeout(() => {
		spawnPlayer();
	}, 1000);

};

// checks if player is colliding with a death hitbox
const checkDeathCollision = () => {

	for (hitbox of deathHitboxes) {
		if ((playerX < (hitbox.x + offset + hitbox.width) &&
			(playerX + playerSize) > (hitbox.x + offset) &&
			playerY < (hitbox.y + hitbox.height) &&
			(playerY + playerSize) > hitbox.y) && alive) {
			die();
		}
	}

};

window.addEventListener("keydown", (e) => {
	if (e.repeat) return;

	if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
		keyPress = true;
		didJump = false;
	}
});

window.addEventListener("mousedown", () => {

	keyPress = true;
	didJump = false;

});

window.addEventListener("keyup", ({ key }) => {

	if (key === " " || key === "ArrowUp" || key === "w") {

		keyPress = false;
	}

});

window.addEventListener("mouseup", () => {

	keyPress = false;

});

// performs a jump
const jump = (force) => {

	velocity = force;
	onGround = false;
	didJump = true;

};

// collision with the ground
const groundCheck = () => {

	onGround = false;

	for (const block of blockHitboxes) {
		const blockX = block.x + offset;

		if ((playerX < (blockX + block.width))
			&& ((playerX + playerSize) > blockX)
			&& ((playerY + playerSize) >= block.y)
			&& (playerY < (block.y + block.height)
				&& velocity >= 0)) {
			playerY = block.y - playerSize;
			velocity = 0;
			onGround = true;
			break;
		}
	}

};

// collision with the ceiling (ship gamemode)
const ceilingCheck = () => {

	onCeiling = false;

	for (const block of ceilingHitboxes) {
		const blockX = block.x + offset;

		if ((playerX < (blockX + block.width))
			&& ((playerX + playerSize) > blockX)
			&& (playerY <= (block.y + block.height))
			&& ((playerY + playerSize) > block.y)
			&& velocity <= 0) {
			playerY = block.y + block.height;
			velocity = 0;
			onCeiling = true;
			break;
		}
	}

};

// checks if the player is in an orb/pad hitbox and returns its index in array
const isInSpecialHitbox = (hitboxes) => {

	for (let index = 0; index < hitboxes.length; index++) {
		const hitbox = hitboxes[index];

		if ((playerX < (hitbox.x + offset + hitbox.width) &&
			(playerX + playerSize) > (hitbox.x + offset) &&
			playerY < (hitbox.y + hitbox.height) &&
			(playerY + playerSize) > hitbox.y) && alive) {
			return index;
		}
	}

	return -1;

};

// check if the player is in a portal hitbox and applies its effects
const portalCheck = () => {

	for (hitbox of portalHitboxes) {
		if ((playerX < (hitbox.x + offset + hitbox.width) &&
			(playerX + playerSize) > (hitbox.x + offset) &&
			playerY < (hitbox.y + hitbox.height) &&
			(playerY + playerSize) > hitbox.y) && alive) {

			if (hitbox.id === "ship-portal") {
				isShip = true;
				ship.style.display = "block";
				cube.style.display = "none";
				ceiling.style.display = "block";
			}

			if (hitbox.id === "cube-portal") {
				isShip = false;
				cube.style.display = "block";
				ship.style.display = "none";
				ceiling.style.display = "none";
			}

			if (hitbox.id === "upside-down-portal") {
				if (gravity > 0) {
					velocity = 0;
				}
				gravity = -Math.abs(gravity);
			}

			if (hitbox.id === "normal-gravity-portal") {
				if (gravity < 0) {
					velocity = 0;
				}
				gravity = Math.abs(gravity);
			}
		}
	}

};

// checks if the player is in a trigger hitbox and applies its effects
const triggerCheck = () => {

	for (const trigger of triggerHitboxes) {
		if (!trigger.triggered && (playerX >= trigger.x + offset)) {
			trigger.triggered = true;
			changeColor(trigger.id, trigger.color, trigger.duration);
		}
	}

};

// main game loop
const mainLoop = (time) => {

	if (!alive) {
		return;
	}

	// makes game time independent from framerate
	deltaTime = time - previousTime;
	previousTime = time;

	// limit `deltaTime` to prevent game progressing when browser tab isn't rendered
	if (deltaTime > 144) {
		deltaTime = 144;
	};

	offset -= speed * deltaTime;
	groundOffset -= speed * deltaTime;

	// loop ground/ceiling
	if (groundOffset <= -groundSize) {
		groundOffset += groundSize;
	}

	level.setAttribute("transform", `translate(${offset}, 0)`);
	ground.setAttribute("transform", `translate(${groundOffset}, 0)`);
	ceiling.setAttribute("transform", `translate(${groundOffset}, 0)`);

	checkDeathCollision();

	if (playerY > groundY) {
		die();
	}

	if (isShip) {
		velocity += gravity * fakeGravityMultiplier * shipGravityMultiplier * deltaTime;
	} else {
		velocity += gravity * deltaTime;
	}

	playerY += velocity * deltaTime;

	groundCheck();

	if (isShip || gravity < 0) {
		ceilingCheck();
	}

	if ((playerY < ceilingY + groundSize) && isShip) {
		playerY = ceilingY + groundSize;
		velocity = 0;
	}

	if (keyPress) {
		let orbHitbox = isInSpecialHitbox(orbHitboxes);

		if ((orbHitbox !== -1) && !didJump) {
			jump(orbForce * Math.sign(gravity));
			orbHitboxes.splice(orbHitbox, 1);
		}

		if (isShip) {
			fakeGravityMultiplier = -1; // invert gravity when holding down to create an illusion of flying up
		}
		else if ((gravity > 0 && onGround) || (gravity < 0 && onCeiling)) {
			jump(jumpForce * Math.sign(gravity));
		}
	}
	else {
		fakeGravityMultiplier = 1;
	}

	let padHitbox = isInSpecialHitbox(padHitboxes);

	if (padHitbox !== -1) {
		jump(padForce * Math.sign(gravity));
		padHitboxes.splice(padHitbox, 1);
	}

	portalCheck();
	triggerCheck();

	if ((playerX - offset) >= lastX && alive) {
		alive = false;

		game.querySelector("text").style.display = "block";
	}

	updatePlayerPos();

	requestAnimationFrame(mainLoop);

};

setUpLevel(levelData);

window.addEventListener("load", () => {

	game.addEventListener("mousedown", () => {

		if (!started) {
			started = true;

			spawnPlayer();
		}

	});

});

const radios = document.querySelectorAll("input");

radios.forEach((radio) => {
	radio.addEventListener('change', (event) => {
		if (event.target.checked) {
			switch (event.target.value) {
				case "1":
					levelData = level1Data;
					break;
				case "2":
					levelData = level2Data;
					break;
				case "3":
					levelData = level3Data;
					break;
				case "4":
					levelData = level4Data;
					break;
				default:
					break;
			}

			setUpLevel(levelData);
		}
	});
});
