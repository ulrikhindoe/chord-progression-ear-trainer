// /home/ulrik/projects/chord-progression-ear-trainer/script.js

// --- Data ---
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

// --- State ---
const state = {
    settings: {
        selectedIndices: chordProgressions.map((_, i) => i), // Default all
        loop: false,
        bass: false,
        tempo: 120
    },
    stats: {
        correct: 0,
        total: 0
    },
    currentExercise: null, // { template, key, chords: [{notes:[], bass:Str, duration}] }
    isPlaying: false,
    hasAnswered: false
};

// --- Tone.js Instruments ---
let polySynth;
let bassSynth;

// --- UI Elements ---
const ui = {
    views: {
        training: document.getElementById('training-view'),
        settings: document.getElementById('settings-view')
    },
    stats: {
        display: document.getElementById('stats-display'),
        reset: document.getElementById('btn-reset-stats')
    },
    controls: {
        play: document.getElementById('btn-play'),
        stop: document.getElementById('btn-stop'),
        next: document.getElementById('btn-next'),
        settings: document.getElementById('btn-go-settings'),
        startTraining: document.getElementById('btn-start-training')
    },
    containers: {
        chords: document.getElementById('chord-buttons'),
        choices: document.getElementById('progression-choices'),
        settingsList: document.getElementById('progression-list')
    },
    settings: {
        loop: document.getElementById('check-loop'),
        bass: document.getElementById('check-bass'),
        tempo: document.getElementById('range-tempo'),
        tempoVal: document.getElementById('tempo-val'),
        selectAll: document.getElementById('btn-select-all'),
        deselectAll: document.getElementById('btn-deselect-all')
    }
};

// --- Initialization ---
function init() {
    setupTone();
    setupEventListeners();
    renderSettingsList();
    updateStatsDisplay();
    newExercise();
}

function setupTone() {
    polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination();
    polySynth.volume.value = -6;

    bassSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 1 }
    }).toDestination();
    // Bass louder (+2dB relative to standard, though here we just set a higher base volume)
    bassSynth.volume.value = -2;
}

function setupEventListeners() {
    // Navigation
    ui.controls.settings.addEventListener('click', () => switchView('settings'));
    ui.controls.startTraining.addEventListener('click', () => {
        updateSettingsFromUI();
        switchView('training');
        newExercise();
    });

    // Stats
    ui.stats.reset.addEventListener('click', (e) => {
        e.preventDefault();
        state.stats.correct = 0;
        state.stats.total = 0;
        updateStatsDisplay();
    });

    // Playback
    ui.controls.play.addEventListener('click', async () => {
        await Tone.start();
        playProgression();
    });
    ui.controls.stop.addEventListener('click', stopPlayback);

    // Next
    ui.controls.next.addEventListener('click', () => {
        newExercise();
        playProgression();
    });

    // Settings Inputs
    ui.settings.tempo.addEventListener('input', (e) => {
        ui.settings.tempoVal.textContent = e.target.value;
    });
    ui.settings.selectAll.addEventListener('click', () => toggleAllProgressions(true));
    ui.settings.deselectAll.addEventListener('click', () => toggleAllProgressions(false));
}

// --- Logic ---

function newExercise() {
    stopPlayback();
    state.hasAnswered = false;
    ui.controls.next.disabled = true;

    // 1. Filter available progressions
    const available = state.settings.selectedIndices.map(i => chordProgressions[i]);
    if (available.length === 0) {
        alert("Please select at least one progression in settings.");
        switchView('settings');
        return;
    }

    // 2. Pick random progression
    const template = available[Math.floor(Math.random() * available.length)];

    // 3. Pick random key
    const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const key = keys[Math.floor(Math.random() * keys.length)];

    // 4. Generate Chords
    const chords = generateChords(key, template.chords);

    state.currentExercise = {
        template,
        key,
        chords
    };

    renderTrainingUI();
}

function generateChords(key, romanNumerals) {
    const generated = [];
    let prevMidi = null;

    romanNumerals.forEach(rn => {
        // Get Root position MIDI notes
        const { rootMidi, triadMidi } = getChordData(key, rn);

        // Choose inversion based on voice leading
        const inversionMidi = chooseInversion(triadMidi, prevMidi);

        // Convert MIDI to Note Names for Tone.js
        const notes = inversionMidi.map(m => Tone.Frequency(m, "midi").toNote());

        // Calculate Bass Note (Root in octave 2 or 3)
        let bassMidi = rootMidi;
        while (bassMidi >= 48) bassMidi -= 12; // < C3
        while (bassMidi < 36) bassMidi += 12;  // >= C2
        const bassNote = Tone.Frequency(bassMidi, "midi").toNote();

        generated.push({
            roman: rn,
            notes: notes,
            bass: bassNote,
            midi: inversionMidi // Store for next iteration voice leading
        });

        prevMidi = inversionMidi;
    });

    return generated;
}

function getChordData(key, roman) {
    // Parse Roman: e.g., "bVI" -> accidental 'b', numeral 'VI'
    const match = roman.match(/^([b#]?)(i{1,3}|iv|v|vi{0,2}|I{1,3}|IV|V|VI{0,2})$/i);
    if (!match) return { rootMidi: 60, triadMidi: [60, 64, 67] }; // Fallback C Major

    const accidental = match[1];
    const numeral = match[2];
    const isMajor = numeral === numeral.toUpperCase();

    // Scale degrees (0-based semitones from root)
    const degreeMap = {
        'i': 0, 'ii': 2, 'iii': 4, 'iv': 5, 'v': 7, 'vi': 9, 'vii': 11
    };
    let interval = degreeMap[numeral.toLowerCase()];

    // Apply accidental
    if (accidental === 'b') interval -= 1;
    if (accidental === '#') interval += 1;

    // Get Key Root MIDI (start at octave 4)
    const keyRootMidi = Tone.Frequency(key + "4").toMidi();
    const chordRootMidi = keyRootMidi + interval;

    // Build Triad (Root, 3rd, 5th)
    const third = isMajor ? 4 : 3;
    const fifth = 7;

    // Normalize to reasonable range (C3 - C5) to avoid climbing too high
    let triad = [chordRootMidi, chordRootMidi + third, chordRootMidi + fifth];
    triad = triad.map(n => {
        while (n > 72) n -= 12; // Cap at C5
        while (n < 48) n += 12; // Floor at C3
        return n;
    });
    triad.sort((a, b) => a - b);

    return { rootMidi: chordRootMidi, triadMidi: triad };
}

function chooseInversion(triadMidi, prevMidi) {
    // Generate 3 inversions
    const inv0 = [...triadMidi]; // Root pos
    const inv1 = [triadMidi[1], triadMidi[2], triadMidi[0] + 12]; // 1st inv
    const inv2 = [triadMidi[2], triadMidi[0] + 12, triadMidi[1] + 12]; // 2nd inv

    const candidates = [inv0, inv1, inv2];

    if (!prevMidi) {
        // Random inversion for first chord
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Nearest Neighbor: Minimize sum of distances
    let minDist = Infinity;
    let best = candidates[0];

    candidates.forEach(cand => {
        // Sort to compare voices roughly
        const cSorted = [...cand].sort((a, b) => a - b);
        const pSorted = [...prevMidi].sort((a, b) => a - b);

        let dist = 0;
        for (let i = 0; i < 3; i++) {
            dist += Math.abs(cSorted[i] - pSorted[i]);
        }

        if (dist < minDist) {
            minDist = dist;
            best = cand;
        }
    });

    return best;
}

// --- Playback ---

function playProgression() {
    if (state.isPlaying) stopPlayback();
    state.isPlaying = true;

    // UI Updates
    if (state.settings.loop) {
        ui.controls.stop.classList.remove('d-none');
    }

    Tone.Transport.bpm.value = state.settings.tempo;
    Tone.Transport.cancel();

    const chords = state.currentExercise.chords;
    let time = 0;
    const measureTime = Tone.Time("1m").toSeconds();

    chords.forEach((chord, index) => {
        Tone.Transport.schedule((t) => {
            // Visuals
            Tone.Draw.schedule(() => {
                highlightChordButton(index);
            }, t);

            // Audio
            polySynth.triggerAttackRelease(chord.notes, "1m", t);
            if (state.settings.bass) {
                bassSynth.triggerAttackRelease(chord.bass, "1m", t);
            }
        }, time);

        time += measureTime;
    });

    if (state.settings.loop) {
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = time;
    } else {
        Tone.Transport.loop = false;
        // Schedule stop after last chord
        Tone.Transport.schedule((t) => {
            Tone.Draw.schedule(() => stopPlayback(), t);
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
    ui.controls.play.classList.remove('d-none');
    ui.controls.stop.classList.add('d-none');
    clearChordHighlights();
}

function highlightChordButton(index) {
    clearChordHighlights();
    const btn = document.getElementById(`chord-btn-${index}`);
    if (btn) btn.classList.add('active');
}

function clearChordHighlights() {
    const btns = document.querySelectorAll('.chord-btn');
    btns.forEach(b => b.classList.remove('active'));
}

// --- UI Rendering ---

function renderTrainingUI() {
    // 1. Chord Buttons (1, 2, 3...)
    ui.containers.chords.innerHTML = '';
    state.currentExercise.chords.forEach((chord, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-dark chord-btn';
        btn.id = `chord-btn-${index}`;
        btn.textContent = index + 1;

        // Manual play on press
        const play = () => {
            polySynth.triggerAttack(chord.notes);
            if (state.settings.bass) bassSynth.triggerAttack(chord.bass);
        };
        const stop = () => {
            polySynth.releaseAll();
            bassSynth.triggerRelease();
        };

        btn.addEventListener('mousedown', play);
        btn.addEventListener('mouseup', stop);
        btn.addEventListener('mouseleave', stop);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); play(); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); stop(); });

        ui.containers.chords.appendChild(btn);
    });

    // 2. Progression Choices
    ui.containers.choices.innerHTML = '';
    // Only show selected progressions
    const activeProgressions = state.settings.selectedIndices.map(i => chordProgressions[i]);

    activeProgressions.forEach(prog => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-primary choice-btn';
        btn.textContent = prog.name;
        btn.onclick = () => handleGuess(prog, btn);
        ui.containers.choices.appendChild(btn);
    });
}

function handleGuess(selectedProgression, btnElement) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;

    const isCorrect = selectedProgression.name === state.currentExercise.template.name;

    if (isCorrect) {
        btnElement.classList.add('correct');
        state.stats.correct++;
    } else {
        btnElement.classList.add('incorrect');
        // Highlight correct answer
        const buttons = ui.containers.choices.querySelectorAll('.choice-btn');
        buttons.forEach(b => {
            if (b.textContent === state.currentExercise.template.name) {
                b.classList.add('correct');
            }
        });
    }

    state.stats.total++;
    updateStatsDisplay();

    // Enable Next button
    ui.controls.next.disabled = false;

    // Disable all choice buttons
    const buttons = ui.containers.choices.querySelectorAll('.choice-btn');
    buttons.forEach(b => b.disabled = true);
}

function updateStatsDisplay() {
    const { correct, total } = state.stats;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    ui.stats.display.textContent = `Correct: ${correct}/${total} (${percent}%)`;
}

// --- Settings Logic ---

function renderSettingsList() {
    ui.containers.settingsList.innerHTML = '';
    chordProgressions.forEach((prog, index) => {
        const label = document.createElement('label');
        label.className = 'list-group-item d-flex gap-2';

        const checkbox = document.createElement('input');
        checkbox.className = 'form-check-input flex-shrink-0';
        checkbox.type = 'checkbox';
        checkbox.value = index;
        checkbox.checked = state.settings.selectedIndices.includes(index);

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(prog.name));
        ui.containers.settingsList.appendChild(label);
    });
}

function toggleAllProgressions(select) {
    const checkboxes = ui.containers.settingsList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = select);
}

function updateSettingsFromUI() {
    state.settings.loop = ui.settings.loop.checked;
    state.settings.bass = ui.settings.bass.checked;
    state.settings.tempo = parseInt(ui.settings.tempo.value);

    const checkboxes = ui.containers.settingsList.querySelectorAll('input[type="checkbox"]:checked');
    state.settings.selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));
}

function switchView(viewName) {
    if (viewName === 'settings') {
        ui.views.training.classList.add('d-none');
        ui.views.settings.classList.remove('d-none');

        // Sync UI with state
        ui.settings.loop.checked = state.settings.loop;
        ui.settings.bass.checked = state.settings.bass;
        ui.settings.tempo.value = state.settings.tempo;
        ui.settings.tempoVal.textContent = state.settings.tempo;
        renderSettingsList();
    } else {
        ui.views.settings.classList.add('d-none');
        ui.views.training.classList.remove('d-none');
    }
}

// Start App
init();
