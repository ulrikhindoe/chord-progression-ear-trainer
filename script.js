// /home/ulrik/projects/chord-progression-ear-trainer/script.js

// Data
const chordProgressions = [
    { name: "i V", chords: ["i", "V"] },
    { name: "i iv", chords: ["i", "iv"] },
    { name: "I V", chords: ["I", "V"] },
    { name: "I IV", chords: ["I", "IV"] },
    { name: "i bVI bIII bVII", chords: ["i", "bVI", "bIII", "bVII"] },
    { name: "I IV V I", chords: ["I", "IV", "V", "I"] },
    { name: "ii V I", chords: ["ii", "V", "I"] },
    { name: "I V vi IV", chords: ["I", "V", "vi", "IV"] },
    { name: "I vi IV V", chords: ["I", "vi", "IV", "V"] },
    { name: "i iv V i", chords: ["i", "iv", "V", "i"] },
    { name: "I IV I V", chords: ["I", "IV", "I", "V"] }
];

// State
let state = {
    selectedIndices: chordProgressions.map((_, i) => i), // Default all selected
    loop: false,
    bass: false,
    tempo: 120,
    currentExercise: null,
    stats: {
        correct: 0,
        total: 0
    },
    isPlaying: false
};

// Tone.js Instruments
let polySynth;
let bassSynth;

// DOM Elements
const views = {
    training: document.getElementById('training-view'),
    settings: document.getElementById('settings-view')
};

const ui = {
    btnGoSettings: document.getElementById('btn-go-settings'),
    btnPlay: document.getElementById('btn-play'),
    btnStop: document.getElementById('btn-stop'),
    btnNext: document.getElementById('btn-next'),
    chordButtonsContainer: document.getElementById('chord-buttons'),
    progressionChoicesContainer: document.getElementById('progression-choices'),
    statsDisplay: document.getElementById('stats-display'),
    btnResetStats: document.getElementById('btn-reset-stats'),

    checkLoop: document.getElementById('check-loop'),
    checkBass: document.getElementById('check-bass'),
    rangeTempo: document.getElementById('range-tempo'),
    tempoVal: document.getElementById('tempo-val'),
    progressionList: document.getElementById('progression-list'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnDeselectAll: document.getElementById('btn-deselect-all'),
    btnStartTraining: document.getElementById('btn-start-training')
};

// Initialization
function init() {
    setupTone();
    setupEventListeners();
    renderSettingsList();
    updateStatsDisplay();
    newExercise(); // Generate first exercise
}

function setupTone() {
    polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination();
    polySynth.volume.value = -6;

    bassSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.5, release: 1 }
    }).toDestination();
    bassSynth.volume.value = -4; // Louder relative to polySynth voices
}

function setupEventListeners() {
    // Navigation
    ui.btnGoSettings.addEventListener('click', () => switchView('settings'));
    ui.btnStartTraining.addEventListener('click', () => {
        updateSettingsFromUI();
        switchView('training');
        newExercise(); // Generate new exercise based on new settings
    });

    // Training Controls
    ui.btnPlay.addEventListener('click', async () => {
        await Tone.start();
        playProgression();
    });
    ui.btnStop.addEventListener('click', stopPlayback);
    ui.btnNext.addEventListener('click', () => {
        newExercise();
        playProgression();
    });
    ui.btnResetStats.addEventListener('click', resetStats);

    // Settings
    ui.rangeTempo.addEventListener('input', (e) => {
        ui.tempoVal.textContent = e.target.value;
    });
    ui.btnSelectAll.addEventListener('click', () => toggleAllProgressions(true));
    ui.btnDeselectAll.addEventListener('click', () => toggleAllProgressions(false));
}

function switchView(viewName) {
    if (viewName === 'settings') {
        views.training.classList.add('d-none');
        views.settings.classList.remove('d-none');
        // Sync UI with state
        ui.checkLoop.checked = state.loop;
        ui.checkBass.checked = state.bass;
        ui.rangeTempo.value = state.tempo;
        ui.tempoVal.textContent = state.tempo;
        renderSettingsList();
    } else {
        views.settings.classList.add('d-none');
        views.training.classList.remove('d-none');
    }
}

// Logic
function newExercise() {
    stopPlayback();

    // Filter available progressions
    const available = state.selectedIndices.map(i => chordProgressions[i]);
    if (available.length === 0) {
        alert("Please select at least one progression in settings.");
        switchView('settings');
        return;
    }

    // Pick random progression
    const progressionTemplate = available[Math.floor(Math.random() * available.length)];

    // Pick random key
    const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const key = keys[Math.floor(Math.random() * keys.length)];

    // Generate chords
    const chords = generateChords(key, progressionTemplate.chords);

    state.currentExercise = {
        template: progressionTemplate,
        key: key,
        chords: chords
    };

    renderTrainingUI();
}

function generateChords(key, romanNumerals) {
    const generated = [];
    let prevNotes = null;

    romanNumerals.forEach(rn => {
        // 1. Get notes for the chord (root position)
        const notes = getChordNotes(key, rn);

        // 2. Choose inversion for voice leading
        const inversion = chooseInversion(notes, prevNotes);

        generated.push({
            roman: rn,
            notes: inversion.notes,
            bass: inversion.bass, // Root note for bass
            duration: "1m" // 1 measure
        });

        prevNotes = inversion.midi;
    });

    return generated;
}

function getChordNotes(key, roman) {
    // Parse Roman Numeral
    const match = roman.match(/^([b#]?)(i{1,3}|iv|v|vi{0,2}|I{1,3}|IV|V|VI{0,2})$/i);
    if (!match) return { root: 60, triad: [60, 64, 67] }; // Fallback

    const accidental = match[1];
    const numeral = match[2];
    const isMajor = numeral === numeral.toUpperCase();

    const degreeMap = {
        'i': 0, 'ii': 2, 'iii': 4, 'iv': 5, 'v': 7, 'vi': 9, 'vii': 11
    };
    const baseInterval = degreeMap[numeral.toLowerCase()];

    let accidentalOffset = 0;
    if (accidental === 'b') accidentalOffset = -1;
    if (accidental === '#') accidentalOffset = 1;

    const rootInterval = baseInterval + accidentalOffset;

    // Get Key Midi
    const keyMidi = Tone.Frequency(key + "4").toMidi(); // Start at octave 4
    const rootMidi = keyMidi + rootInterval;

    // Construct Triad
    const thirdInterval = isMajor ? 4 : 3;
    const fifthInterval = 7;

    const notes = [rootMidi, rootMidi + thirdInterval, rootMidi + fifthInterval];

    // Normalize to a reasonable range (e.g., C3 to C5)
    const normalizedNotes = notes.map(n => {
        while (n > 72) n -= 12;
        while (n < 48) n += 12;
        return n;
    });

    // Sort for consistent inversion handling
    normalizedNotes.sort((a, b) => a - b);

    return {
        root: rootMidi, // Keep original root for bass
        triad: normalizedNotes
    };
}

function chooseInversion(chordData, prevNotes) {
    const { root, triad } = chordData;

    // Generate 3 inversions
    const inv0 = [...triad];
    const inv1 = [triad[1], triad[2], triad[0] + 12];
    const inv2 = [triad[2], triad[0] + 12, triad[1] + 12];

    const candidates = [inv0, inv1, inv2];
    let bestNotes;

    if (!prevNotes) {
        // Random inversion for first chord
        bestNotes = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
        // Find candidate with minimum distance (voice leading)
        let minDist = Infinity;

        candidates.forEach((cand) => {
            const cSorted = [...cand].sort((a, b) => a - b);
            const pSorted = [...prevNotes].sort((a, b) => a - b);

            let dist = 0;
            for (let i = 0; i < 3; i++) {
                dist += Math.abs(cSorted[i] - pSorted[i]);
            }

            if (dist < minDist) {
                minDist = dist;
                bestNotes = cand;
            }
        });
    }

    // Bass note: Root note. Shift to octave 2 or 3.
    let bassNote = root;
    while (bassNote >= 48) bassNote -= 12; // Ensure below C3
    while (bassNote < 36) bassNote += 12; // Ensure above C2

    return {
        notes: bestNotes.map(n => Tone.Frequency(n, "midi").toNote()),
        midi: bestNotes,
        bass: Tone.Frequency(bassNote, "midi").toNote()
    };
}

function playProgression() {
    if (state.isPlaying) return;
    state.isPlaying = true;

    ui.btnPlay.classList.add('d-none');
    if (state.loop) {
        ui.btnStop.classList.remove('d-none');
    }

    Tone.Transport.bpm.value = state.tempo;
    Tone.Transport.cancel();

    const chords = state.currentExercise.chords;
    let time = 0;

    // Schedule chords
    chords.forEach((chord, index) => {
        Tone.Transport.schedule((t) => {
            // Highlight button
            Tone.Draw.schedule(() => {
                highlightChordButton(index);
            }, t);

            // Play Chord
            polySynth.triggerAttackRelease(chord.notes, "1m", t);

            // Play Bass
            if (state.bass) {
                bassSynth.triggerAttackRelease(chord.bass, "1m", t);
            }
        }, time);

        time += Tone.Time("1m").toSeconds();
    });

    // Loop or Stop
    if (state.loop) {
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = time;
    } else {
        Tone.Transport.loop = false;
        Tone.Transport.schedule((t) => {
            Tone.Draw.schedule(() => {
                stopPlayback();
            }, t);
        }, time);
    }

    Tone.Transport.start();
}

function stopPlayback() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    polySynth.releaseAll();
    bassSynth.triggerRelease();

    state.isPlaying = false;
    ui.btnPlay.classList.remove('d-none');
    ui.btnStop.classList.add('d-none');
    clearChordHighlights();
}

function highlightChordButton(index) {
    clearChordHighlights();
    const btn = document.getElementById(`chord-btn-`);
    if (btn) btn.classList.add('active');
}

function clearChordHighlights() {
    const btns = document.querySelectorAll('.chord-btn');
    btns.forEach(b => b.classList.remove('active'));
}

function renderTrainingUI() {
    // Render Chord Buttons
    ui.chordButtonsContainer.innerHTML = '';
    state.currentExercise.chords.forEach((chord, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-dark chord-btn';
        btn.id = `chord-btn-`;
        btn.textContent = index + 1;

        // Press to play chord
        const playChord = () => {
            polySynth.triggerAttack(chord.notes);
            if (state.bass) bassSynth.triggerAttack(chord.bass);
        };
        const stopChord = () => {
            polySynth.releaseAll();
            bassSynth.triggerRelease();
        };

        btn.addEventListener('mousedown', playChord);
        btn.addEventListener('mouseup', stopChord);
        btn.addEventListener('mouseleave', stopChord);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); playChord(); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); stopChord(); });

        ui.chordButtonsContainer.appendChild(btn);
    });

    // Render Progression Choices
    ui.progressionChoicesContainer.innerHTML = '';
    // Filter to only show selected progressions
    const activeProgressions = state.selectedIndices.map(i => ({...chordProgressions[i], originalIndex: i}));

    activeProgressions.forEach(prog => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-primary choice-btn';
        btn.textContent = prog.name;
        btn.addEventListener('click', () => handleGuess(prog, btn));
        ui.progressionChoicesContainer.appendChild(btn);
    });

    ui.btnNext.classList.add('d-none');
}

function handleGuess(progression, btnElement) {
    if (ui.btnNext.classList.contains('d-none') === false) return; // Already answered

    const isCorrect = progression.name === state.currentExercise.template.name;

    if (isCorrect) {
        btnElement.classList.add('correct');
        state.stats.correct++;
    } else {
        btnElement.classList.add('incorrect');
        // Highlight correct one
        const buttons = ui.progressionChoicesContainer.querySelectorAll('.choice-btn');
        buttons.forEach(b => {
            if (b.textContent === state.currentExercise.template.name) {
                b.classList.add('correct');
            }
        });
    }
    state.stats.total++;
    updateStatsDisplay();
    ui.btnNext.classList.remove('d-none');
}

function updateStatsDisplay() {
    const { correct, total } = state.stats;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    ui.statsDisplay.textContent = `Correct: / (%)`;
}

function resetStats() {
    state.stats.correct = 0;
    state.stats.total = 0;
    updateStatsDisplay();
}

// Settings Logic
function renderSettingsList() {
    ui.progressionList.innerHTML = '';
    chordProgressions.forEach((prog, index) => {
        const label = document.createElement('label');
        label.className = 'list-group-item';

        const checkbox = document.createElement('input');
        checkbox.className = 'form-check-input me-1';
        checkbox.type = 'checkbox';
        checkbox.value = index;
        checkbox.checked = state.selectedIndices.includes(index);

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(prog.name));
        ui.progressionList.appendChild(label);
    });
}

function toggleAllProgressions(select) {
    const checkboxes = ui.progressionList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = select);
}

function updateSettingsFromUI() {
    state.loop = ui.checkLoop.checked;
    state.bass = ui.checkBass.checked;
    state.tempo = parseInt(ui.rangeTempo.value);

    const checkboxes = ui.progressionList.querySelectorAll('input[type="checkbox"]:checked');
    state.selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// Start
init();
