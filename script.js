// Data Structure
const chordProgressions = [
    { name: "i V", chords: ["i", "V"] },
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
    selectedIndices: [],
    currentProgressionIndex: null,
    currentKeyRoot: 60, // Middle C
    isPlaying: false,
    isLooping: false,
    useBass: false,
    stats: {
        total: 0,
        correct: 0
    },
    toneStarted: false,
    hasAnswered: false
};

// Tone.js Instruments
let polySynth;
let bassSynth;

// DOM Elements
const els = {
    setupSection: document.getElementById('setup-section'),
    gameSection: document.getElementById('game-section'),
    progressionList: document.getElementById('progression-list'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnDeselectAll: document.getElementById('btn-deselect-all'),
    btnStartGame: document.getElementById('btn-start-game'),
    btnPlay: document.getElementById('btn-play'),
    btnStop: document.getElementById('btn-stop'),
    btnSettings: document.getElementById('btn-settings'),
    toggleLoop: document.getElementById('toggle-loop'),
    toggleBass: document.getElementById('toggle-bass'),
    statusText: document.getElementById('status-text'),
    answerButtons: document.getElementById('answer-buttons'),
    feedbackArea: document.getElementById('feedback-area'),
    btnNext: document.getElementById('btn-next'),
    statTotal: document.getElementById('stat-total'),
    statCorrect: document.getElementById('stat-correct'),
    statAccuracy: document.getElementById('stat-accuracy')
};

// Initialization
function init() {
    renderProgressionList();
    attachEventListeners();
}

function renderProgressionList() {
    els.progressionList.innerHTML = '';
    chordProgressions.forEach((prog, index) => {
        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
            <input class="form-check-input progression-checkbox" type="checkbox" value="${index}" id="prog-${index}" checked>
            <label class="form-check-label" for="prog-${index}">
                ${prog.name}
            </label>
        `;
        els.progressionList.appendChild(div);
    });
}

function attachEventListeners() {
    els.btnSelectAll.addEventListener('click', () => setAllCheckboxes(true));
    els.btnDeselectAll.addEventListener('click', () => setAllCheckboxes(false));

    els.btnStartGame.addEventListener('click', async () => {
        await initAudio();
        startGame();
    });

    els.btnSettings.addEventListener('click', stopGame);

    els.btnPlay.addEventListener('click', () => {
        if (state.isPlaying) {
            stopPlayback();
            // Small delay to allow stop to process before restarting
            setTimeout(playCurrentProgression, 100);
        } else {
            playCurrentProgression();
        }
    });

    els.btnStop.addEventListener('click', stopPlayback);

    els.toggleLoop.addEventListener('change', (e) => {
        state.isLooping = e.target.checked;
        if (state.isPlaying) {
            // Restart to apply loop setting change immediately
            stopPlayback();
            setTimeout(playCurrentProgression, 100);
        }
    });

    els.toggleBass.addEventListener('change', (e) => {
        state.useBass = e.target.checked;
    });

    els.btnNext.addEventListener('click', nextRound);
}

function setAllCheckboxes(checked) {
    document.querySelectorAll('.progression-checkbox').forEach(cb => cb.checked = checked);
}

async function initAudio() {
    if (state.toneStarted) return;
    await Tone.start();

    polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination();
    polySynth.volume.value = -6;

    bassSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.5, release: 1 }
    }).toDestination();
    bassSynth.volume.value = -3;

    state.toneStarted = true;
}

function startGame() {
    // Get selected progressions
    const checkboxes = document.querySelectorAll('.progression-checkbox:checked');
    state.selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (state.selectedIndices.length === 0) {
        alert("Please select at least one progression.");
        return;
    }

    // Switch UI
    els.setupSection.classList.add('d-none');
    els.gameSection.classList.remove('d-none');

    // Reset Stats
    state.stats.total = 0;
    state.stats.correct = 0;
    updateStatsDisplay();

    // Render Answer Buttons
    renderAnswerButtons();

    // Start first round
    nextRound();
}

function stopGame() {
    stopPlayback();
    els.gameSection.classList.add('d-none');
    els.setupSection.classList.remove('d-none');
}

function renderAnswerButtons() {
    els.answerButtons.innerHTML = '';
    state.selectedIndices.forEach(index => {
        const prog = chordProgressions[index];
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-primary';
        btn.textContent = prog.name;
        btn.dataset.index = index;
        btn.addEventListener('click', () => handleAnswer(index));
        els.answerButtons.appendChild(btn);
    });
}

function nextRound() {
    stopPlayback();

    // Reset UI
    els.feedbackArea.classList.add('d-none');
    els.feedbackArea.className = 'alert d-none'; // Reset alert type
    els.btnNext.classList.add('d-none');
    els.statusText.textContent = "Listen...";
    state.hasAnswered = false;

    // Enable buttons
    const buttons = els.answerButtons.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('btn-success', 'btn-danger');
        btn.classList.add('btn-outline-primary');
    });

    // Pick random progression
    const randomIndex = Math.floor(Math.random() * state.selectedIndices.length);
    state.currentProgressionIndex = state.selectedIndices[randomIndex];

    // Pick random key (C3 to B3)
    // MIDI 48 (C3) to 59 (B3) for root reference
    state.currentKeyRoot = Math.floor(Math.random() * 12) + 48;

    playCurrentProgression();
}

function playCurrentProgression() {
    if (!state.toneStarted) return;

    stopPlayback();
    state.isPlaying = true;
    els.statusText.textContent = "Playing...";

    const prog = chordProgressions[state.currentProgressionIndex];
    const chordDuration = "1n"; // 1 measure per chord (assuming 4/4, so 4 beats)
    // Actually let's make it faster: "2n" (half note)
    const durationVal = "2n";

    Tone.Transport.cancel();

    const events = prog.chords.map((roman, i) => {
        const { notes, bassNote } = generateChordNotes(roman, state.currentKeyRoot);
        return {
            time: `${i} * ${durationVal}`,
            notes: notes,
            bass: bassNote,
            duration: durationVal
        };
    });

    // Schedule chords
    events.forEach(event => {
        Tone.Transport.schedule((time) => {
            polySynth.triggerAttackRelease(event.notes, event.duration, time);
            if (state.useBass) {
                bassSynth.triggerAttackRelease(event.bass, event.duration, time);
            }
        }, event.time);
    });

    // Handle Looping
    const totalDuration = events.length * Tone.Time(durationVal).toSeconds();

    if (state.isLooping) {
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = totalDuration;
    } else {
        Tone.Transport.loop = false;
        // Schedule stop after playback
        Tone.Transport.schedule((time) => {
            Tone.Draw.schedule(() => {
                state.isPlaying = false;
                els.statusText.textContent = state.hasAnswered ? "Finished" : "Waiting for answer...";
            }, time);
        }, totalDuration);
    }

    Tone.Transport.start();
}

function stopPlayback() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    // Release any hanging notes
    polySynth.releaseAll();
    bassSynth.triggerRelease();
    state.isPlaying = false;
    if (!state.hasAnswered) {
        els.statusText.textContent = "Stopped";
    }
}

function handleAnswer(selectedIndex) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;
    stopPlayback();

    const isCorrect = selectedIndex === state.currentProgressionIndex;

    // Update Stats
    state.stats.total++;
    if (isCorrect) state.stats.correct++;
    updateStatsDisplay();

    // Feedback UI
    const buttons = els.answerButtons.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.disabled = true;
        const btnIndex = parseInt(btn.dataset.index);
        if (btnIndex === state.currentProgressionIndex) {
            btn.classList.remove('btn-outline-primary');
            btn.classList.add('btn-success'); // Highlight correct answer
        } else if (btnIndex === selectedIndex && !isCorrect) {
            btn.classList.remove('btn-outline-primary');
            btn.classList.add('btn-danger'); // Highlight wrong selection
        }
    });

    els.feedbackArea.classList.remove('d-none');
    if (isCorrect) {
        els.feedbackArea.classList.add('alert-success');
        els.feedbackArea.textContent = "Correct! Well done.";
    } else {
        els.feedbackArea.classList.add('alert-danger');
        const correctName = chordProgressions[state.currentProgressionIndex].name;
        els.feedbackArea.textContent = `Incorrect. The correct progression was: ${correctName}`;
    }

    els.btnNext.classList.remove('d-none');
    els.statusText.textContent = isCorrect ? "Correct!" : "Incorrect";
}

function updateStatsDisplay() {
    els.statTotal.textContent = state.stats.total;
    els.statCorrect.textContent = state.stats.correct;
    const accuracy = state.stats.total === 0 ? 0 : Math.round((state.stats.correct / state.stats.total) * 100);
    els.statAccuracy.textContent = `${accuracy}%`;
}

// Music Theory Logic
function generateChordNotes(roman, keyRootMidi) {
    // Parse Roman Numeral
    const regex = /^([b#]*)([ivIV]+)(.*)$/;
    const match = roman.match(regex);

    if (!match) {
        console.error("Invalid roman numeral:", roman);
        return { notes: [], bassNote: null };
    }

    const accidental = match[1];
    const numeral = match[2];
    // const quality = match[3]; // Not using 7ths yet, assuming triads based on case

    // Scale degrees (Major scale intervals)
    const scaleDegrees = {
        'i': 0, 'ii': 2, 'iii': 4, 'iv': 5, 'v': 7, 'vi': 9, 'vii': 11
    };

    let semitoneOffset = scaleDegrees[numeral.toLowerCase()];

    // Apply accidental to root
    if (accidental === 'b') semitoneOffset -= 1;
    if (accidental === '#') semitoneOffset += 1;

    const isMajor = numeral === numeral.toUpperCase();
    const rootMidi = keyRootMidi + semitoneOffset;

    // Build Triad
    // Major: 0, 4, 7
    // Minor: 0, 3, 7
    // Diminished (vii usually): 0, 3, 6 (simplified logic: if lowercase and vii/ii, might be dim, but prompt says triads. Let's stick to simple Maj/Min for now unless 'o' is present)
    // For this app, let's strictly follow case: Upper=Maj, Lower=Min.
    // Note: 'vii' in Major is diminished, but 'bVII' (Mixolydian/Aeolian) is Major.

    let intervals = isMajor ? [0, 4, 7] : [0, 3, 7];

    // Inversions: Randomly pick 0, 1, or 2
    const inversion = Math.floor(Math.random() * 3);

    let notesMidi = intervals.map(interval => rootMidi + interval);

    if (inversion === 1) {
        notesMidi[0] += 12; // Move root up octave
    } else if (inversion === 2) {
        notesMidi[0] += 12; // Move root up
        notesMidi[1] += 12; // Move 3rd up
    }

    // Convert to Note Names
    const notes = notesMidi.map(m => Tone.Frequency(m, "midi").toNote());
    const bassNote = Tone.Frequency(rootMidi - 12, "midi").toNote(); // Bass one octave down

    return { notes, bassNote };
}

// Start
init();