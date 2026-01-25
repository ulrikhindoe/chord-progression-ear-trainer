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
let state = {
    selectedIndices: new Set(chordProgressions.map((_, i) => i)), // Default all selected
    currentProgressionIndex: null,
    currentKeyRoot: 60, // Middle C
    currentChords: [], // Array of { notes: [], duration: '1m' }
    isPlaying: false,
    stats: {
        total: 0,
        correct: 0
    },
    settings: {
        loop: false,
        bass: false,
        tempo: 120
    },
    toneStarted: false,
    answered: false
};

// --- Audio Setup ---
let synth, bassSynth;
const CHORD_DURATION = 1.5; // Seconds

// --- DOM Elements ---
const views = {
    settings: document.getElementById('settings-view'),
    training: document.getElementById('training-view')
};

const els = {
    progressionList: document.getElementById('progression-list'),
    selectAllBtn: document.getElementById('select-all-btn'),
    deselectAllBtn: document.getElementById('deselect-all-btn'),
    loopToggle: document.getElementById('loop-toggle'),
    bassToggle: document.getElementById('bass-toggle'),
    tempoSlider: document.getElementById('tempo-slider'),
    tempoValue: document.getElementById('tempo-value'),
    startTrainingBtn: document.getElementById('start-training-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    playBtn: document.getElementById('play-btn'),
    stopBtn: document.getElementById('stop-btn'),
    nextBtn: document.getElementById('next-btn'),
    chordButtons: document.getElementById('chord-buttons'),
    progressionOptions: document.getElementById('progression-options'),
    statsCorrect: document.getElementById('stats-correct'),
    statsTotal: document.getElementById('stats-total'),
    statsAccuracy: document.getElementById('stats-accuracy'),
    resetStatsBtn: document.getElementById('reset-stats-btn')
};

// --- Initialization ---
function init() {
    renderSettingsList();
    updateStatsDisplay();

    // Event Listeners
    els.selectAllBtn.addEventListener('click', () => toggleAllProgressions(true));
    els.deselectAllBtn.addEventListener('click', () => toggleAllProgressions(false));

    els.loopToggle.addEventListener('change', (e) => state.settings.loop = e.target.checked);
    els.bassToggle.addEventListener('change', (e) => state.settings.bass = e.target.checked);
    els.tempoSlider.addEventListener('input', (e) => {
        state.settings.tempo = parseInt(e.target.value);
        els.tempoValue.textContent = state.settings.tempo;
        if (Tone.Transport) Tone.Transport.bpm.value = state.settings.tempo;
    });

    els.startTrainingBtn.addEventListener('click', startTraining);
    els.settingsBtn.addEventListener('click', showSettings);

    els.playBtn.addEventListener('click', () => playCurrentProgression());
    els.stopBtn.addEventListener('click', stopPlayback);
    els.nextBtn.addEventListener('click', nextProgression);
    els.resetStatsBtn.addEventListener('click', resetStats);
}

// --- Settings Logic ---
function renderSettingsList() {
    els.progressionList.innerHTML = '';
    chordProgressions.forEach((prog, index) => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';

        const div = document.createElement('div');
        div.className = 'form-check';

        const input = document.createElement('input');
        input.className = 'form-check-input';
        input.type = 'checkbox';
        input.id = `prog-${index}`;
        input.checked = state.selectedIndices.has(index);
        input.addEventListener('change', (e) => {
            if (e.target.checked) state.selectedIndices.add(index);
            else state.selectedIndices.delete(index);
        });

        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = `prog-`;
        label.textContent = prog.name;

        div.appendChild(input);
        div.appendChild(label);
        col.appendChild(div);
        els.progressionList.appendChild(col);
    });
}

function toggleAllProgressions(select) {
    const checkboxes = els.progressionList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb, index) => {
        cb.checked = select;
        if (select) state.selectedIndices.add(index);
        else state.selectedIndices.delete(index);
    });
}

// --- Audio Logic ---
async function initAudio() {
    if (state.toneStarted) return;
    await Tone.start();

    synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination();
    synth.volume.value = -8;

    bassSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 1 }
    }).toDestination();
    bassSynth.volume.value = -2; // Louder bass

    state.toneStarted = true;
}

function generateProgressionData(progressionIndex) {
    const progression = chordProgressions[progressionIndex];
    // Random key: MIDI 48 (C3) to 59 (B3) as base for root calculation
    // We'll use a base octave of 4 (60-71) for the chords to sit in
    const keyRoot = 60 + Math.floor(Math.random() * 12);

    const chords = progression.chords.map(roman => {
        const { rootOffset, quality } = parseRoman(roman);
        const rootMidi = keyRoot + rootOffset;

        // Build Triad
        let notes = [rootMidi]; // Root
        if (quality === 'major') {
            notes.push(rootMidi + 4); // Major 3rd
            notes.push(rootMidi + 7); // Perfect 5th
        } else if (quality === 'minor') {
            notes.push(rootMidi + 3); // Minor 3rd
            notes.push(rootMidi + 7); // Perfect 5th
        } else if (quality === 'diminished') {
            notes.push(rootMidi + 3); // Minor 3rd
            notes.push(rootMidi + 6); // Diminished 5th
        }

        // Inversion (0, 1, 2)
        const inversion = Math.floor(Math.random() * 3);
        let invertedNotes = [...notes];

        if (inversion === 1) {
            // 1st inversion: Root goes up an octave
            invertedNotes[0] += 12;
        } else if (inversion === 2) {
            // 2nd inversion: Root and 3rd go up an octave
            invertedNotes[0] += 12;
            invertedNotes[1] += 12;
        }
        // Sort notes for cleaner voice leading logic if we were doing that,
        // but here just to keep them tidy.
        invertedNotes.sort((a, b) => a - b);

        // Bass note (Root, 2 octaves down from key root)
        const bassNote = rootMidi - 24;

        return {
            notes: invertedNotes.map(m => Tone.Frequency(m, "midi").toNote()),
            bass: Tone.Frequency(bassNote, "midi").toNote()
        };
    });

    return chords;
}

function parseRoman(roman) {
    // Regex to separate accidental, numeral, quality
    const match = roman.match(/^([b#]?)([ivIV]+)(.*)$/);
    if (!match) return { rootOffset: 0, quality: 'major' };

    const accidental = match[1];
    const numeral = match[2];
    // const modifier = match[3]; // dim, aug, etc. (not fully implemented in this simple version)

    let scaleDegree = 0;
    const upper = numeral.toUpperCase();

    switch (upper) {
        case 'I': scaleDegree = 0; break;
        case 'II': scaleDegree = 2; break;
        case 'III': scaleDegree = 4; break;
        case 'IV': scaleDegree = 5; break;
        case 'V': scaleDegree = 7; break;
        case 'VI': scaleDegree = 9; break;
        case 'VII': scaleDegree = 11; break;
    }

    // Adjust for accidental
    if (accidental === 'b') scaleDegree -= 1;
    if (accidental === '#') scaleDegree += 1;

    // Determine quality from case
    const isMajor = numeral === upper;
    // Simple logic: lowercase is minor unless it's diminished (usually indicated by 'o' or context, but prompt implies triads)
    // For this app, we assume standard triads based on casing.
    // Special case: 'bIII' in minor is Major, 'bVI' is Major.
    // The prompt data uses casing correctly (e.g., 'bVI' is Major, 'ii' is minor).

    return {
        rootOffset: scaleDegree,
        quality: isMajor ? 'major' : 'minor' // Simplified, could add dim check if needed
    };
}

function playCurrentProgression() {
    if (!state.toneStarted) return;
    stopPlayback(); // Stop any existing playback

    state.isPlaying = true;
    els.stopBtn.disabled = false;
    els.playBtn.disabled = true;

    Tone.Transport.bpm.value = state.settings.tempo;
    Tone.Transport.cancel();

    const totalDuration = state.currentChords.length * CHORD_DURATION;

    // Schedule chords
    state.currentChords.forEach((chord, i) => {
        const time = i * CHORD_DURATION;

        Tone.Transport.schedule((t) => {
            // Trigger Chord
            synth.triggerAttackRelease(chord.notes, CHORD_DURATION - 0.1, t);

            // Trigger Bass
            if (state.settings.bass) {
                bassSynth.triggerAttackRelease(chord.bass, CHORD_DURATION - 0.1, t);
            }

            // Highlight chord button
            highlightChordButton(i);
        }, time);
    });

    // Schedule loop or stop
    if (state.settings.loop) {
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = totalDuration;
    } else {
        Tone.Transport.loop = false;
        Tone.Transport.schedule((t) => {
            stopPlayback();
        }, totalDuration);
    }

    Tone.Transport.start();
}

function stopPlayback() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    // Release all notes just in case
    if (synth) synth.releaseAll();
    if (bassSynth) bassSynth.releaseAll();

    state.isPlaying = false;
    els.stopBtn.disabled = true;
    els.playBtn.disabled = false;
    clearChordHighlights();
}

function playSingleChord(index) {
    if (!state.toneStarted || !state.currentChords[index]) return;
    const chord = state.currentChords[index];
    synth.triggerAttackRelease(chord.notes, "8n");
    if (state.settings.bass) {
        bassSynth.triggerAttackRelease(chord.bass, "8n");
    }
}

// --- Training Logic ---
async function startTraining() {
    if (state.selectedIndices.size === 0) {
        alert("Please select at least one progression.");
        return;
    }

    await initAudio();

    views.settings.classList.add('d-none');
    views.training.classList.remove('d-none');

    nextProgression();
}

function showSettings() {
    stopPlayback();
    views.training.classList.add('d-none');
    views.settings.classList.remove('d-none');
}

function nextProgression() {
    stopPlayback();
    state.answered = false;
    els.nextBtn.disabled = true;
    els.progressionOptions.classList.remove('options-locked');

    // Pick random progression from selection
    const indices = Array.from(state.selectedIndices);
    const randomIndex = indices[Math.floor(Math.random() * indices.length)];
    state.currentProgressionIndex = randomIndex;

    // Generate notes/inversions
    state.currentChords = generateProgressionData(randomIndex);

    // Render UI
    renderChordButtons();
    renderProgressionOptions();

    // Auto play? Prompt doesn't specify, but usually good.
    // "When a progression plays..." implies it plays automatically or user clicks play.
    // Let's wait for user to click Play to avoid startling.
}

function renderChordButtons() {
    els.chordButtons.innerHTML = '';
    state.currentChords.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-dark btn-chord mx-1';
        btn.textContent = i + 1;
        btn.addEventListener('click', () => playSingleChord(i));
        els.chordButtons.appendChild(btn);
    });
}

function renderProgressionOptions() {
    els.progressionOptions.innerHTML = '';
    // Show buttons for ALL selected progressions
    state.selectedIndices.forEach(index => {
        const prog = chordProgressions[index];
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-primary btn-lg btn-progression';
        btn.textContent = prog.name;
        btn.dataset.index = index;
        btn.addEventListener('click', () => checkAnswer(index, btn));
        els.progressionOptions.appendChild(btn);
    });
}

function checkAnswer(selectedIndex, btnElement) {
    if (state.answered) return;
    state.answered = true;

    state.stats.total++;
    const isCorrect = selectedIndex === state.currentProgressionIndex;

    if (isCorrect) {
        state.stats.correct++;
        btnElement.classList.add('correct-answer');
    } else {
        btnElement.classList.add('wrong-answer');
        // Highlight correct one
        const correctBtn = els.progressionOptions.querySelector(`button[data-index="${state.currentProgressionIndex}"]`);
        if (correctBtn) correctBtn.classList.add('correct-answer');
    }

    updateStatsDisplay();
    els.progressionOptions.classList.add('options-locked');
    els.nextBtn.disabled = false;
}

function highlightChordButton(index) {
    // Remove active class from all
    const btns = els.chordButtons.children;
    for (let btn of btns) btn.classList.remove('active');
    // Add to current
    if (btns[index]) btns[index].classList.add('active');
}

function clearChordHighlights() {
    const btns = els.chordButtons.children;
    for (let btn of btns) btn.classList.remove('active');
}

// --- Statistics ---
function updateStatsDisplay() {
    els.statsCorrect.textContent = state.stats.correct;
    els.statsTotal.textContent = state.stats.total;
    const acc = state.stats.total === 0 ? 0 : Math.round((state.stats.correct / state.stats.total) * 100);
    els.statsAccuracy.textContent = acc;
}

function resetStats() {
    state.stats.total = 0;
    state.stats.correct = 0;
    updateStatsDisplay();
}

// Start
init();
