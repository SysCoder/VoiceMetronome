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

// [START YourAction]
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

    app.ask(metronomeAudioResponse(app, beatsPerMinute, rhythm));
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

    app.ask(metronomeAudioResponse(app, nextBeatPerMinute, rhythm));
  }

  function tellHowManyBeatsPerMinutes (app) {
    let currentBeatsPerMinute = getTempoInformation(app, databaseContext);
    let rhythm = getRhythmInformation(app, databaseContext);

    app.ask(metronomeAudioResponse(app, currentBeatsPerMinute, rhythm));
  }

  function welcomeUserAndAskForReview(app) {
    if (app.userStorage.timesVisited) {
      app.userStorage.timesVisited += 1;
    } else {
      app.userStorage.timesVisited = 1;
    }

    if (app.userStorage.timesVisited == 1) {
      app.ask("Hello, welcome to Voice Metronome. "
              + "Please provide the beats per minute you would like to hear.");
    } else if (app.userStorage.timesVisited == 3) {
      app.ask("Thanks for continually using Voice Metronome. "
              + "To support Voice Metronome, please give me 5 stars on the Assistant directory. "
              + "What beats per minute would you like to hear?");
    } else {
      app.ask("Welcome back. What beats per minute would you like?");
    }
  }

  const actionMap = new Map();
  actionMap.set('input.temp_rhythm', responseHandler);
  actionMap.set('input.change_speed', changeRelativeSpeed);
  actionMap.set('input.tell_speed', tellHowManyBeatsPerMinutes);
  actionMap.set('input.welcome', welcomeUserAndAskForReview);

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

function metronomeAudioResponse(app, beatsPerMinute, rhythm) {
  if (beatsPerMinute < 20 || beatsPerMinute > 300) {
    return 'Please provide a beats per minute that is between 20 and 300.';
  }
  let baseUrl =
      "https://s3-us-west-2.amazonaws.com/metronome-audio/lowQuality/";
  let baseLongAudioUrl =
      "https://s3-us-west-2.amazonaws.com/metronome-audio/longPlayingAudio/";
  let fileName = "BPM" + beatsPerMinute + "_Rhythm" + rhythm + ".ogg";
  let beatAudioSSML = '<audio src="'
      + baseUrl
      + fileName
      + '">(Metronome sound)</audio>'

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

  let textForPhone = "On this device, the play time is limited to 2 minutes. ";

  let hasMediaPlayer =
      app.hasSurfaceCapability(app.SurfaceCapabilities.MEDIA_RESPONSE_AUDIO);


  let textForReview = "";
  if ()
  let textForReview = "Thanks for continually using Voice Metronome. To "
                      + "support Voice Metronome, please give me 5 stars on "
                      + "the Assistant directory. ";
  let beatDescription = beatsPerMinute + ' beats per minute. ' + maxOrMinBPMText + timeSignatureTerm;

  if (hasMediaPlayer) {
    const richMediaResponse = app.buildRichResponse()
      .addSimpleResponse(beatDescription)
      .addMediaResponse(app.buildMediaResponse()
        .addMediaObjects([
          app.buildMediaObject(beatDescription, baseLongAudioUrl + fileName)
        ]))
      .addSuggestions(['Speed up', 'Slow down', 'Leave']);
    return richMediaResponse;
  }

  // If a system does not have the media player, ssml for two minutes will be used.
  return '<speak>' + beatDescription + beatAudioSSML + textForPhone + 'Do you want Voice Metronome to continue?</speak>';
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
// [END YourAction]
