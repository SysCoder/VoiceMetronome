'use strict';

process.env.DEBUG = 'actions-on-google:*';
const App = require('actions-on-google').ApiAiApp;
const functions = require('firebase-functions');
var firebase = require('firebase-admin');
const TEMPO_RHYTHM = 'temp_rhythm';
const BEATS_PER_MINUTE = 'beatsPerMinute';
const dashbot = require('dashbot')("xxxxxxx").google;


var serviceAccount = require('./Metronomexxxxx.json');
var databaseContext;

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://metronome-dfcbd.firebaseio.com",
});

exports.selectMetronomeAudio = functions.https.onRequest((request, response) => {
  const app = new App({request, response});
  dashbot.configHandler(app);
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

  let userId = 12345;
  if (app.getUser()) {
    userId = app.getUser().userId;
  }

  // Fulfill action business logic
  function responseHandler (app) {
    let beatsPerMinute = getTempoInformation(app, databaseContext);
    let rhythm = getRhythmInformation(app, databaseContext);
    persistMetronomeSetting(app, userId, beatsPerMinute, rhythm);

    let hasScreen = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
    app.ask(metronomeAudioResponse(beatsPerMinute, rhythm, hasScreen));
  }

  function changeRelativeSpeed (app) {
    // Complete your fulfillment logic and send a response
    // Check for bounds
    let currentBeatsPerMinute = getTempoInformation(app, databaseContext);
    let rhythm = getRhythmInformation(app, databaseContext);

    let nextBeatPerMinute = currentBeatsPerMinute + speedDirectionToSpeedJump(app.getArgument("Speed"));

    nextBeatPerMinute = nextBeatPerMinute > 300 ? 300 : nextBeatPerMinute;
    nextBeatPerMinute = nextBeatPerMinute < 20 ? 20 : nextBeatPerMinute;
    persistMetronomeSetting(app, userId, nextBeatPerMinute, rhythm);

    // Since the Assistant on the phone does not support stacking audio sources or files longer than 2min
    let hasScreen = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
    app.ask(metronomeAudioResponse(nextBeatPerMinute, rhythm, hasScreen));
  }

  function tellHowManyBeatsPerMinutes (app) {
    let currentBeatsPerMinute = getTempoInformation(app, databaseContext);
    let rhythm = getRhythmInformation(app, databaseContext);

    // Since the Assistant on the phone does not support stacking audio sources or files longer than 2min
    let hasScreen = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
    app.ask(metronomeAudioResponse(currentBeatsPerMinute, rhythm, hasScreen));
  }

  const actionMap = new Map();
  actionMap.set('input.temp_rhythm', responseHandler);
  actionMap.set('input.change_speed', changeRelativeSpeed);
  actionMap.set('input.tell_speed', tellHowManyBeatsPerMinutes);

  firebase.database().ref('/user/' + userId + '/tempoAndRhythm').once("value", function(data) {
    databaseContext = data;
    app.handleRequest(actionMap);
  });

});

function speedDirectionToSpeedJump(speedDirection) {
  let relativeChangeForBeatPerMinute = 0;
  if (speedDirection == "faster") {
    relativeChangeForBeatPerMinute = 15;
  } else if (speedDirection == "much faster") {
    relativeChangeForBeatPerMinute = 30;
  } else if (speedDirection == "much much faster") {
    relativeChangeForBeatPerMinute = 60;
  } else if (speedDirection == "slower") {
    relativeChangeForBeatPerMinute = -15;
  } else if (speedDirection == "much slower") {
    relativeChangeForBeatPerMinute = -30;
  } else if (speedDirection == "much much slower") {
    relativeChangeForBeatPerMinute = -60;
  }
  return relativeChangeForBeatPerMinute;
}

function metronomeAudioResponse(beatsPerMinute, rhythm, hasScreen) {
  if (beatsPerMinute < 20 || beatsPerMinute > 300) {
    return 'Please provide a beats per minute that is between 20 and 300.';
  }
  let baseUrl =
      "https://s3-us-west-2.amazonaws.com/metronome-audio/lowQuality/";
  let fileName = "BPM" + beatsPerMinute + "_Rhythm" + rhythm + ".ogg";
  let beatAudioSSML = ('<audio src="'
      + baseUrl
      + fileName
      + '">(Metronome sound)</audio>')
      // Since the Assistant on the phone does not support stacking audio
      // sources longer than 2min
      .repeat(hasScreen ? 1 : 5);

  let maxOrMinBPMText = "";
  if (beatsPerMinute === 300) {
    maxOrMinBPMText = "This is the fastest tempo. ";
  } else if (beatsPerMinute === 20) {
    maxOrMinBPMText = "This is the slowest tempo. ";
  }

  let timeSignatureTerm = "";
  if (rhythm === 1) {
    timeSignatureTerm = "No rhythm. ";
  } else if (rhythm === 2) {
    timeSignatureTerm = "Marching rhythm. "
  } else if (rhythm === 3) {
    timeSignatureTerm = "Waltz rhythm. ";
  } else if (rhythm === 4) {
    timeSignatureTerm = "Common Time rhythm. ";
  }

  let textForPhone = "";
  if (hasScreen) {
    textForPhone = "On this device, the play time is limited to 2 minutes. ";
  }

  return '<speak>' + beatsPerMinute + ' beats per minute. ' + maxOrMinBPMText + timeSignatureTerm + beatAudioSSML + textForPhone + 'Do you want Voice Metronome to continue?</speak>';
}

// Check if a beats per minute was given.
 // Check if the device context has the beats per minute.
// Check the database for a previous beats per minute.
// If not give the default 120 beats per minute.
function getTempoInformation(app, databaseContext) {
  let beatsPerMinute = 120;
  if (app.getArgument("beatsPerMinute") != null) {
    beatsPerMinute = parseInt(app.getArgument("beatsPerMinute"));
  } else if (app.getArgument("TempoTerms") != null) {
    beatsPerMinute = parseInt(app.getArgument("TempoTerms"));
  } else if (app.getContextArgument(BEATS_PER_MINUTE, "tempo") != null) {
    beatsPerMinute = parseInt(app.getContextArgument(BEATS_PER_MINUTE, "tempo").value);
  } else if (databaseContext.val() != null) {
    beatsPerMinute = parseInt(databaseContext.val().tempo);
  }
  return beatsPerMinute;
}

function getRhythmInformation(app, databaseContext) {
  let rhythm = 1;
  if (app.getArgument("rhythm") != null) {
    rhythm = parseInt(app.getArgument("rhythm"));
  } else if (app.getContextArgument(TEMPO_RHYTHM, "rhythm") != null) {
    rhythm = parseInt(app.getContextArgument(TEMPO_RHYTHM, "rhythm").value);
  } else if (databaseContext.val() != null) {
    rhythm = parseInt(databaseContext.val().rhythm);
  }
  return rhythm;
}

function persistMetronomeSetting(app, userId, beatsPerMinute, rhythm) {
  if (beatsPerMinute >= 20 && beatsPerMinute <= 300) {
    let audioSetting =  {
                "tempo": beatsPerMinute,
                "rhythm": rhythm,
            };
    setSettingToDatabase(userId, audioSetting);
    app.setContext(TEMPO_RHYTHM, 100, audioSetting);
  }
}

function setSettingToDatabase(userId, tempo) {
  var update = {};
  update['/user/' + userId + '/tempoAndRhythm'] = tempo;
  firebase.database().ref().update(update);
}

function getTempoFromDatabase(userId) {
  return firebase.database().ref('user/' + userId + '/tempo');
}