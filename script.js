const chordProgressions = [
    { name: "i V", chords: ["i", "V"] },
    { name: "i v", chords: ["i", "v"] },
    { name: "i iv", chords: ["i", "iv"] },
    { name: "i IV", chords: ["i", "IV"] },
    { name: "I V", chords: ["I", "V"] },
    { name: "I IV", chords: ["I", "IV"] },
    { name: "i bIII", chords: ["i", "bIII"] },
    { name: "i bVI", chords: ["i", "bVI"] },
    { name: "i bVII", chords: ["i", "bVII"] },
    { name: "I ii", chords: ["I", "ii"] },
    { name: "I iii", chords: ["I", "iii"] },
    { name: "I vi", chords: ["I", "vi"] },
    { name: "i bVI bIII bVII", chords: ["i", "bVI", "bIII", "bVII"] },
    { name: "I IV V I", chords: ["I", "IV", "V", "I"] },
    { name: "ii V I", chords: ["ii", "V", "I"] },
    { name: "I V vi IV", chords: ["I", "V", "vi", "IV"] },
    { name: "I vi IV V", chords: ["I", "vi", "IV", "V"] },
    { name: "i iv V i", chords: ["i", "iv", "V", "i"] },
    { name: "I IV I V", chords: ["I", "IV", "I", "V"] }
];

// --- State Management ---
const state = {
    selectedProgressions: [], // Indices of selected progressions
    currentProgressionIndex: -1,
    currentKeyMidi: 60, // Middle C as default, will be randomized
    currentVoicing: [], // Array of { notes: [midi...], bass: midi, duration: '1m' }
    isPlaying: false,
    stats: { correct: 0, total: 0 },
    hasAnswered: false,
    settings: {
        loop: false,
        bass: false,
        tempo: 120
    }
};

// --- Tone.js Setup ---
let polySynth;
let bassSynth;
let transportScheduleId = null;

function initAudio() {
    if (!polySynth) {
        polySynth = new Tone.PolySynth(Tone.Synth).toDestination();
        polySynth.volume.value = -2; // Slightly lower to mix well with bass
    }
    if (!bassSynth) {
        bassSynth = new Tone.Synth().toDestination();
        bassSynth.volume.value = 0; // +2dB relative to polySynth (approx)
    }
}

// --- Logic: Roman Numeral Parsing & Voice Leading ---

const ROMAN_INTERVALS = {
    'i': 0, 'ii': 2, 'iii': 4, 'iv': 5, 'v': 7, 'vi': 9, 'vii': 11
};

function parseRoman(symbol) {
    let s = symbol;
    let accidental = 0;
    if (s.startsWith('b')) {
        accidental = -1;
        s = s.substring(1);
    } else if (s.startsWith('#')) {
        accidental = 1;
        s = s.substring(1);
    }

    const lower = s.toLowerCase();
    const isMajor = s === s.toUpperCase();
    const interval = ROMAN_INTERVALS[lower];

    return {
        interval: interval + accidental,
        isMajor: isMajor
    };
}

function getTriad(rootMidi, isMajor) {
    return [rootMidi, rootMidi + (isMajor ? 4 : 3), rootMidi + 7];
}

function getInversions(notes) {
    const [r, t, f] = notes;
    // Shift to be around C4 (60) for better voice leading calculation
    // We normalize octaves later, but for generating raw shapes:
    return [
        [r, t, f],           // Root pos
        [t, f, r + 12],      // 1st inv
        [f, r + 12, t + 12]  // 2nd inv
    ];
}

function getAveragePitch(notes) {
    return notes.reduce((a, b) => a + b, 0) / notes.length;
}

function generateVoicing(progressionIndex, keyMidi) {
    const progression = chordProgressions[progressionIndex];
    const voicing = [];
    let prevNotes = null;

    progression.chords.forEach(symbol => {
        const parsed = parseRoman(symbol);
        // Calculate root note of the chord
        let chordRoot = keyMidi + parsed.interval;

        // Normalize chord root to be within a reasonable range (e.g., octave 3-4)
        // We want the chords to stay around middle C (60) generally
        while (chordRoot > 67) chordRoot -= 12;
        while (chordRoot < 55) chordRoot += 12;

        const baseTriad = getTriad(chordRoot, parsed.isMajor);
        const inversions = getInversions(baseTriad);

        let bestNotes;

        if (!prevNotes) {
            // First chord: random inversion
            const r = Math.floor(Math.random() * 3);
            bestNotes = inversions[r];

            // Shift to octave 4 area
            const avg = getAveragePitch(bestNotes);
            const shift = Math.round((60 - avg) / 12) * 12;
            bestNotes = bestNotes.map(n => n + shift);
        } else {
            // Subsequent chords: nearest neighbor
            const prevAvg = getAveragePitch(prevNotes);
            let minDist = Infinity;

            // Try all inversions at different octaves to find closest
            inversions.forEach(inv => {
                // Check 3 octaves: -1, 0, +1 relative to base calculation
                for (let octaveShift = -12; octaveShift <= 12; octaveShift += 12) {
                    const candidate = inv.map(n => n + octaveShift);
                    const candAvg = getAveragePitch(candidate);

                    // Distance metric: sum of absolute differences of sorted notes
                    // (Simple approximation for voice leading)
                    // Actually, just centroid distance is often enough for simple triads,
                    // but let's do sum of distances for sorted notes to be more precise.
                    const sortedPrev = [...prevNotes].sort((a, b) => a - b);
                    const sortedCand = [...candidate].sort((a, b) => a - b);
                    let dist = 0;
                    for(let i=0; i<3; i++) dist += Math.abs(sortedPrev[i] - sortedCand[i]);

                    if (dist < minDist) {
                        minDist = dist;
                        bestNotes = candidate;
                    }
                }
            });
        }

        // Bass note: Root note in octave 2 or 3 (Midi 36-59)
        let bassNote = chordRoot;
        while (bassNote >= 48) bassNote -= 12; // Prefer lower
        if (bassNote < 36) bassNote += 12;

        voicing.push({
            notes: bestNotes,
            bass: bassNote,
            duration: "1m"
        });
        prevNotes = bestNotes;
    });

    return voicing;
}

// --- UI Functions ---

function renderProgressionsList() {
    const list = document.getElementById('progressions-list');
    list.innerHTML = '';
    chordProgressions.forEach((p, index) => {
        const item = document.createElement('label');
        item.className = 'list-group-item d-flex gap-2';
        item.innerHTML = `
            <input class="form-check-input flex-shrink-0" type="checkbox" value="${index}" checked>
            <span>
                <strong>${p.name}</strong>
                <small class="d-block text-muted">${p.chords.join(' - ')}</small>
            </span>
        `;
        list.appendChild(item);
    });
    updateSelectedProgressions();
}

function updateSelectedProgressions() {
    const checkboxes = document.querySelectorAll('#progressions-list input[type="checkbox"]');
    state.selectedProgressions = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));
}

function updateStats() {
    const { correct, total } = state.stats;
    const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);
    document.getElementById('stats-display').textContent = `Correct: ${correct}/${total} (${percentage}%)`;
}

function renderTrainingView() {
    // Render Chord Buttons
    const chordContainer = document.getElementById('chord-buttons-container');
    chordContainer.innerHTML = '';
    if (state.currentProgressionIndex !== -1) {
        const progression = chordProgressions[state.currentProgressionIndex];
        progression.chords.forEach((_, i) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-dark chord-btn';
            btn.textContent = i + 1;
            btn.dataset.index = i;

            // Mouse/Touch events for previewing chord
            const startChord = () => playSingleChord(i);
            const stopChord = () => stopSingleChord();

            btn.addEventListener('mousedown', startChord);
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); startChord(); });
            btn.addEventListener('mouseup', stopChord);
            btn.addEventListener('mouseleave', stopChord);
            btn.addEventListener('touchend', stopChord);

            chordContainer.appendChild(btn);
        });
    }

    // Render Progression Choice Buttons
    const progContainer = document.getElementById('progression-buttons-container');
    progContainer.innerHTML = '';

    // We show buttons for all progressions present in the current exercise set
    // (i.e., selected progressions).
    state.selectedProgressions.forEach(idx => {
        const p = chordProgressions[idx];
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-primary progression-btn';
        btn.textContent = p.name;
        btn.onclick = () => checkAnswer(idx, btn);
        progContainer.appendChild(btn);
    });

    // Reset feedback
    document.getElementById('feedback-display').textContent = '';
    document.getElementById('feedback-display').className = 'h4 fw-bold';

    // Update controls
    document.getElementById('next-btn').disabled = true;
    document.getElementById('stop-btn').style.display = state.settings.loop ? 'inline-block' : 'none';
}

function highlightChordButton(index) {
    const btns = document.querySelectorAll('.chord-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (index >= 0 && index < btns.length) {
        btns[index].classList.add('active');
    }
}

// --- Playback Logic ---

async function playProgression() {
    await Tone.start();
    initAudio();

    if (state.isPlaying) {
        stopPlayback();
        // If play is pressed again, we restart.
        // Small delay to ensure clean restart
        setTimeout(startTransport, 100);
    } else {
        startTransport();
    }
}

function startTransport() {
    state.isPlaying = true;
    Tone.Transport.bpm.value = state.settings.tempo;

    // Clear previous events
    Tone.Transport.cancel();

    const voicing = state.currentVoicing;
    const loopLength = voicing.length; // assuming 1m per chord

    // Schedule chords
    voicing.forEach((chord, i) => {
        Tone.Transport.schedule((time) => {
            // Trigger UI
            Tone.Draw.schedule(() => {
                highlightChordButton(i);
            }, time);

            // Trigger Sound
            const notes = chord.notes.map(n => Tone.Frequency(n, "midi").toNote());
            polySynth.triggerAttackRelease(notes, "1m", time);

            if (state.settings.bass) {
                const bassNote = Tone.Frequency(chord.bass, "midi").toNote();
                bassSynth.triggerAttackRelease(bassNote, "1m", time);
            }
        }, `${i}:0:0`); // Measure:Beat:Sixteenth
    });

    // Schedule cleanup at end of progression (if not looping)
    if (!state.settings.loop) {
        Tone.Transport.schedule((time) => {
            Tone.Draw.schedule(() => {
                highlightChordButton(-1);
                state.isPlaying = false;
            }, time);
        }, `${loopLength}:0:0`);
    }

    // Loop settings
    if (state.settings.loop) {
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = `${loopLength}:0:0`;
    } else {
        Tone.Transport.loop = false;
    }

    Tone.Transport.position = 0;
    Tone.Transport.start();
}

function stopPlayback() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    // Release any hanging notes (safety)
    if (polySynth) polySynth.releaseAll();
    if (bassSynth) bassSynth.triggerRelease();

    highlightChordButton(-1);
    state.isPlaying = false;
}

function playSingleChord(index) {
    if (!state.currentVoicing[index]) return;
    initAudio();
    const chord = state.currentVoicing[index];
    const notes = chord.notes.map(n => Tone.Frequency(n, "midi").toNote());
    polySynth.triggerAttack(notes);
    if (state.settings.bass) {
        const bassNote = Tone.Frequency(chord.bass, "midi").toNote();
        bassSynth.triggerAttack(bassNote);
    }
}

function stopSingleChord() {
    if (polySynth) polySynth.releaseAll();
    if (bassSynth) bassSynth.triggerRelease();
}

// --- Game Logic ---

function nextExercise() {
    if (state.selectedProgressions.length === 0) {
        alert("Please select at least one progression in Settings.");
        return;
    }

    // Pick random progression
    const randIndex = Math.floor(Math.random() * state.selectedProgressions.length);
    state.currentProgressionIndex = state.selectedProgressions[randIndex];

    // Pick random key (C=60 to B=71)
    state.currentKeyMidi = 60 + Math.floor(Math.random() * 12);

    // Generate voicing
    state.currentVoicing = generateVoicing(state.currentProgressionIndex, state.currentKeyMidi);

    state.hasAnswered = false;
    renderTrainingView();
    playProgression();
}

function checkAnswer(selectedIndex, btnElement) {
    if (state.hasAnswered) return; // Prevent multiple answers

    state.hasAnswered = true;
    state.stats.total++;

    const isCorrect = selectedIndex === state.currentProgressionIndex;
    const feedbackEl = document.getElementById('feedback-display');

    if (isCorrect) {
        state.stats.correct++;
        btnElement.classList.remove('btn-outline-primary');
        btnElement.classList.add('btn-success-custom');
        feedbackEl.textContent = "Correct!";
        feedbackEl.classList.add('text-success');
        feedbackEl.classList.remove('text-danger');
    } else {
        btnElement.classList.remove('btn-outline-primary');
        btnElement.classList.add('btn-danger-custom');
        feedbackEl.textContent = "Incorrect";
        feedbackEl.classList.add('text-danger');
        feedbackEl.classList.remove('text-success');

        // Highlight correct answer
        const buttons = document.querySelectorAll('.progression-btn');
        buttons.forEach(b => {
            if (b.textContent === chordProgressions[state.currentProgressionIndex].name) {
                b.classList.remove('btn-outline-primary');
                b.classList.add('btn-success-custom');
            }
        });
    }

    updateStats();
    document.getElementById('next-btn').disabled = false;
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // Init UI
    renderProgressionsList();

    // Settings View Toggle
    const trainingView = document.getElementById('training-view');
    const settingsView = document.getElementById('settings-view');

    document.getElementById('settings-btn').onclick = () => {
        stopPlayback();
        trainingView.style.display = 'none';
        settingsView.style.display = 'block';
    };

    document.getElementById('training-btn').onclick = () => {
        settingsView.style.display = 'none';
        trainingView.style.display = 'block';
        // If we haven't started yet or list changed, maybe restart?
        // Spec says: "When pressed the exercise is updated according to the new settings but the current statistics are kept."
        // This implies we should probably start a new exercise or at least re-render.
        // If the current progression is no longer in the selected list, we MUST start new.
        // Even if it is, re-generating is safer to apply settings.
        nextExercise();
    };

    // Settings Controls
    document.getElementById('select-all-btn').onclick = () => {
        document.querySelectorAll('#progressions-list input').forEach(cb => cb.checked = true);
        updateSelectedProgressions();
    };

    document.getElementById('deselect-all-btn').onclick = () => {
        document.querySelectorAll('#progressions-list input').forEach(cb => cb.checked = false);
        updateSelectedProgressions();
    };

    document.getElementById('progressions-list').addEventListener('change', updateSelectedProgressions);

    document.getElementById('loop-checkbox').addEventListener('change', (e) => {
        state.settings.loop = e.target.checked;
        // Update Stop button visibility immediately if in training view
        document.getElementById('stop-btn').style.display = state.settings.loop ? 'inline-block' : 'none';
        // Update transport if playing
        Tone.Transport.loop = state.settings.loop;
    });

    document.getElementById('bass-checkbox').addEventListener('change', (e) => {
        state.settings.bass = e.target.checked;
    });

    const tempoSlider = document.getElementById('tempo-slider');
    const tempoValue = document.getElementById('tempo-value');
    tempoSlider.addEventListener('input', (e) => {
        state.settings.tempo = parseInt(e.target.value);
        tempoValue.textContent = state.settings.tempo;
        Tone.Transport.bpm.value = state.settings.tempo;
    });

    // Training Controls
    document.getElementById('play-btn').onclick = playProgression;
    document.getElementById('stop-btn').onclick = stopPlayback;
    document.getElementById('next-btn').onclick = nextExercise;

    document.getElementById('reset-stats').onclick = (e) => {
        e.preventDefault();
        state.stats = { correct: 0, total: 0 };
        updateStats();
    };

    // Initial Start
    // We need to wait for user interaction to start audio context usually.
    // We can initialize the first exercise but not play it yet.
    // Or we wait for "Play" to be pressed first time?
    // Spec: "When the app is started the Training view is displayed."
    // "Button named 'Next' ... Enabled after answering".
    // This implies we are in a state where a question is active.
    // So we should generate one.

    // Ensure at least one progression is selected
    if (state.selectedProgressions.length === 0) {
        // Select all by default
        document.querySelectorAll('#progressions-list input').forEach(cb => cb.checked = true);
        updateSelectedProgressions();
    }

    // Setup first exercise
    // Pick random progression
    const randIndex = Math.floor(Math.random() * state.selectedProgressions.length);
    state.currentProgressionIndex = state.selectedProgressions[randIndex];
    state.currentKeyMidi = 60 + Math.floor(Math.random() * 12);
    state.currentVoicing = generateVoicing(state.currentProgressionIndex, state.currentKeyMidi);
    renderTrainingView();

    // Note: We don't auto-play on load because browsers block AudioContext.
    // User must click Play.
});