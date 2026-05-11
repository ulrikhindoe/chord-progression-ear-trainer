# Chord Progression Ear Trainer App Specification

I want to build an app to train recognizing chord progressions.

The app is should be implemented with three files: `index.html`, `script.js` and `styles.css`. Keep `index.html` and `styles.css` as they are unless changes are needed to support new features.

## Tech Stack
- **Language**: JavaScript (Vanilla JS).
- **Audio Library**: Tone.js (preferred for scheduling and synthesis).
- **Styling**: Bootstrap for responsive design (`bootstrap.min.css`, `bootstrap.bundle.min.js`). These files are already present.

## Data Structure
The app is configured with a list of chord progressions using Roman Numeral analysis.

See `spec-data.md` for the data structure.

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
  - **Voice Leading**: Implement smooth voice leading. Choose inversions for subsequent chords that minimize the total distance notes move from the previous chord (nearest neighbor).
  - **Chord length**: 1 measure (4 beats).
- **Playback Options**:
  - **Loop progression**: Toggle to loop the progression. If looping, keep the specific generated inversions constant for all rounds.
  - **Add bass note**: Toggle to play an additional root note in a lower octave (e.g., octave 2 or 3) to ground the harmony. Make the bass note louder than the other chord tones (e.g. +2dB) in order to make it stand out.
  - **Bossa Nova Drum Rhythm**: Toggle to play a bossa nova drum rhythm along with the chord progression. **Crucially, the rhythm must be perfectly in sync with the chords from the very first loop, not just subsequent loops.**
  - **Drum Volume**: Adjustable slider to control the volume of the drum set.
  - **Tempo**: Adjustable playback speed (BPM). Changing BPM should scale the duration of the chords. The range should be from 120 BPM to 250 BPM.

### 3. User Interaction
- **Controls**: Play and Stop buttons.

### 3. Views

There are two views in the app: Training and Settings. When the app is started the Training view is displayed.

#### 3.1 Training View

- Top section
  - To the left
    - Statistics shown like this: "Correct: 3/4 (75%)" followed by a link "reset" that will reset the statistics
  - To the right
    - "Settings" button to go to Settings
- Control section
  - The three buttons in this secions are in one row
  - Button named "Play" to play the current progression
    - Must always be shown
    - **Must always be visible** (do not hide it when playback starts).
    - If "Play" is pressed again the same progression with the same inversions should be played.
  - Button named "Stop" to stop the current progression.
    - The button is only shown if looping is selected.
  - Button named "Next" to proceed to the next progression
    - Enabled after answering
    - Disabled when it is pressed
    - When pressed play the next progression immediately
- Chords section
  - There is a button for each chord in the progression labelled 1,2,3...
  - The buttons must be wide enough so they are easy to press
  - When a chord is played the corresponding button is highlighted
  - When pressing a chord button the related chord is played as long the button is pressed
- Progression choice section
  - There is a button for each of the progression in the exercise
  - User clicks the button they think matches the progression played.
  - The width of the button should be adjusted to fit the text in the button
  - If the correct progression is pressed the button will turn green
  - If an incorrect progression is pressed the button will turn red and the correct progression will turn green
  - Green and red buttons will return to the normal color when the Next button is pressed
  - Under the buttons provide immediate visual feedback (Correct/Incorrect).

#### 3.2 Settings View
- No section should have internal scrolling (the page should scroll naturally).
- "Training" button on the top of the page to go to Training.
  - When pressed the exercise is updated according to the new settings but the current statistics are kept.- Select progressions to train on
- All progressions defined
  - "Select all" and "Deselect all" buttons
- Options
  - Loop Progression
  - Add Bass Note
  - Bossa Nova Drum Rhythm
  - Drum Volume Slider
  - Tempo Slider (BPM)

### 4. State Persistence
- **Local Storage**: Save the user's state (selected progressions, statistics, and settings) to the browser's `localStorage` whenever it changes, so progress and configuration are preserved across sessions.
- **Robustness**: The state loading mechanism must be robust. When initializing the app, read and parse the state from `localStorage` inside a `try...catch` block. Validate that the data structure is consistent with what the current code expects. If the data is invalid, missing, or outdated due to an app update, safely discard it and fall back to the default state to prevent the app from crashing or getting stuck.