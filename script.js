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
    { name: "i iv V i", chords: ["i", "iv", "V", "i"] },
    { name: "i v IV i", chords: ["i", "v", "IV", "i"] },
    { name: "i bVII bVI V", chords: ["i", "bVII", "bVI", "V"] },
    { name: "i bIII bVII IV", chords: ["i", "bIII", "bVII", "IV"] },
    { name: "i bIII bVII iv", chords: ["i", "bIII", "bVII", "iv"] },
    { name: "i bIII v IV", chords: ["i", "bIII", "v", "IV"] },
    { name: "i bIII bVI bVII", chords: ["i", "bIII", "bVI", "bVII"] },
    { name: "i bIII iv bVI", chords: ["i", "bIII", "iv", "bVI"] },
    { name: "i iv bVII bIII", chords: ["i", "iv", "bVII", "bIII"] },
    { name: "i bVI iv V", chords: ["i", "bVI", "iv", "V"] },
    { name: "I V IV I", chords: ["I", "V", "IV", "I"] },
    { name: "I IV V I", chords: ["I", "IV", "V", "I"] },
    { name: "I ii V I", chords: ["I", "ii", "V", "I"] },
    { name: "I IV V IV", chords: ["I", "IV", "V", "IV"] },
    { name: "I vi IV V", chords: ["I", "vi", "IV", "V"] },
    { name: "I vi ii V", chords: ["I", "vi", "ii", "V"] },
    { name: "I IV I V", chords: ["I", "IV", "I", "V"] },
    { name: "I iii vi IV", chords: ["I", "iii", "vi", "IV"] },
    { name: "I V vi IV", chords: ["I", "V", "vi", "IV"] },
    { name: "I V ii IV", chords: ["I", "V", "ii", "IV"] },
    { name: "I III IV iv", chords: ["I", "III", "IV", "iv"] },
    { name: "iv i bIII bVII", chords: ["iv", "i", "bIII", "bVII"] },
    { name: "bIV bVII i bVII", chords: ["bIV", "bVII", "i", "bVII"] },
    { name: "ii V I vi", chords: ["ii", "V", "I", "vi"] },
    { name: "IV V iii vi", chords: ["IV", "V", "iii", "vi"] },
];

const defaultState = {
    selectedProgressions: chordProgressions.map((_, i) => i),
    stats: { correct: 0, total: 0 },
    settings: {
        loop: false,
        bass: false,
        bossa: false,
        improv: false,
        chordsVolume: -2,
        improvVolume: -10,
        drumVolume: -10,
        tempo: 120
    }
};

let state = null;
let currentProgressionIndex = -1;
let currentKeyMidi = 60;
let currentVoicing = [];
let previewingProgressionIndex = -1;
let isPlaying = false;
let improvLoop = null;
let hasAnswered = false;

// --- Tone.js Setup ---
let polySynth;
let bassSynth;
let kickSynth;
let hihatSynth;
let snareSynth;
let improvSynth;

function initAudio() {
    if (!polySynth) {
        polySynth = new Tone.PolySynth().toDestination();
    }
    if (!bassSynth) {
        bassSynth = new Tone.Synth().toDestination();
        bassSynth.volume.value = 0;
    }
    if (!kickSynth) {
        kickSynth = new Tone.MembraneSynth().toDestination();
    }
    if (!hihatSynth) {
        hihatSynth = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
        }).toDestination();
    }
    if (!snareSynth) {
        snareSynth = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 1,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
        }).toDestination();
    }
    if (!improvSynth) {
        improvSynth = new Tone.FMSynth({
            harmonicity: 1.5,
            modulationIndex: 8,
            envelope: { attack: 0.01, decay: 0.2, release: 0.1 },
            modulationEnvelope: { attack: 0.01, decay: 0.5, release: 0.1 }
        }).toDestination();
    }
    updateChordsVolume();
    updateDrumVolume();
    updateImprovVolume();
}

function updateChordsVolume() {
    if (polySynth) {
        polySynth.volume.value = state.settings.chordsVolume;
    }
}
function updateDrumVolume() {
    if (kickSynth) kickSynth.volume.value = state.settings.drumVolume;
    if (hihatSynth) hihatSynth.volume.value = state.settings.drumVolume - 10;
    if (snareSynth) snareSynth.volume.value = state.settings.drumVolume - 2;
}
function updateImprovVolume() {
    if (improvSynth) improvSynth.volume.value = state.settings.improvVolume;
}

// --- State Persistence ---
function loadState() {
    try {
        const stored = localStorage.getItem('chordTrainerState');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (
                parsed &&
                Array.isArray(parsed.selectedProgressions) &&
                parsed.stats &&
                typeof parsed.stats.correct === 'number' &&
                typeof parsed.stats.total === 'number' &&
                parsed.settings &&
                typeof parsed.settings.loop === 'boolean' &&
                typeof parsed.settings.bass === 'boolean' &&
                typeof parsed.settings.bossa === 'boolean' &&
                typeof parsed.settings.improv === 'boolean' &&
                typeof parsed.settings.chordsVolume === 'number' &&
                typeof parsed.settings.improvVolume === 'number' &&
                typeof parsed.settings.drumVolume === 'number' &&
                typeof parsed.settings.tempo === 'number'
            ) {
                state = parsed;
                // Enforce valid bounds
                if (state.settings.tempo < 120) state.settings.tempo = 120;
                if (state.settings.tempo > 250) state.settings.tempo = 250;
                state.selectedProgressions = state.selectedProgressions.filter(i => i >= 0 && i < chordProgressions.length);
                return;
            }
        }
    } catch (e) {
        console.warn("Failed to load state or invalid state, falling back to default.", e);
    }
    state = JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
    try {
        localStorage.setItem('chordTrainerState', JSON.stringify(state));
    } catch (e) {
        console.warn("Failed to save state", e);
    }
}

// --- Logic: Roman Numeral Parsing & Voice Leading ---
const ROMAN_INTERVALS = {
    'i': 0, 'ii': 2, 'iii': 4, 'iv': 5, 'v': 7, 'vi': 9, 'vii': 11
};

function parseRoman(symbol) {
    let s = symbol;
    let accidental = 0;
    if (s.startsWith('b')) { accidental = -1; s = s.substring(1); }
    else if (s.startsWith('#')) { accidental = 1; s = s.substring(1); }

    const isMajor = s === s.toUpperCase();
    const lower = s.toLowerCase();
    const interval = ROMAN_INTERVALS[lower];

    return { interval: interval + accidental, isMajor };
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
        let chordRoot = keyMidi + parsed.interval;

        while(chordRoot > 67) chordRoot -= 12;
        while(chordRoot < 55) chordRoot += 12;

        const isMajor = parsed.isMajor;
        const triad = [chordRoot, chordRoot + (isMajor ? 4 : 3), chordRoot + 7];

        const inversions = [
            triad,
            [triad[1], triad[2], triad[0] + 12],
            [triad[2], triad[0] + 12, triad[1] + 12]
        ];

        let bestNotes;
        if (!prevNotes) {
            bestNotes = inversions[Math.floor(Math.random() * 3)];
            const avg = getAveragePitch(bestNotes);
            const shift = Math.round((60 - avg) / 12) * 12;
            bestNotes = bestNotes.map(n => n + shift);
        } else {
            let minDist = Infinity;
            inversions.forEach(inv => {
                for (let octaveShift = -12; octaveShift <= 12; octaveShift += 12) {
                    const candidate = inv.map(n => n + octaveShift);
                    const sortedPrev = [...prevNotes].sort((a, b) => a - b);
                    const sortedCand = [...candidate].sort((a, b) => a - b);
                    let dist = 0;
                    for (let i = 0; i < 3; i++) {
                        dist += Math.abs(sortedPrev[i] - sortedCand[i]);
                    }
                    if (dist < minDist) {
                        minDist = dist;
                        bestNotes = candidate;
                    }
                }
            });
        }

        let bassNote = chordRoot;
        while (bassNote >= 48) bassNote -= 12;
        if (bassNote < 36) bassNote += 12;

        voicing.push({
            notes: bestNotes,
            bass: bassNote
        });
        prevNotes = bestNotes;
    });
    return voicing;
}

// --- Playback Logic ---
async function playProgression() {
    await Tone.start();
    initAudio();

    if (previewingProgressionIndex !== -1) {
        stopProgressionPreview();
    }

    if (isPlaying) {
        stopPlayback();
        setTimeout(startTransport, 50);
    } else {
        startTransport();
    }
}

function startTransport() {
    isPlaying = true;
    previewingProgressionIndex = -1;
    Tone.Transport.bpm.value = state.settings.tempo;
    Tone.Transport.cancel();

    if (improvLoop) {
        improvLoop.dispose();
        improvLoop = null;
    }

    const loopLength = currentVoicing.length;

    currentVoicing.forEach((chord, i) => {
        Tone.Transport.schedule((time) => {
            Tone.Draw.schedule(() => {
                highlightChordButton(i);
            }, time);

            const notes = chord.notes.map(n => Tone.Frequency(n, "midi").toNote());
            polySynth.triggerAttackRelease(notes, "1m", time);

            if (state.settings.bass) {
                const bassNote = Tone.Frequency(chord.bass, "midi").toNote();
                bassSynth.triggerAttackRelease(bassNote, "1m", time);
            }
        }, `${i}:0:0`);

        if (state.settings.bossa) {
            // Kick pattern
            Tone.Transport.schedule((time) => { kickSynth.triggerAttackRelease("C1", "8n", time); }, `${i}:0:0`);
            Tone.Transport.schedule((time) => { kickSynth.triggerAttackRelease("C1", "8n", time); }, `${i}:1:2`);
            Tone.Transport.schedule((time) => { kickSynth.triggerAttackRelease("C1", "8n", time); }, `${i}:2:0`);
            Tone.Transport.schedule((time) => { kickSynth.triggerAttackRelease("C1", "8n", time); }, `${i}:3:2`);

            // Hi-hat pattern
            for (let b = 0; b < 4; b++) {
                Tone.Transport.schedule((time) => { hihatSynth.triggerAttackRelease("32n", time); }, `${i}:${b}:0`);
                Tone.Transport.schedule((time) => { hihatSynth.triggerAttackRelease("32n", time); }, `${i}:${b}:2`);
            }

            // Snare/Rim pattern (Bossa clave simplified to 1 measure)
            Tone.Transport.schedule((time) => { snareSynth.triggerAttackRelease("G4", "16n", time); }, `${i}:0:0`);
            Tone.Transport.schedule((time) => { snareSynth.triggerAttackRelease("G4", "16n", time); }, `${i}:1:2`);
            Tone.Transport.schedule((time) => { snareSynth.triggerAttackRelease("G4", "16n", time); }, `${i}:3:0`);
        }
    });

    if (state.settings.improv) {
        const isMajorKey = !chordProgressions[currentProgressionIndex].chords[0].startsWith('i');
        const scaleIntervals = isMajorKey ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];

        const scaleNotes = [];
        for (let octave = 0; octave < 2; octave++) {
            scaleNotes.push(...scaleIntervals.map(interval => (currentKeyMidi + 12) + octave * 12 + interval));
        }

        let lastNote = currentKeyMidi + 12 + scaleIntervals[Math.floor(Math.random() * scaleIntervals.length)];

        improvLoop = new Tone.Loop(time => {
            const progress = Tone.Transport.progress;
            const loopLength = currentVoicing.length;
            const measureIndex = Math.floor(progress * loopLength);
            const chord = currentVoicing[measureIndex];
            if (!chord) return;

            const rhythms = [
                [{ offset: '0:0', duration: '8n' }, { offset: '0:1', duration: '8n' }, { offset: '0:2', duration: '4n' }],
                [{ offset: '0:0', duration: '4n' }, { offset: '0:2', duration: '4n' }],
                [{ offset: '0:0', duration: '8n' }, { offset: '0:1', duration: '8n' }, { offset: '0:2', duration: '8n' }, { offset: '0:3', duration: '8n' }],
                [{ offset: '0:0', duration: '2n' }],
                [{ offset: '0:0', duration: '4n' }, { offset: '0:1', duration: '4n' }, { offset: '0:2', duration: '4n' }, { offset: '0:3', duration: '4n' }]
            ];
            const currentRhythm = rhythms[Math.floor(Math.random() * rhythms.length)];

            const chordTones = chord.notes;
            const noteSelectionPool = [...chordTones, ...chordTones, ...scaleNotes];

            currentRhythm.forEach(r => {
                let bestNote = lastNote;
                let minDistance = Infinity;
                for (let i = 0; i < 10; i++) {
                    const candidate = noteSelectionPool[Math.floor(Math.random() * noteSelectionPool.length)];
                    if (!candidate) continue;
                    const dist = Math.abs(candidate - lastNote);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestNote = candidate;
                    }
                }
                while (bestNote > 84) bestNote -= 12;
                while (bestNote < 60) bestNote += 12;

                improvSynth.triggerAttackRelease(Tone.Frequency(bestNote, 'midi'), r.duration, time + Tone.Time(r.offset).toSeconds());
                lastNote = bestNote;
            });
        }, "1m").start(0);
    }

    if (!state.settings.loop) {
        Tone.Transport.schedule((time) => {
            Tone.Draw.schedule(() => {
                stopPlayback();
            }, time);
        }, `${loopLength}:0:0`);
    }

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
    if (polySynth) polySynth.releaseAll();
    if (bassSynth) bassSynth.triggerRelease();
    if (improvLoop) {
        improvLoop.dispose();
        improvLoop = null;
    }
    if (improvSynth) improvSynth.triggerRelease();

    highlightChordButton(-1);
    isPlaying = false;
    previewingProgressionIndex = -1;
}

async function playProgressionPreview(progressionIndex) {
    if (isPlaying) {
        stopPlayback();
    }
    if (previewingProgressionIndex !== -1) {
        stopProgressionPreview();
    }

    await Tone.start();
    initAudio();

    previewingProgressionIndex = progressionIndex;

    const previewKey = 60;
    const previewVoicing = generateVoicing(progressionIndex, previewKey);
    const loopLength = previewVoicing.length;

    Tone.Transport.bpm.value = state.settings.tempo;
    Tone.Transport.cancel();

    previewVoicing.forEach((chord, i) => {
        Tone.Transport.schedule(time => {
            const notes = chord.notes.map(n => Tone.Frequency(n, "midi").toNote());
            polySynth.triggerAttackRelease(notes, "1m", time);

            if (state.settings.bass) {
                const bassNote = Tone.Frequency(chord.bass, "midi").toNote();
                bassSynth.triggerAttackRelease(bassNote, "1m", time);
            }
        }, `${i}:0:0`);
    });

    Tone.Transport.loop = false;
    Tone.Transport.position = 0;
    Tone.Transport.start();
}

function stopProgressionPreview() {
    if (previewingProgressionIndex !== -1) {
        previewingProgressionIndex = -1;
        Tone.Transport.stop();
        Tone.Transport.cancel();
        if (polySynth) polySynth.releaseAll();
        if (bassSynth) bassSynth.triggerRelease();
        highlightChordButton(-1);
    }
}

function playSingleChord(index) {
    initAudio();
    const chord = currentVoicing[index];
    if (!chord) return;
    const notes = chord.notes.map(n => Tone.Frequency(n, "midi").toNote());
    polySynth.triggerAttack(notes);
    if (state.settings.bass) {
        bassSynth.triggerAttack(Tone.Frequency(chord.bass, "midi").toNote());
    }
}

function stopSingleChord() {
    if (polySynth) polySynth.releaseAll();
    if (bassSynth) bassSynth.triggerRelease();
}

// --- UI Rendering & Game Logic ---
function generateNewExercise() {
    if (state.selectedProgressions.length === 0) {
        state.selectedProgressions = chordProgressions.map((_, i) => i);
        saveState();
    }

    const rand = Math.floor(Math.random() * state.selectedProgressions.length);
    currentProgressionIndex = state.selectedProgressions[rand];
    currentKeyMidi = 60 + Math.floor(Math.random() * 12);
    currentVoicing = generateVoicing(currentProgressionIndex, currentKeyMidi);
    hasAnswered = false;

    renderTrainingView();
}

async function startNewExercise() {
    stopPlayback();
    generateNewExercise();
    await playProgression();
}

function renderTrainingView() {
    renderStats();

    const chordsContainer = document.getElementById('chord-buttons-container');
    chordsContainer.innerHTML = '';
    currentVoicing.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-dark chord-btn';
        btn.textContent = i + 1;

        const start = async () => {
            await Tone.start();
            stopPlayback();
            playSingleChord(i);
        };
        const stop = () => stopSingleChord();

        btn.addEventListener('mousedown', start);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
        btn.addEventListener('mouseup', stop);
        btn.addEventListener('mouseleave', stop);
        btn.addEventListener('touchend', stop);

        chordsContainer.appendChild(btn);
    });

    const progsContainer = document.getElementById('progression-buttons-container');
    progsContainer.innerHTML = '';

    state.selectedProgressions.forEach(idx => {
        const prog = chordProgressions[idx];
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-primary progression-btn';
        btn.textContent = prog.name;

        let longPressTimer;
        let isLongPress = false;

        const onPointerDown = (e) => {
            e.preventDefault();
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                playProgressionPreview(idx);
            }, 500);
        };

        const onPointerUp = (e) => {
            clearTimeout(longPressTimer);
            if (isLongPress) {
                e.preventDefault();
                stopProgressionPreview();
            }
        };

        const onPointerLeave = () => {
            clearTimeout(longPressTimer);
            if (isLongPress) {
                stopProgressionPreview();
            }
        };

        btn.addEventListener('mousedown', onPointerDown);
        btn.addEventListener('mouseup', onPointerUp);
        btn.addEventListener('mouseleave', onPointerLeave);
        btn.addEventListener('touchstart', onPointerDown, { passive: false });
        btn.addEventListener('touchend', onPointerUp);

        btn.onclick = () => !isLongPress && handleAnswer(idx, btn);
        progsContainer.appendChild(btn);
    });

    document.getElementById('feedback-display').textContent = '';
    document.getElementById('feedback-display').className = 'h4 fw-bold';

    document.getElementById('next-btn').disabled = true;
    document.getElementById('stop-btn').style.display = state.settings.loop ? 'inline-block' : 'none';
}

function highlightChordButton(index) {
    const btns = document.querySelectorAll('.chord-btn');
    btns.forEach((b, i) => {
        if (i === index) b.classList.add('active');
        else b.classList.remove('active');
    });
}

function renderStats() {
    const { correct, total } = state.stats;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    document.getElementById('stats-display').textContent = `Correct: ${correct}/${total} (${percentage}%)`;
}

function handleAnswer(selectedIndex, btnElement) {
    if (hasAnswered) return;
    hasAnswered = true;

    state.stats.total++;
    const isCorrect = selectedIndex === currentProgressionIndex;
    const feedbackEl = document.getElementById('feedback-display');

    if (isCorrect) {
        state.stats.correct++;
        btnElement.classList.replace('btn-outline-primary', 'btn-success-custom');
        feedbackEl.textContent = 'Correct!';
        feedbackEl.className = 'h4 fw-bold text-success';
    } else {
        btnElement.classList.replace('btn-outline-primary', 'btn-danger-custom');
        feedbackEl.textContent = 'Incorrect';
        feedbackEl.className = 'h4 fw-bold text-danger';

        const buttons = document.querySelectorAll('.progression-btn');
        state.selectedProgressions.forEach((idx, i) => {
            if (idx === currentProgressionIndex) {
                buttons[i].classList.replace('btn-outline-primary', 'btn-success-custom');
            }
        });
    }

    saveState();
    renderStats();
    document.getElementById('next-btn').disabled = false;
}

function renderSettingsView() {
    document.getElementById('loop-checkbox').checked = state.settings.loop;
    document.getElementById('bass-checkbox').checked = state.settings.bass;
    document.getElementById('bossa-checkbox').checked = state.settings.bossa;
    document.getElementById('improv-checkbox').checked = state.settings.improv;
    document.getElementById('chords-volume-slider').value = state.settings.chordsVolume;
    document.getElementById('improv-volume-slider').value = state.settings.improvVolume;
    document.getElementById('drum-volume-slider').value = state.settings.drumVolume;
    document.getElementById('tempo-slider').value = state.settings.tempo;
    document.getElementById('tempo-value').textContent = state.settings.tempo;

    const list = document.getElementById('progressions-list');
    list.innerHTML = '';
    chordProgressions.forEach((prog, idx) => {
        const label = document.createElement('label');
        label.className = 'list-group-item d-flex gap-2';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input flex-shrink-0';
        checkbox.value = idx;
        checkbox.checked = state.selectedProgressions.includes(idx);
        checkbox.onchange = () => {
            if (checkbox.checked) {
                if (!state.selectedProgressions.includes(idx)) {
                    state.selectedProgressions.push(idx);
                }
            } else {
                state.selectedProgressions = state.selectedProgressions.filter(i => i !== idx);
            }
            saveState();
        };

        const span = document.createElement('span');
        span.innerHTML = `<strong>${prog.name}</strong><small class="d-block text-muted">${prog.chords.join(' - ')}</small>`;

        label.appendChild(checkbox);
        label.appendChild(span);
        list.appendChild(label);
    });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initAudio(); // Initialize audio context and synths early

    const trainingView = document.getElementById('training-view');
    const settingsView = document.getElementById('settings-view');

    document.getElementById('settings-btn').onclick = () => {
        stopPlayback();
        renderSettingsView();
        trainingView.style.display = 'none';
        settingsView.style.display = 'block';
    };

    document.getElementById('training-btn').onclick = () => {
        settingsView.style.display = 'none';
        trainingView.style.display = 'block';
        generateNewExercise();
    };

    document.getElementById('play-btn').onclick = playProgression;
    document.getElementById('stop-btn').onclick = stopPlayback;
    document.getElementById('next-btn').onclick = () => {
        document.getElementById('next-btn').disabled = true;
        startNewExercise();
    };

    document.getElementById('reset-stats').onclick = (e) => {
        e.preventDefault();
        state.stats = { correct: 0, total: 0 };
        saveState();
        renderStats();
    };

    document.getElementById('loop-checkbox').onchange = (e) => {
        state.settings.loop = e.target.checked;
        saveState();
    };

    document.getElementById('bass-checkbox').onchange = (e) => {
        state.settings.bass = e.target.checked;
        saveState();
    };

    document.getElementById('bossa-checkbox').onchange = (e) => {
        state.settings.bossa = e.target.checked;
        saveState();
    };

    document.getElementById('improv-checkbox').onchange = (e) => {
        state.settings.improv = e.target.checked;
        saveState();
    };

    const chordsVolumeSlider = document.getElementById('chords-volume-slider');
    chordsVolumeSlider.oninput = (e) => {
        state.settings.chordsVolume = parseInt(e.target.value, 10);
        updateChordsVolume();
        saveState();
    };

    const improvVolumeSlider = document.getElementById('improv-volume-slider');
    improvVolumeSlider.oninput = (e) => {
        state.settings.improvVolume = parseInt(e.target.value, 10);
        updateImprovVolume();
        saveState();
    };


    const drumVolumeSlider = document.getElementById('drum-volume-slider');
    drumVolumeSlider.oninput = (e) => {
        state.settings.drumVolume = parseInt(e.target.value, 10);
        updateDrumVolume();
        saveState();
    };

    const tempoSlider = document.getElementById('tempo-slider');
    const tempoValue = document.getElementById('tempo-value');
    tempoSlider.oninput = (e) => {
        state.settings.tempo = parseInt(e.target.value, 10);
        tempoValue.textContent = state.settings.tempo;
        Tone.Transport.bpm.value = state.settings.tempo;
        saveState();
    };

    document.getElementById('select-all-btn').onclick = () => {
        state.selectedProgressions = chordProgressions.map((_, i) => i);
        saveState();
        renderSettingsView();
    };

    document.getElementById('deselect-all-btn').onclick = () => {
        state.selectedProgressions = [];
        saveState();
        renderSettingsView();
    };

    generateNewExercise();
});
