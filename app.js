// Elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');

const mainCanvas = document.getElementById('mainCanvas');
const previewCanvas = document.getElementById('previewCanvas');
const mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
const previewCtx = previewCanvas.getContext('2d');

const partsCanvas = document.getElementById('partsCanvas');
const partsCtx = partsCanvas.getContext('2d', { willReadFrequently: true });

// Controls Main
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdVal = document.getElementById('thresholdVal');
const imageScaleSlider = document.getElementById('imageScaleSlider');
const imageScaleVal = document.getElementById('imageScaleVal');
const toggleMainEraserBtn = document.getElementById('toggleMainEraser');
const mainEraserSize = document.getElementById('mainEraserSize');
const mainEraserSizeVal = document.getElementById('mainEraserSizeVal');

// Controls Parts
const textInput = document.getElementById('textInput');
const fontSelect = document.getElementById('fontSelect');
const togglePartsEraserBtn = document.getElementById('togglePartsEraser');
const partsEraserSize = document.getElementById('partsEraserSize');
const partsEraserSizeVal = document.getElementById('partsEraserSizeVal');

// Controls Synth
const synthesizeBtn = document.getElementById('synthesizeBtn');
const globalGrayscaleSlider = document.getElementById('globalGrayscaleSlider');
const globalGrayscaleVal = document.getElementById('globalGrayscaleVal');
const thicknessSlider = document.getElementById('thicknessSlider');
const thicknessVal = document.getElementById('thicknessVal');
const stampSizeSlider = document.getElementById('stampSizeSlider');
const stampSizeVal = document.getElementById('stampSizeVal');
const saveBmpBtn = document.getElementById('saveBmpBtn');

// State
let originalImage = null; // HTMLImageElement
let mainEraserActive = false;
let partsEraserActive = false;
let isSynthesized = false; // Flag to show it on main preview
let moveInterval = null;
let mainMaskCanvas = document.createElement('canvas'); 
let mainMaskCtx = mainMaskCanvas.getContext('2d');
let partsMaskCanvas = document.createElement('canvas'); // Persistent eraser for parts
let partsMaskCtx = partsMaskCanvas.getContext('2d');
let binarizedMainData = null; 
let stampX = 0;
let stampY = 0;
let frameSize = 1000; // Default, will be updated to Math.max(W, H) of original image

// History Management
let historyStack = [];
let historyIndex = -1;
const maxHistory = 50;
let isRestoringHistory = false;

const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

// Initialization
function init() {
    // Initial size setup
    partsMaskCanvas.width = partsCanvas.width;
    partsMaskCanvas.height = partsCanvas.height;
    
    updatePartsCanvas(); 

    // Event Listeners for Values
    thresholdSlider.addEventListener('input', (e) => {
        thresholdVal.textContent = e.target.value;
        applyThreshold();
    });
    mainEraserSize.addEventListener('input', (e) => mainEraserSizeVal.textContent = e.target.value);
    partsEraserSize.addEventListener('input', (e) => partsEraserSizeVal.textContent = e.target.value);
    
    imageScaleSlider.addEventListener('input', (e) => {
        imageScaleVal.textContent = e.target.value;
        updateMainImageScale();
    });
    
    // History hooks for sliders
    [thresholdSlider, imageScaleSlider, thicknessSlider, stampSizeSlider, globalGrayscaleSlider].forEach(s => {
        s.addEventListener('change', saveHistoryState);
    });

    document.addEventListener('paste', handlePaste);
    
    // Toggles
    toggleMainEraserBtn.addEventListener('click', () => {
        mainEraserActive = !mainEraserActive;
        toggleMainEraserBtn.classList.toggle('active', mainEraserActive);
        toggleMainEraserBtn.querySelector('.status').textContent = mainEraserActive ? 'ON' : 'OFF';
        document.getElementById('mainCanvasContainer').classList.toggle('eraser-active', mainEraserActive);
    });

    togglePartsEraserBtn.addEventListener('click', () => {
        partsEraserActive = !partsEraserActive;
        togglePartsEraserBtn.classList.toggle('active', partsEraserActive);
        togglePartsEraserBtn.querySelector('.status').textContent = partsEraserActive ? 'ON' : 'OFF';
        document.getElementById('partsCanvasWrapper').classList.toggle('eraser-active', partsEraserActive);
    });

    // File Input / Drop
    fileInput.addEventListener('change', handleFileSelect);
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = 'rgba(0,0,0,0.05)';
    });
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            loadImage(e.dataTransfer.files[0]);
        }
    });

    // Drawing on Main Canvas
    setupDrawing(mainCanvas, mainCtx, () => mainEraserActive, () => mainEraserSize.value, true);
    // Drawing on Parts Canvas
    setupDrawing(partsCanvas, partsCtx, () => partsEraserActive, () => partsEraserSize.value, false);

    // Text Parts
    textInput.addEventListener('input', updatePartsCanvas);
    textInput.addEventListener('change', saveHistoryState); // Save on blur/enter
    fontSelect.addEventListener('change', () => {
        updatePartsCanvas();
        updateMainRendering();
        saveHistoryState();
    });

    // Reset mask if text input is cleared? (Optional)
    textInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'r') { // Hidden reset shortcut
            partsMaskCtx.clearRect(0, 0, partsMaskCanvas.width, partsMaskCanvas.height);
            updatePartsCanvas();
        }
    });

    // Layout Synthesis
    synthesizeBtn.addEventListener('click', () => {
        isSynthesized = true;
        updatePartsCanvas();
        processAndPlaceStamp();
        saveHistoryState();
    });
    
    globalGrayscaleSlider.addEventListener('input', () => {
        const pctValues = [20, 30, 40, 50, 100];
        const pct = pctValues[parseInt(globalGrayscaleSlider.value)];
        globalGrayscaleVal.textContent = pct;
        updateGlobalGrayscale();
    });
    
    thicknessSlider.addEventListener('input', () => {
        thicknessVal.textContent = thicknessSlider.value;
        updatePartsCanvas();
        updateMainRendering();
    });

    stampSizeSlider.addEventListener('input', () => {
        stampSizeVal.textContent = stampSizeSlider.value;
        updatePartsCanvas();
        updateMainRendering();
    });

    // Save
    saveBmpBtn.addEventListener('click', exportBMP);

    // Save initial state
    setTimeout(saveHistoryState, 500);

    // Initial Grayscale
    updateGlobalGrayscale();

    // Undo/Redo Events
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });

    // Arrow controls
    setupArrowControls();
}

// ----------------------------------------
// History Logic
// ----------------------------------------
async function saveHistoryState() {
    if (isRestoringHistory) return;

    const state = {
        threshold: thresholdSlider.value,
        imageScale: imageScaleSlider.value,
        mainMask: mainMaskCanvas.toDataURL(),
        partsMask: partsMaskCanvas.toDataURL(),
        stampX: stampX,
        stampY: stampY,
        stampSize: stampSizeSlider.value,
        thickness: thicknessSlider.value,
        text: textInput.value,
        font: fontSelect.value,
        isSynthesized: isSynthesized,
        globalGrayscale: globalGrayscaleSlider.value
    };

    // Remove future states if we were in the middle of undo
    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }

    historyStack.push(state);
    if (historyStack.length > maxHistory) {
        historyStack.shift();
    }
    historyIndex = historyStack.length - 1;
    updateHistoryButtons();
}

function updateHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

async function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        await applyHistoryState(historyStack[historyIndex]);
    }
}

async function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        await applyHistoryState(historyStack[historyIndex]);
    }
}

async function applyHistoryState(state) {
    isRestoringHistory = true;

    thresholdSlider.value = state.threshold;
    thresholdVal.textContent = state.threshold;
    imageScaleSlider.value = state.imageScale;
    imageScaleVal.textContent = state.imageScale;
    stampX = state.stampX;
    stampY = state.stampY;
    stampSizeSlider.value = state.stampSize;
    stampSizeVal.textContent = state.stampSize;
    thicknessSlider.value = state.thickness;
    thicknessVal.textContent = state.thickness;
    textInput.value = state.text;
    fontSelect.value = state.font;
    isSynthesized = state.isSynthesized;
    globalGrayscaleSlider.value = state.globalGrayscale;

    // Restore Global Grayscale Visual
    const pctValues = [20, 30, 40, 50, 100];
    const pct = pctValues[parseInt(state.globalGrayscale)];
    const container = document.getElementById('mainCanvasContainer');
    if (container) container.style.opacity = pct / 100;

    // Restore masks
    const restoreMask = (canvas, ctx, dataURL) => {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                resolve();
            };
            img.src = dataURL;
        });
    };

    // Ensure canvases match the square frameSize
    if (originalImage) {
        frameSize = Math.max(originalImage.width, originalImage.height);
        mainCanvas.width = frameSize;
        mainCanvas.height = frameSize;
        previewCanvas.width = frameSize;
        previewCanvas.height = frameSize;
        mainMaskCanvas.width = frameSize;
        mainMaskCanvas.height = frameSize;
        partsMaskCanvas.width = frameSize;
        partsMaskCanvas.height = frameSize;
    }

    await Promise.all([
        restoreMask(mainMaskCanvas, mainMaskCtx, state.mainMask),
        restoreMask(partsMaskCanvas, partsMaskCtx, state.partsMask)
    ]);

    // Re-render
    applyThreshold();
    updatePartsCanvas();
    updateMainRendering();
    
    isRestoringHistory = false;
    updateHistoryButtons();
}

function updateGlobalGrayscale() {
    const pctValues = [20, 30, 40, 50, 100];
    const pct = pctValues[parseInt(globalGrayscaleSlider.value)];
    const factor = pct / 100;
    const container = document.getElementById('mainCanvasContainer');
    if (container) {
        container.style.opacity = factor;
    }
    // Ensure individual canvases are opaque relative to the container
    mainCanvas.style.opacity = 1;
    previewCanvas.style.opacity = 1;
}

// ----------------------------------------
// Image Loading & Main Canvas
// ----------------------------------------
function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
        loadImage(e.target.files[0]);
    }
}

function handlePaste(e) {
    if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                loadImage(blob);
                break;
            }
        }
    }
}

function loadImage(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            
            // Frame size setup: always a square based on the larger dimension
            frameSize = Math.max(img.width, img.height);
            
            mainMaskCanvas.width = frameSize;
            mainMaskCanvas.height = frameSize;
            mainMaskCtx.clearRect(0, 0, frameSize, frameSize);

            partsMaskCanvas.width = frameSize;
            partsMaskCanvas.height = frameSize;
            partsMaskCtx.clearRect(0, 0, frameSize, frameSize);
            
            // Initial stamp position (center of frame)
            stampX = frameSize / 2;
            stampY = frameSize / 2;

            imageScaleSlider.value = 100;
            imageScaleVal.textContent = 100;
            updateMainImageScale();
            dropZone.classList.add('hidden');
            saveHistoryState();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateMainImageScale() {
    if (!originalImage) return;
    
    // Both canvases are now fixed to the square frameSize
    mainCanvas.width = frameSize;
    mainCanvas.height = frameSize;
    previewCanvas.width = frameSize;
    previewCanvas.height = frameSize;
    
    applyThreshold();
}

function applyThreshold() {
    if (!originalImage) return;
    
    // Clear and draw original image centered and scaled in the square frame
    const scale = parseInt(imageScaleSlider.value) / 100;
    const drawW = originalImage.width * scale;
    const drawH = originalImage.height * scale;
    const drawX = (frameSize - drawW) / 2;
    const drawY = (frameSize - drawH) / 2;

    const off = document.createElement('canvas');
    off.width = frameSize;
    off.height = frameSize;
    const octx = off.getContext('2d');
    octx.drawImage(originalImage, drawX, drawY, drawW, drawH);
    
    const imgData = octx.getImageData(0, 0, frameSize, frameSize);
    const data = imgData.data;
    const thresh = parseInt(thresholdSlider.value);
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const brightness = Math.max(r, g, b); // simple brightness
        if (brightness >= thresh) {
            data[i] = 255;
            data[i+1] = 255;
            data[i+2] = 255;
            data[i+3] = 0; // Transparent (Background)
        } else {
            data[i] = 0;
            data[i+1] = 0;
            data[i+2] = 0;
            data[i+3] = 255; // Opaque (Line)
        }
    }
    binarizedMainData = imgData;
    updateMainRendering();
}

function updateMainRendering() {
    if (!binarizedMainData) return;
    
    // Apply morphology to the background (it works on alpha)
    const thickened = applyMorphology(binarizedMainData);
    
    // Fill mainCanvas with WHITE first (since background is now transparent in binarizedMainData)
    mainCtx.fillStyle = '#FFFFFF';
    mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
    
    // Put the thickened black lines
    // We can't use putImageData directly because it overwrites the white background.
    // So we use a temp canvas to draw it with transparency blending.
    const temp = document.createElement('canvas');
    temp.width = mainCanvas.width;
    temp.height = mainCanvas.height;
    temp.getContext('2d').putImageData(thickened, 0, 0);
    mainCtx.drawImage(temp, 0, 0);
    
    // Apply persistent mask (eraser)
    mainCtx.globalCompositeOperation = 'destination-out';
    mainCtx.drawImage(mainMaskCanvas, 0, 0);
    mainCtx.globalCompositeOperation = 'source-over';
    
    renderPreview();
}

function updatePartsCanvas() {
    const text = textInput.value;
    const font = fontSelect.value;
    
    // Base font size is now relative to the frameSize
    const baseFontSize = frameSize * 0.15; 
    const scale = parseInt(stampSizeSlider.value) / 100;
    const fontSize = baseFontSize * scale;

    partsCanvas.width = frameSize;
    partsCanvas.height = frameSize;
    const octx = partsCanvas.getContext('2d');
    octx.clearRect(0, 0, frameSize, frameSize);
    
    octx.font = `${fontSize}px ${font}`;
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillStyle = '#000000';
    octx.fillText(text, frameSize/2, frameSize/2);

    const partsData = octx.getImageData(0, 0, frameSize, frameSize);
    const processed = applyMorphology(partsData);
    
    partsCtx.clearRect(0, 0, frameSize, frameSize);
    partsCtx.putImageData(processed, 0, 0);
    
    // Apply persistent mask (parts eraser)
    partsCtx.globalCompositeOperation = 'destination-out';
    partsCtx.drawImage(partsMaskCanvas, 0, 0);
    partsCtx.globalCompositeOperation = 'source-over';
}

// ----------------------------------------
// Drawing Logic (Erasers)
// ----------------------------------------
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // For object-fit contain, boundingClientRect gives the element size, not the drawn image size.
    // If canvas size and element aspect ratio differ, object-fit handles it.
    // Let's assume the element matches aspect ratio exactly for simplicity, 
    // but if not, this standard calculation can be slightly off.
    // Using absolute positioning and max-width/max-height, the clientRect fits the canvas usually.
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

function setupDrawing(canvas, ctx, isActiveFn, getSizeFn, isMain) {
    let isDrawing = false;
    let lastPos = null;

    canvas.addEventListener('mousedown', (e) => {
        if (!isActiveFn()) return;
        isDrawing = true;
        lastPos = getMousePos(canvas, e);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !isActiveFn()) return;
        const currentPos = getMousePos(canvas, e);
        
        ctx.beginPath();
        if (isMain) {
            // Draw on the persistent mask canvas instead
            mainMaskCtx.globalCompositeOperation = 'source-over';
            mainMaskCtx.strokeStyle = 'rgba(0,0,0,1)';
            mainMaskCtx.lineCap = 'round';
            mainMaskCtx.lineJoin = 'round';
            mainMaskCtx.lineWidth = parseInt(getSizeFn());
            mainMaskCtx.moveTo(lastPos.x, lastPos.y);
            mainMaskCtx.lineTo(currentPos.x, currentPos.y);
            mainMaskCtx.stroke();
            
            // Immediately apply visual feedback
            updateMainRendering();
        } else {
            // Draw on the persistent parts mask canvas
            partsMaskCtx.globalCompositeOperation = 'source-over';
            partsMaskCtx.strokeStyle = 'rgba(0,0,0,1)';
            partsMaskCtx.lineCap = 'round';
            partsMaskCtx.lineJoin = 'round';
            partsMaskCtx.lineWidth = parseInt(getSizeFn());
            partsMaskCtx.moveTo(lastPos.x, lastPos.y);
            partsMaskCtx.lineTo(currentPos.x, currentPos.y);
            partsMaskCtx.stroke();
            
            // Immediately apply to parts preview
            updatePartsCanvas();
            if (isSynthesized) renderPreview();
        }
        
        lastPos = currentPos;
    });

    document.addEventListener('mouseup', () => {
        if (isDrawing) {
            isDrawing = false;
            saveHistoryState();
        }
    });
}

// ----------------------------------------
// Synthesis & Morphology logic
// ----------------------------------------
function processAndPlaceStamp() {
    if (!originalImage) return;
    updateMainRendering();
}

function applyMorphology(imgData) {
    const thickness = parseInt(thicknessSlider.value); // 1 to 5
    if (thickness === 3) return imgData; // Normal
    
    // Increased power for very obvious changes
    let step = Math.abs(thickness - 3);
    let iterations = step * 3; // 3 iterations per level
    let type = thickness > 3 ? 1 : -1; // 1: Dilation, -1: Erosion
    
    let w = imgData.width;
    let h = imgData.height;
    let currentData = new Uint8ClampedArray(imgData.data);
    
    for (let iter = 0; iter < iterations; iter++) {
        let newData = new Uint8ClampedArray(currentData.length);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let extremeA = (type === 1) ? 0 : 255;
                
                // Square 3x3 block check
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        let ny = y + ky, nx = x + kx;
                        if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                            let a = currentData[(ny * w + nx) * 4 + 3];
                            if (type === 1) { if (a > extremeA) extremeA = a; }
                            else { if (a < extremeA) extremeA = a; }
                        } else if (type === -1) {
                            // Erosion at border should shrink
                            extremeA = 0;
                            break; 
                        }
                    }
                    if (type === -1 && extremeA === 0) break;
                }
                
                let idx = (y * w + x) * 4;
                // Keep color black (0,0,0) as per spec for parts
                newData[idx] = 0;
                newData[idx+1] = 0;
                newData[idx+2] = 0;
                newData[idx+3] = extremeA;
            }
        }
        currentData = newData;
    }
    
    return new ImageData(currentData, w, h);
}

function renderPreview() {
    if (!isSynthesized) return;
    previewCtx.clearRect(0, 0, frameSize, frameSize);
    
    // Since partsCanvas is now a full frame with centered text,
    // we calculate movement relative to the center.
    const dx = stampX - frameSize / 2;
    const dy = stampY - frameSize / 2;
    
    previewCtx.drawImage(partsCanvas, dx, dy);
}

// ----------------------------------------
// Arrow Controls
// ----------------------------------------
function setupArrowControls() {
    const speed = 5;
    const btns = {
        'btnUp': {x: 0, y: -speed},
        'btnDown': {x: 0, y: speed},
        'btnLeft': {x: -speed, y: 0},
        'btnRight': {x: speed, y: 0}
    };

    for (let id in btns) {
        const btn = document.getElementById(id);
        
        const startMove = (e) => {
            e.preventDefault();
            if(!isSynthesized) return;
            if (moveInterval) clearInterval(moveInterval);
            moveInterval = setInterval(() => {
                stampX += btns[id].x;
                stampY += btns[id].y;
                renderPreview();
            }, 30);
        };
        
        const stopMove = () => {
            if (moveInterval) {
                clearInterval(moveInterval);
                moveInterval = null;
                saveHistoryState();
            }
        };

        btn.addEventListener('mousedown', startMove);
        btn.addEventListener('touchstart', startMove, {passive: false});
        
        btn.addEventListener('mouseup', stopMove);
        btn.addEventListener('mouseleave', stopMove);
        btn.addEventListener('touchend', stopMove);
    }
}

// ----------------------------------------
// Save to BMP
// ----------------------------------------
async function exportBMP() {
    if (!originalImage) {
        alert("画像が読み込まれていません。");
        return;
    }
    
    // The export size is now exactly the frameSize (the square seen in the browser)
    const temp = document.createElement('canvas');
    temp.width = frameSize;
    temp.height = frameSize;
    const ctx = temp.getContext('2d');
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, frameSize, frameSize);
    
    // Create a temporary composite at full opacity
    const composite = document.createElement('canvas');
    composite.width = frameSize;
    composite.height = frameSize;
    const compCtx = composite.getContext('2d');
    compCtx.drawImage(mainCanvas, 0, 0);
    compCtx.globalCompositeOperation = 'darken';
    compCtx.drawImage(previewCanvas, 0, 0);
    compCtx.globalCompositeOperation = 'source-over';
    
    // Final result with global alpha
    const pctValues = [20, 30, 40, 50, 100];
    const pct = pctValues[parseInt(globalGrayscaleSlider.value)];
    ctx.globalAlpha = pct / 100;
    ctx.drawImage(composite, 0, 0);
    ctx.globalAlpha = 1.0;
    
    const finalImgData = ctx.getImageData(0, 0, frameSize, frameSize);
    const blob = encodeBMP(finalImgData);
    
    // Modern 'Save As' Dialog
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: `synthesized_${Date.now()}.bmp`,
                types: [{
                    description: 'BMP Image',
                    accept: {'image/bmp': ['.bmp']},
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            alert("保存しました。");
        } catch (err) {
            // User cancelled or error
            console.log("Save cancelled or failed", err);
        }
    } else {
        // Fallback for older browsers
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `synthesized_${Date.now()}.bmp`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Simple 24-bit BMP Encoder
function encodeBMP(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;
    
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    
    // Header
    view.setUint16(0, 0x424D, false); // BM (Magic Number)
    view.setUint32(2, fileSize, true);
    view.setUint32(6, 0, true);
    view.setUint32(10, 54, true); // Offset
    
    // DIB Header
    view.setUint32(14, 40, true); 
    view.setInt32(18, width, true);
    view.setInt32(22, height, true); // Positive height for classic Bottom-Up
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true); // 24 bpp
    view.setUint32(30, 0, true);
    view.setUint32(34, pixelArraySize, true);
    view.setInt32(38, 0, true); // 0 for compatibility
    view.setInt32(42, 0, true); 
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);
    
    let offset = 54;
    for (let y = 0; y < height; y++) {
        // BMP lines are stored bottom-to-top
        let sourceY = height - 1 - y;
        let rowStart = offset + y * rowSize;
        for (let x = 0; x < width; x++) {
            let p = (sourceY * width + x) * 4;
            let r = data[p];
            let g = data[p+1];
            let b = data[p+2];
            let a = data[p+3] / 255;
            
            // Blend with white if transparent
            let outB = Math.round(b * a + 255 * (1 - a));
            let outG = Math.round(g * a + 255 * (1 - a));
            let outR = Math.round(r * a + 255 * (1 - a));
            
            view.setUint8(rowStart + x * 3, outB);
            view.setUint8(rowStart + x * 3 + 1, outG);
            view.setUint8(rowStart + x * 3 + 2, outR);
        }
        // Padding bytes in rowSize are already 0 by ArrayBuffer init
    }
    
    return new Blob([buffer], { type: "image/bmp" });
}

// Start
init();
