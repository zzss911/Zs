document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('doodleArea');
    const ctx = canvas.getContext('2d');
    const playSoundButton = document.getElementById('playSoundButton');
    const clearButton = document.getElementById('clearButton');
    const colorBrushes = document.querySelectorAll('.color-brush');
    const brushSizeInput = document.getElementById('brushSize');
    const instructions = document.querySelector('.instructions');

    const canvasWidth = Math.min(600, window.innerWidth - 60);
    const canvasHeight = 400;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    let isDrawing = false;
    let currentBrushColor = '#FF0000';
    let currentBrushSize = 5;
    let drawnPoints = []; // Store individual points: {x, y, color, size}

    let audioCtx;

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // --- Drawing Logic ---
    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        const clientX = evt.clientX || (evt.touches && evt.touches[0].clientX);
        const clientY = evt.clientY || (evt.touches && evt.touches[0].clientY);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        isDrawing = true;
        // No currentPath needed, we store individual points
        const pos = getMousePos(e);
        addPoint(pos.x, pos.y);

        if (e.touches) e.preventDefault();
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        addPoint(pos.x, pos.y);
        if (e.touches) e.preventDefault();
    }

    function addPoint(x, y) {
        // Draw the point
        ctx.beginPath();
        ctx.fillStyle = currentBrushColor;
        ctx.arc(x, y, currentBrushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        // Store the point
        drawnPoints.push({ x, y, color: currentBrushColor, size: currentBrushSize });
    }

    function stopDrawing() {
        isDrawing = false;
    }

    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawnPoints = [];
        console.log("Canvas cleared");
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    clearButton.addEventListener('click', clearCanvas);

    colorBrushes.forEach(brush => {
        brush.addEventListener('click', () => {
            colorBrushes.forEach(b => b.classList.remove('active'));
            brush.classList.add('active');
            currentBrushColor = brush.dataset.color;
        });
    });

    brushSizeInput.addEventListener('input', (e) => {
        currentBrushSize = parseInt(e.target.value, 10);
    });

    // --- Music Box Sound Logic ---

    function midiToFreq(midi) {
        return Math.pow(2, (midi - 69) / 12) * 440;
    }

    function mapRange(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    // Define a harmonious scale (e.g., C Major Pentatonic for simplicity and pleasantness)
    // Intervals in semitones from the root:
    // Major Scale: [0, 2, 4, 5, 7, 9, 11]
    // Major Pentatonic: [0, 2, 4, 7, 9]
    // Minor Pentatonic: [0, 3, 5, 7, 10]
    const PENTATONIC_MAJOR_INTERVALS = [0, 2, 4, 7, 9]; // C, D, E, G, A (if root is C)
    const DIATONIC_MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // C,D,E,F,G,A,B

    let selectedScaleIntervals = DIATONIC_MAJOR_INTERVALS; // Default to Diatonic Major

    function createMusicBoxTone(time, midiNote, velocity = 0.3, duration = 1.0) {
        const localAudioCtx = getAudioContext();
        if (!localAudioCtx) return;

        const fundamentalFreq = midiToFreq(midiNote);

        // Music box tines have a bright, somewhat metallic sound.
        // We can simulate this with a few sine waves with specific frequency ratios and envelopes.
        // These ratios are for a 'bright pluck' sound. Experimentation is key.
        const overtoneRatios = [1, 2.01, 3.03, 4.05, 5.8]; // Slightly inharmonic for metallic character
        const overtoneGains = [1, 0.7, 0.5, 0.3, 0.15]; // Relative gains

        const masterGain = localAudioCtx.createGain();
        masterGain.connect(localAudioCtx.destination);

        // Envelope: Fast attack, fairly quick decay
        masterGain.gain.setValueAtTime(0, time);
        masterGain.gain.linearRampToValueAtTime(velocity, time + 0.005); // Very fast attack
        masterGain.gain.exponentialRampToValueAtTime(velocity * 0.1, time + duration * 0.3); // Initial decay
        masterGain.gain.exponentialRampToValueAtTime(0.0001, time + duration); // Full decay

        overtoneRatios.forEach((ratio, index) => {
            const osc = localAudioCtx.createOscillator();
            const overtoneGainNode = localAudioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(fundamentalFreq * ratio, time);
            overtoneGainNode.gain.setValueAtTime(overtoneGains[index] || 0.1, time);

            osc.connect(overtoneGainNode);
            overtoneGainNode.connect(masterGain);

            osc.start(time);
            osc.stop(time + duration + 0.1); // Ensure oscillator stops
        });
    }

    function getColorOctaveAndScale(color) {
        // Use color to define root note's octave or even a different root for a different "key"
        // Or even different scales, but let's keep it simple with octaves for now.
        let octaveOffset = 0;
        let scale = DIATONIC_MAJOR_INTERVALS; // Default C-Major like scale

        switch (color.toUpperCase()) {
            case '#FF0000': octaveOffset = 0; break;    // Red: Base octave (e.g. C4 region)
            case '#00FF00': octaveOffset = 12; break;   // Green: +1 Octave
            case '#0000FF': octaveOffset = -12; break;  // Blue: -1 Octave
            case '#FFFF00': // Yellow - let's try a different pleasant scale (e.g. G Major Pentatonic)
                octaveOffset = 0; // Relative to a G root
                // Or, for a different character, use a different scale type on the same root
                // scale = PENTATONIC_MAJOR_INTERVALS;
                break;
            case '#000000': octaveOffset = 0; break;    // Black: Base octave
            default: octaveOffset = 0;
        }
        return { octaveOffset, scale };
    }


    playSoundButton.addEventListener('click', () => {
        if (drawnPoints.length === 0) {
            console.log("Nothing to play.");
            return;
        }
        console.log("Playing music box sounds...");

        const localAudioCtx = getAudioContext();
        let sortedPoints = [...drawnPoints].sort((a, b) => a.x - b.x);

        const totalPlaybackDuration = 8; // Longer duration for music box feel
        const baseMidiRootNote = 60; // C4 as the root of our scales

        // For quantization, we can divide the canvas into "time steps"
        const numTimeSteps = Math.floor(totalPlaybackDuration * 4); // e.g., 4 notes per second
        const timeStepDuration = totalPlaybackDuration / numTimeSteps;

        // Group points by their quantized time slot
        const notesInTimeSlots = Array(numTimeSteps).fill(null).map(() => []);

        sortedPoints.forEach(point => {
            const timeSlotIndex = Math.floor(mapRange(point.x, 0, canvas.width, 0, numTimeSteps -1));
            if (timeSlotIndex >= 0 && timeSlotIndex < numTimeSteps) {
                notesInTimeSlots[timeSlotIndex].push(point);
            }
        });

        notesInTimeSlots.forEach((pointsInSlot, slotIndex) => {
            if (pointsInSlot.length === 0) return;

            // If multiple points in one time slot, pick one (e.g., highest, lowest, or average y)
            // Or play them as a quick arpeggio or chord. For simplicity, let's pick the highest one (lowest Y value)
            pointsInSlot.sort((a, b) => a.y - b.y); // Sort by Y to get highest
            const representativePoint = pointsInSlot[0];

            const scheduledTime = localAudioCtx.currentTime + slotIndex * timeStepDuration;

            const { octaveOffset, scale } = getColorOctaveAndScale(representativePoint.color);
            
            // Y-axis maps to a note within the chosen scale
            const numNotesInScaleDisplay = scale.length * 2; // Display 2 octaves of the scale on canvas
            
            // Map Y to an index that cycles through the scale intervals and octaves
            let scaleDegreeIndex = Math.floor(mapRange(representativePoint.y, canvas.height, 0, 0, numNotesInScaleDisplay - 1));
            scaleDegreeIndex = Math.max(0, Math.min(numNotesInScaleDisplay - 1, scaleDegreeIndex)); // Clamp

            const octaveWithinCanvas = Math.floor(scaleDegreeIndex / scale.length);
            const noteInScaleInterval = scale[scaleDegreeIndex % scale.length];
            
            const currentMidiNote = baseMidiRootNote + octaveOffset + (octaveWithinCanvas * 12) + noteInScaleInterval;

            // Brush size for velocity (subtle effect for music box)
            const minBrushSize = parseFloat(brushSizeInput.min);
            const maxBrushSize = parseFloat(brushSizeInput.max);
            const velocity = mapRange(representativePoint.size, minBrushSize, maxBrushSize, 0.2, 0.5);
            const noteDuration = mapRange(representativePoint.size, minBrushSize, maxBrushSize, 0.8, 1.5); // Slightly affect duration

            createMusicBoxTone(scheduledTime, currentMidiNote, velocity, noteDuration);
        });
    });

    // --- Initial setup ---
    clearCanvas();
    if (colorBrushes.length > 0) {
        colorBrushes[0].classList.add('active');
        currentBrushColor = colorBrushes[0].dataset.color;
    }
    brushSizeInput.dispatchEvent(new Event('input'));

    instructions.innerHTML = `
        Draw in the area above. Different colors produce different sound timbres.<br>
        The horizontal position (left-to-right) determines when a sound plays.<br>
        The vertical position (top-to-bottom) determines the pitch (higher up = higher pitch).<br>
        在上方区域绘画，以创建音乐盒旋律。<br>
        <b>Y轴位置：</b>决定音符在音阶中的音高<br>（位置越高，音高越高）。<br>
        <b>X轴位置：</b>决定音符何时播放<br>（从左到右，按节奏进行量化）。<br>
        <b>颜色：</b>选择音高的八度范围<br>（红色：中音区，绿色：高一个八度，蓝色：低一个八度）。<br>
        <b>画笔大小：</b>影响音量，并略微影响音符的持续时间。<br>
        <b>制作人：Tina</b>
    `;
});