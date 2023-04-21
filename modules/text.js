// A sub-region of the canvas that requests text input and draws each word to
// the screen.
class TextRegion {
    constructor(ctx, x, y, width, height) {
	let fontSize = parseInt(ctx.font)

	// Constant: fixed properties of the writeable text region
	this.ctx = ctx,
	this.width = width;
	this.height = height;
	this.xMin = x;
	this.yMin = y;
	this.xMax = Math.floor(this.xMin + this.width);
	this.yMax = Math.floor(this.yMin + this.height);

	// These parameters work pretty well for the default serif font in Chrome.
	// TODO to test in other browers.
	this.inputMargin = fontSize;
	this.lineSpace = fontSize * 1.25;
	this.spaceWidth = ctx.measureText('\s').width * 0.68;
	this.tabWidth = 5 * this.spaceWidth;
	this.xOverflow = Math.floor(this.width * 0.05); // allow in-progress words to overflow horizontally

	// Mutable: current position and text state
	this.x = this.xMin;
	this.y = this.yMin;
	this.words = []; // array of `Word`s
	this.index = 0; // index into `words` array
	this.allowInput = true;
	this.timeSinceUpdate = 0;

	// Create the initial input element
	this.input = this.newInput("");
    }

    render() {
	for (const word of this.words) {
	    word.render();
	}
    }

    newInput(value) {
	let input = document.createElement('input');
	input.type = 'text';
	input.value = value;
	input.style.font = this.ctx.font;
	input.style.width = (this.ctx.measureText(value).width
			     + this.inputMargin) + 'px';
	input.style.position = 'absolute';
	input.style.color = '#666666'; // medium gray while typing
	input.style.left = this.x + 'px';
	input.style.top = this.y + 'px';

	input.placeholder = "";
	input.onkeydown = this.handleInputChar.bind(this);;
	document.body.appendChild(input);
	input.focus();
	return input;
    }

    handleInputChar(e) {
	this.timeSinceUpdate = 0;
	let inputWidth = this.ctx.measureText(this.input.value).width;
	// When backspacing across a word boundary, recreate the previous
	// input element for editing.
	if (e.code === 'Backspace') {
	    if (this.index > 0 && this.input.value.length === 0) {
		let val = this.rewindCursor();
		this.input.parentNode.removeChild(this.input);
		this.input = this.newInput(val);
	    }
	    this.allowInput = true;
	    return;
	}
	// Don't allow non-backspace input when the text region is full.
	if (!this.allowInput) {
	    e.preventDefault();
	    this.input.value = "";
	    return;
	}
	// Handle (some) whitespace characters by finalizing the input,
	// if any, and advancing the cursor.
	if (e.code === 'Space' || e.code === 'Tab' || e.code === 'Enter') {
	    e.preventDefault();
	    let width = 0;
	    if (this.input.value.length > 0) {
		width += inputWidth;
		this.storeInput();
	    }
	    this.x += width;

	    if (e.code === 'Space') {
		if (this.x + this.spaceWidth <= this.xMax) {
		    this.x += this.spaceWidth;
		} else if (this.y + this.lineSpace <= this.yMax) {
		    this.newLine();
		} else {
		    this.allowInput = false;
		}
	    } else if (e.code === 'Tab') {
		if (this.x + this.tabWidth <= this.xMax) {
		    this.x += this.tabWidth;
		} else if (this.y + this.lineSpace <= this.yMax) {
		    this.newLine();
		} else {
		    this.allowInput = false;
		}
	    } else if (e.code === 'Enter') {
		if (this.y + this.lineSpace <= this.yMax) {
		    this.newLine();
		} else if ((this.input.value.length === 0
			    && this.x + inputWidth > this.xMax)
			   || (this.input.value.length > 0
			       && this.x + inputWidth
			       > this.xMax + this.xOverflow)) {
		    this.allowInput = false;
		} else {
		    this.x += this.spaceWidth;
		}
	    }

	    this.input.parentNode.removeChild(this.input);
	    this.input = this.newInput("");
	}
	// If the input width takes up a full line, finalize it and start
	// a new line. If that would overflow the text region's height,
	// create a new input element on the same line to allow backspacing.
	else if (inputWidth >= this.width + this.xOverflow) {
	    this.storeInput();
	    if (this.y + this.lineSpace > this.yMax) {
		e.preventDefault();
		this.x += this.inputWidth;
		this.allowInput = false;
	    } else {
		this.newLine();
	    }
	    this.input.parentNode.removeChild(this.input);
	    this.input = this.newInput("");
	}
	// If input overflows the text region's width, try starting
	// a new line. If that would overflow the text region's height,
	// create a new input element on the same line to allow backspacing.
	else if ((this.input.value.length === 0
		  && this.x + inputWidth > this.xMax) ||
		 (this.input.value.length > 0
		  && this.x + inputWidth > this.xMax + this.xOverflow)) {
	    if (this.y + this.lineSpace >= this.yMax) {
		e.preventDefault();
		this.storeInput();
		this.x += inputWidth;

		this.input.parentNode.removeChild(this.input);
		this.input = this.newInput("");
		this.allowInput = false;
		return;
	    }
	    this.newLine();
	    let val = this.input.value;
	    this.input.parentNode.removeChild(this.input);
	    this.input = this.newInput(val);
	}
	// Resize the input element to fit the current text
	this.input.style.width = (inputWidth + this.inputMargin) + 'px';
    }

    newLine() {
	this.x = this.xMin;
	this.y += this.lineSpace;
    }

    storeInput() {
	let rect = this.input.getBoundingClientRect();
	let word = new Word(
	    this.ctx,
	    this.input.value,
	    rect.x,
	    rect.y,
	    rect.height,
	);
	this.words.push(word);
	this.index++;
    }

    // Removes a word from storage and returns its text, allowing the caller
    // to edit the text and store it again if needed.
    rewindCursor() {
	this.index--;
	let word = this.words.pop();
	this.x = word.xMin;
	this.y = word.yMin;
	return word.text;
    }
}

class Word {
    // `x` and `y` are the coordinates of the upper left corner
    // of the box containing `text`.
    //
    // The height of the box is set equal to the height of the input
    // element in which the text was entered. When the box is rendered,
    // the bottom baseline of the text is set to the y-coordinate of the
    // lower edge of that input element.
    constructor(ctx, text, x, y, height) {
	this.ctx = ctx;
	this.text = text;
	this.width = this.ctx.measureText(text).width;
	this.height = height;
	this.xMin = x;
	this.xMax = x + this.width;
	this.yMin = y;
	this.yMax = y + this.height;
    }

    render() {
	this.ctx.textBaseline = "bottom";
	this.ctx.fillStyle = '#000000';
	this.ctx.fillText(this.text, this.xMin, this.yMax);
    }
}

export { TextRegion, Word }
