# Chord Progression Ear Trainer App Specification

I want to build an app to train recoqnizing chord progressions.

The project includes four main files: `index.html`, `script.js` and `styles.css`.

## Tech Stack
- **Language**: JavaScript (React or Vanilla JS).
- **Audio Library**: Tone.js (preferred for scheduling and synthesis).
- **Styling**: Bootstrap for responsive design (`bootstrap.min.css`, `bootstrap.bundle.min.js`). These files are already present.

## Data Structure
The app is configured with a list of chord progressions using Roman Numeral analysis.

```javascript
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
```

## Core Features

### 1. Setup & Configuration
- Display a list of all available chord progressions with checkboxes.
- Allow the user to select a subset of progressions to train on.
- Option to set the number of progressions in the exercise (or continuous mode).

### 2. Playback Logic
- **Library**: Use Tone.js PolySynth.
- **Key**: Pick one the the twelve keys randomly
- **Chord Generation**:
  - Parse Roman numerals (e.g., "bVI" -> Flat 6 Major).
  - Chords are triads (Root, 3rd, 5th).
  - **Inversions**: Randomly select an inversion (Root, 1st, 2nd) for the chord.
  - **Voice Leading**: Ideally, keep chords close to each other in pitch, but random inversions are acceptable as per requirements.
- **Playback Options**:
  - **Loop**: Toggle to loop the progression. If looping, keep the specific generated inversions constant for all rounds.
  - **Bass**: Toggle to play an additional root note in a lower octave (e.g., octave 2 or 3) to ground the harmony.
- **Controls**: Play and Stop buttons.

### 3. Interaction & Game Loop
- There are two views: Training and Settings
- You go from Settings to Training by pressing a "Start training" button.
- You go from Training to Settings by pressing a "Settings" button.
- In settings you choose the subset of progressions to train on. You also have the option to add a bass note and the option to keep looping the progression
- When a progression plays, display buttons corresponding to the *selected* progressions.
- User clicks the button they think matches the progression played.
- Provide immediate visual feedback (Correct/Incorrect).
- Wait for "Next" click.
- If the "Play progression" is pressed again the same progression with the same inversions should be played.

### 4. Statistics
- Display:
  - Total progressions played.
  - Number correctly identified.
  - Accuracy percentage.
