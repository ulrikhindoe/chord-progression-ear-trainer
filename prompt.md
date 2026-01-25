# Chord Progression Ear Trainer App Specification

I want to build an app to train recognizing chord progressions.

The project includes four main files: `index.html`, `script.js` and `styles.css`.

## Tech Stack
- **Language**: JavaScript (Vanilla JS).
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

### 2. Playback Logic
- **Library**: Use Tone.js PolySynth.
- **Key**: Pick one of the twelve chromatic keys randomly.
- **Chord Generation**:
  - Parse Roman numerals (e.g., "bVI" -> Flat 6 Major).
  - Chords are triads (Root, 3rd, 5th).
  - **Inversions**: Randomly select an inversion (Root, 1st, 2nd) for the chord.
  - **Voice Leading**: Ideally, keep chords close to each other in pitch, but random inversions are acceptable as per requirements.
  - **Chord length**: 1.5 second
- **Playback Options**:
  - **Loop**: Toggle to loop the progression. If looping, keep the specific generated inversions constant for all rounds.
  - **Bass**: Toggle to play an additional root note in a lower octave (e.g., octave 2 or 3) to ground the harmony. Make the bass note louder than the other chord tones (e.g. +2dB) in order to make it stand out.
  - **Tempo**: Adjustable playback speed (BPM).
- **Controls**: Play and Stop buttons.

### 3. Views

There are two views in the app: Training and Settings. When the app is started the Training view is displayed.

#### 3.1 Training View
- "Settings" button to go to Settings
- Control section
  - Button named "Play" to play the current progression
  - Button named "Stop" to stop the current progression in case it is looping. The button is only shown if looping is selected.
  - Button named "Next" to proceed to the next progression (visible after answering). Play this new progression immediately
- Chords section
  - There is a button for each chord in the progression labelled 1,2,3...
  - When a chord is played the corresponding button is highlighted
  - When pressing a chord button the related chord is played as long the button is pressed
- Progression choice section
  - There is a button for each of the progression in the exercise
  - If the correct progression is pressed the button will turn green
  - If an incorrect progression is pressed the button will turn red and the correct progression will turn green
- Statistics section
  - Example: "Correct: 3/4 (75%)"
  - Small button or link to reset statistics

#### 3.2 Settings View
- Select progressions to train on
  - All progressions defined
  - "Select all" and "Deselect all" buttons
- Options
  - Loop Progression
  - Add Bass Note
  - Tempo Slider (BPM)
- "Training" button to go to Training. When pressed the exercise is updated according to the nw settings but the current statistics are kept.

### 4. Interaction & Game Loop
- You go from Settings to Training by pressing a "Start training" button.
- You go from Training to Settings by pressing a "Settings" button.
- **Audio Context**: Ensure `Tone.start()` is called on the first user interaction (e.g., pressing "Play") to enable audio in modern browsers.
- In settings you choose the subset of progressions to train on. You also have the option to add a bass note and the option to keep looping the progression
- When a progression plays, display buttons corresponding to the *selected* progressions.
- User clicks the button they think matches the progression played.
- Provide immediate visual feedback (Correct/Incorrect).
- Wait for "Next" click.
- If the "Play progression" is pressed again the same progression with the same inversions should be played.

### 5. Statistics
- Display:
  - Total progressions played.
  - Number correctly identified.
  - Accuracy percentage.
