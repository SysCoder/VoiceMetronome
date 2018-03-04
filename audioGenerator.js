"use strict"
var fs = require('fs');
var childProcess = require('child_process');

var metronomeAudio = fs.createReadStream('../cowBell1.mp3');
var metronomeAudio2 = fs.createReadStream('../cowBell2.mp3');

var oneMillisEmpty = fs.createReadStream('../1MillisEmpty.mp3');
var tenMillisEmpty = fs.createReadStream('../10MillisEmpty.mp3');
var oneHundredMillisEmpty = fs.createReadStream('../100MillisEmpty.mp3');

//Ffmpeg.setFfmpegPath(ffmpeg.path);

for (let i = 20;i <= 300;i++) {
  for (let j = 3;j <= 3;j++) {
    console.log("Generating - BPM: " + i + " Rhythm: " + j);
    generateMetronomeSequence(i, j);
  }
}

function generateMetronomeSequence(beatPerMinute, rhythm) {
  // 200 is taken in account the length of the beat itself.
  let spacingForFileMillis = 60000 / beatPerMinute - 200;

  // Round up to the nearest milli second.
  let spacingForFileSeconds = Math.ceil(spacingForFileMillis) / 1000;

  // Create silence file for spacing.
  childProcess.execSync('sox -n -r 44100 -c 2 silence.ogg trim 0.0 ' + spacingForFileSeconds);

  console.log("spacingForFileSeconds: " + spacingForFileSeconds);

  let beatRhythm = "../cowBell1.ogg silence.ogg " + "../cowBell2.ogg silence.ogg ".repeat(rhythm - 1);

  let numberOfRepeatsUnderTwoMinutes = Math.floor(120 / (rhythm * (spacingForFileSeconds + 0.200 /* 0.200 for beat */)));
  console.log("numberOfRepeatsUnderTwoMinutes: " + numberOfRepeatsUnderTwoMinutes);
  childProcess.execSync('sox ' + beatRhythm + 'BPM' + beatPerMinute + '_Rhythm' + rhythm + '.ogg repeat ' + (numberOfRepeatsUnderTwoMinutes - 1));

}
