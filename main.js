import { TextRegion, Word } from "./modules/text.js";
import init, { Universe } from "./pkg/vinesweeper.js";

const canvas = document.getElementById("vinesweeper-canvas");
const dpr = window.devicePixelRatio || 1;
const ctx = canvas.getContext('2d');
const minFontSize = 14;
const maxFontSize = 24;
// Wait this many ticks after the last text entry before starting the animation.
const timeOut = 500;
// Thickness (in px) of all solid walls in the simulation.
const wallThickness = 10;
// Margin between solid walls and the edge of the window.
const wallMargin = 100;

let wasm = undefined;
let fontSize = 0;
let font = undefined;
let text = undefined;
let universe = undefined;

async function initWasm() {
    wasm = await init();
}

// If the text region is currently empty, resize the canvas according to the
// window size. Otherwise, keep the current canvas size.
function setup() {
    if (text != undefined && text.words.length != 0) {
	return;
    }
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Adapt the canvas resolution to the screen resolution:
    //
    // Scale up the canvas contents by the device pixel ratio...
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    // ...then set the displayed canvas dimensions equal to the original
    // dimensions
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // Adjust the font size according to the window height
    fontSize = Math.min(Math.max(minFontSize, Math.floor(height * 0.022)), maxFontSize);
    font = `${fontSize}px serif`;
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // Clean up any existing input elements
    document.querySelectorAll('input').forEach((e) => {
	e.remove();
    });

    // Create a new text region in the center of the canvas
    let textWidth = Math.floor(0.625 * width);
    let textHeight = Math.floor(0.625 * height);
    let textX = Math.floor(((width - textWidth) / 2) + canvas.offsetLeft);
    let textY = Math.floor(((height - textHeight) / 2) + canvas.offsetTop);
    text = new TextRegion(ctx, textX, textY, textWidth, textHeight);
}

function renderLoop() {
    text.timeSinceUpdate++;
    if (text.timeSinceUpdate === timeOut) {
	let startAnimation = () => {
	    document.querySelectorAll('input').forEach((e) => {
		e.remove();
	    });
	    let words = text.words;
	    universe = Universe.new();

	    // Add a floor just above the lower edge of the window.
	    universe.add_wall(window.innerWidth / 2, window.innerHeight - wallMargin, window.innerWidth, wallThickness);
	    // Add walls on the left- and right-hand sides of the window.
	    universe.add_wall(wallMargin, window.innerHeight / 2, wallThickness, window.innerHeight);
	    universe.add_wall(window.innerWidth - wallMargin, window.innerHeight / 2, wallThickness, window.innerHeight);

	    // Pass the text to wasm.
	    for (let i = 0; i < words.length; i++) {
		let w = words[i];
		universe.add_word(w.xMin, w.yMax, w.width, w.height, w.text);
	    }
	    console.log("starting animation loop!");

	    let animateLoop = () => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		universe.tick();
		requestAnimationFrame(animateLoop.bind(this));
	    };
	    animateLoop();
	};
	startAnimation();
    } else if (text.timeSinceUpdate < timeOut) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	text.render();
	requestAnimationFrame(renderLoop.bind(this));
    }
}

initWasm();
window.addEventListener('resize', setup);
setup();
renderLoop();

/// Test-only functions.
/// All of these functions assume that the animation loop has not yet started
/// and have no visible effect while it's running.

/// Uncomment the next line to make test functions callable from the console.
// debugSetup()

// Starts the animation loop.
function run() {
    if (timeOut === 0) {
	return;
    }
    text.timeSinceUpdate = timeOut - 1;
}

// Populates the text region with a block of text, n times.
function testLayout(n, str) {
    const defaultStr = "\tMeditations of evolution increasingly vaster: of the moon invisible in incipient lunation, approaching perigee: of the infinite lattiginous scintillating uncondensed milky way, discernible by daylight by an observer placed at the lower end of a cylindrical vertical shaft 5000 ft deep sunk from the surface towards the centre of the earth: of Sirius (alpha in Canis Maior) 10 lightyears (57,000,000,000,000 miles) distant and in volume 900 times the dimension of our planet: of Arcturus: of the precession of equinoxes: of Orion with belt and sextuple sun theta and nebula in which 100 of our solar systems could be contained: of moribund and of nascent new stars such as Nova in 1901: of our system plunging towards the constellation of Hercules: of the parallax or parallactic drift of socalled fixed stars, in reality evermoving wanderers from immeasurably remote eons to infinitely remote futures in comparison with which the years, threescore and ten, of allotted human life formed a parenthesis of infinitesimal brevity.\n";
    if (str === undefined) {
	str = defaultStr;
    }
    if (n === undefined) {
	n = 1;
    }

    reset();
    for (let i = 0; i < n; i++) {
	appendText(str);
    }
}

// Clears the canvas and text region.
function reset() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.querySelectorAll('input').forEach((e) => {
	e.remove();
    });
    text = undefined;
    setup();
}

// Appends a block of text to the text region.
function appendText(str) {
    const iter = str[Symbol.iterator]();
    let c = iter.next();
    while (!c.done) {
	let e = fakeKeyDownEvent(c.value);
	// Fake the default behavior of `text.input` on keydown,
	// then dispatch the event
	if (/[!-~]/.test(c.value)) {
	    text.input.value += e.key;
	} else if (c.value == '\b' && text.input.value.length > 0) {
	    text.input.value = text.input.value.slice(0, -1);
	}
	text.input.dispatchEvent(e);
	c = iter.next();
    }
}

// Replaces the contents of the text region.
function replaceText(str) {
    reset();
    appendText(str);
}

// A rough simulation of the `keydown` events corresponding to some
// ASCII characters.
function fakeKeyDownEvent(c) {
    let keyCode = "";
    if (c === ' ') {
        keyCode = 'Space';
    } else if (c === '\t') {
        keyCode = 'Tab';
    } else if (c === '\n') {
        keyCode = 'Enter';
    } else if (c === '\b') {
	keyCode = 'Backspace';
    }
    return new KeyboardEvent(
	'keydown',
	{key: c, code: keyCode}
    );
}

function debugSetup() {
    window.testLayout = testLayout;
    window.run = run;
    window.reset = reset;
    window.appendText = appendText;
    window.replaceText = replaceText;
}
