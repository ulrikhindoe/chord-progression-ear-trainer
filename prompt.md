
# Prompt for AI

I want to build an app to train recoqnizing chord progressions.

The app is configured with a list of chord progressions. Could be something like this example:

let chordProgressions = [
    {
        "name": "i V",
        "chords": ["i", "V"]
    },
        {
        "name": "i bVI bIII bVII - Vivir mi vida",
        "chords": ["i", "bVI", "bIII", "bVII"]
    },
]

These chord progressions are listed in the app and I can select a subset I want to use for the training.

There is a button for each progression and when a progression is played I can select the one I think it is.

The chords are all triads and can be played randomly in any inversion.

On the page there are some options on how the progression is played:
- Loop the progression. In this case the same inversions are used for each repetition.
- Play an additional root note in a lower octave so it serves as a bass

There should be buttons to Play and Stop the exercise.

It should be possible to choose how many chord progressions are in the exercise.

Show statistics on how many progressions have been played and the number of correctly identified ones. Also show the percentage of the correctly identified ones.



