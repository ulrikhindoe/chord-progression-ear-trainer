// Data Structure
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

// App State
const state = {
    selectedIndices: new Set(chordProgressions.map((_, i) => i)), // Default all selected
    currentProgressionIndex: null,
    currentKey: null,
    currentChordNotes: [], // Array of arrays of notes
    currentBassNotes: [],
    isPlaying: false,
    hasAnswered: false,
    stats: {
        total: 0,
        correct: 0
    },
    options: {
        loop: false,
        bass: false,
        tempo: 120
    }
};

// Tone.js Instruments
let polySynth;
let bassSynth;

// Music Theory Constants
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ROMAN_REGEX = /^(b|#)?(I|II|III|IV|V|VI|VII|i|ii|iii|iv|v|vi|vii)$/i;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTone();
    initUI();
    renderSettingsList();
    updateStatsUI();
});

function initTone() {
    polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination();
    polySynth.volume.value = -6;

    bassSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 1 }
    }).toDestination();
    bassSynth.volume.value = -3;
}

function initUI() {
    // View Navigation
    document.getElementById('btn-to-settings').addEventListener('click', () => switchView('settings'));
    document.getElementById('btn-to-training').addEventListener('click', () => {
        switchView('training');
        if (state.currentProgressionIndex === null) {
            nextProgression();
        }
    });

    // Controls
    document.getElementById('btn-play').addEventListener('click', async () => {
        await Tone.start();
        playProgression();
    });
    document.getElementById('btn-stop').addEventListener('click', stopPlayback);
    document.getElementById('btn-reset').addEventListener('click', resetStats);
    document.getElementById('btn-next').addEventListener('click', nextProgression);

    // Settings Options
    document.getElementById('opt-loop').addEventListener('change', (e) => {
        state.options.loop = e.target.checked;
        if (state.isPlaying) {
            // Restart playback to apply loop setting change immediately if desired,
            // or just let it apply on next play. For simplicity, we stop.
            stopPlayback();
        }
    });
    document.getElementById('opt-bass').addEventListener('change', (e) => state.options.bass = e.target.checked);
    document.getElementById('opt-tempo').addEventListener('input', (e) => {
        state.options.tempo = parseInt(e.target.value);
        document.getElementById('tempo-val').textContent = state.options.tempo;
        Tone.Transport.bpm.value = state.options.tempo;
    });

    // Selection Buttons
    document.getElementById('btn-select-all').addEventListener('click', () => {
        state.selectedIndices = new Set(chordProgressions.map((_, i) => i));
        renderSettingsList();
    });
    document.getElementById('btn-deselect-all').addEventListener('click', () => {
        state.selectedIndices.clear();
        renderSettingsList();
    });
}

function switchView(view) {
    const trainingView = document.getElementById('training-view');
    const settingsView = document.getElementById('settings-view');

    if (view === 'settings') {
        stopPlayback();
        trainingView.classList.add('d-none');
        settingsView.classList.remove('d-none');
    } else {
        settingsView.classList.add('d-none');
        trainingView.classList.remove('d-none');
    }
}

function renderSettingsList() {
    const list = document.getElementById('progression-list');
    list.innerHTML = '';
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
            if (e.target.checked) {
                state.selectedIndices.add(index);
            } else {
                state.selectedIndices.delete(index);
            }
        });

        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = `prog-${index}`;
        label.textContent = prog.name;

        div.appendChild(input);
        div.appendChild(label);
        col.appendChild(div);
        list.appendChild(col);
    });
}

// --- Game Logic ---

function nextProgression() {
    stopPlayback();

    if (state.selectedIndices.size === 0) {
        alert("Please select at least one progression in Settings.");
        switchView('settings');
        return;
    }

    // Reset UI state
    state.hasAnswered = false;
    document.getElementById('btn-next').classList.add('d-none');
    document.getElementById('feedback-message').textContent = '';

    // Pick random progression
    const indices = Array.from(state.selectedIndices);
    const randomIndex = indices[Math.floor(Math.random() * indices.length)];
    state.currentProgressionIndex = randomIndex;

    // Pick random key
    state.currentKey = NOTES[Math.floor(Math.random() * NOTES.length)];

    // Generate Notes
    generateChordNotes();

    // Render UI
    renderTrainingUI();

    // Auto-play
    playProgression();
}

function generateChordNotes() {
    const prog = chordProgressions[state.currentProgressionIndex];
    state.currentChordNotes = [];
    state.currentBassNotes = [];

    prog.chords.forEach(roman => {
        const { notes, bass } = romanToNotes(roman, state.currentKey);
        state.currentChordNotes.push(notes);
        state.currentBassNotes.push(bass);
    });
}

function romanToNotes(roman, key) {
    // Parse Roman Numeral
    // e.g. bVI -> accidental: 'b', numeral: 'VI'
    // i -> accidental: undefined, numeral: 'i'
    const match = roman.match(ROMAN_REGEX);
    if (!match) return { notes: [], bass: null };

    const accidental = match[1] || '';
    const numeral = match[2];
    const isMajor = numeral === numeral.toUpperCase();

    // Map numeral to scale degree (0-11 semitones from root)
    const scaleDegrees = {
        'i': 0, 'ii': 2, 'iii': 4, 'iv': 5, 'v': 7, 'vi': 9, 'vii': 11
    };
    const normalizedNumeral = numeral.toLowerCase();
    let semitoneOffset = scaleDegrees[normalizedNumeral];

    // Apply accidental to root offset
    if (accidental === 'b') semitoneOffset -= 1;
    if (accidental === '#') semitoneOffset += 1;

    // Calculate Root Note
    const keyIndex = NOTES.indexOf(key);
    const rootIndex = (keyIndex + semitoneOffset + 12) % 12; // +12 to handle negative
    const rootNoteName = NOTES[rootIndex];

    // Build Triad Intervals
    // Major: 0, 4, 7
    // Minor: 0, 3, 7
    // Diminished (vii usually): 0, 3, 6 (Assuming standard diatonic triads for simplicity unless specified)
    // The prompt examples are mostly Major/Minor.
    // Let's stick to Major/Minor based on case.
    let intervals = isMajor ? [0, 4, 7] : [0, 3, 7];

    // Calculate actual notes
    // Base octave 4
    let notes = intervals.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        const noteName = NOTES[noteIndex];
        // Simple octave logic: if note index is lower than key index, bump octave?
        // Or just keep everything around middle C (C4).
        // Let's calculate absolute semitones to determine octave.
        // Root absolute: keyIndex + semitoneOffset.
        // Note absolute: Root absolute + interval.
        const absSemitone = keyIndex + semitoneOffset + interval;
        const octave = 4 + Math.floor(absSemitone / 12);
        return noteName + octave;
    });

    // Inversions: Randomly select Root, 1st, or 2nd
    const inversion = Math.floor(Math.random() * 3);
    if (inversion === 1) {
        // Move root up an octave
        const root = notes.shift();
        const noteName = root.slice(0, -1);
        const oct = parseInt(root.slice(-1)) + 1;
        notes.push(noteName + oct);
    } else if (inversion === 2) {
        // Move root and 3rd up an octave
        const root = notes.shift();
        const third = notes.shift();

        const rootName = root.slice(0, -1);
        const rootOct = parseInt(root.slice(-1)) + 1;

        const thirdName = third.slice(0, -1);
        const thirdOct = parseInt(third.slice(-1)) + 1;

        notes.push(rootName + rootOct);
        notes.push(thirdName + thirdOct);
    }

    // Bass Note (Root, lower octave)
    // Octave 2 or 3
    const bassOctave = 2 + Math.floor((keyIndex + semitoneOffset) / 12);
    const bassNote = rootNoteName + bassOctave;

    return { notes, bass: bassNote };
}

function playProgression() {
    if (state.isPlaying) stopPlayback();
    state.isPlaying = true;

    Tone.Transport.cancel();
    Tone.Transport.bpm.value = state.options.tempo;

    const chordDuration = "1n"; // 1 measure per chord? Or maybe half note. Let's do 2n (half note) for better pace.
    const chordTime = Tone.Time("2n").toSeconds();

    // Schedule chords
    state.currentChordNotes.forEach((notes, i) => {
        const time = i * chordTime;

        Tone.Transport.schedule((t) => {
            polySynth.triggerAttackRelease(notes, "2n", t);
            if (state.options.bass) {
                bassSynth.triggerAttackRelease(state.currentBassNotes[i], "2n", t);
            }

            // Highlight current chord button
            highlightChordButton(i);
        }, time);
    });

    const totalDuration = state.currentChordNotes.length * chordTime;

    if (state.options.loop) {
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = totalDuration;
    } else {
        Tone.Transport.loop = false;
        // Stop transport after progression finishes
        Tone.Transport.schedule((t) => {
            stopPlayback();
        }, totalDuration);
    }

    Tone.Transport.start();
}

function stopPlayback() {
    state.isPlaying = false;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    // Clear chord button highlights
    document.querySelectorAll('#chord-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
}

function playSingleChord(index) {
    if (state.currentChordNotes[index]) {
        polySynth.triggerAttackRelease(state.currentChordNotes[index], "4n");
        if (state.options.bass) {
            bassSynth.triggerAttackRelease(state.currentBassNotes[index], "4n");
        }
    }
}

function renderTrainingUI() {
    // Render Chord Buttons (1, 2, 3...)
    const chordContainer = document.getElementById('chord-buttons');
    chordContainer.innerHTML = '';
    state.currentChordNotes.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-secondary';
        btn.textContent = i + 1;
        btn.id = `chord-btn-${i}`;
        btn.addEventListener('click', () => playSingleChord(i));
        chordContainer.appendChild(btn);
    });

    // Render Progression Choices
    const choiceContainer = document.getElementById('progression-choices');
    choiceContainer.innerHTML = '';

    // Only show selected progressions
    state.selectedIndices.forEach(index => {
        const prog = chordProgressions[index];
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-primary btn-choice mb-2';
        btn.textContent = prog.name;
        btn.dataset.index = index;
        btn.addEventListener('click', () => checkAnswer(index, btn));
        choiceContainer.appendChild(btn);
    });
}

function highlightChordButton(index) {
    Tone.Draw.schedule(() => {
        document.querySelectorAll('#chord-buttons .btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`chord-btn-${index}`);
        if (btn) btn.classList.add('active');
    }, Tone.now());
}

function checkAnswer(selectedIndex, btnElement) {
    if (state.hasAnswered) return; // Prevent multiple guesses per round
    state.hasAnswered = true;

    const isCorrect = selectedIndex === state.currentProgressionIndex;
    const feedbackEl = document.getElementById('feedback-message');

    state.stats.total++;
    if (isCorrect) {
        state.stats.correct++;
        btnElement.classList.remove('btn-outline-primary');
        btnElement.classList.add('btn-correct');
        feedbackEl.textContent = "Correct!";
        feedbackEl.className = "text-center mt-3 fw-bold text-success";
    } else {
        btnElement.classList.remove('btn-outline-primary');
        btnElement.classList.add('btn-incorrect');
        feedbackEl.textContent = "Incorrect.";
        feedbackEl.className = "text-center mt-3 fw-bold text-danger";

        // Highlight the correct one
        const correctBtn = document.querySelector(`button[data-index="${state.currentProgressionIndex}"]`);
        if (correctBtn) {
            correctBtn.classList.remove('btn-outline-primary');
            correctBtn.classList.add('btn-correct');
        }
    }

    updateStatsUI();
    document.getElementById('btn-next').classList.remove('d-none');
}

function updateStatsUI() {
    document.getElementById('stat-total').textContent = state.stats.total;
    document.getElementById('stat-correct').textContent = state.stats.correct;
    const accuracy = state.stats.total === 0 ? 0 : Math.round((state.stats.correct / state.stats.total) * 100);
    document.getElementById('stat-accuracy').textContent = `${accuracy}%`;
}

function resetStats() {
    state.stats.total = 0;
    state.stats.correct = 0;
    updateStatsUI();
}