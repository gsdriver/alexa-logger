//
// Processes request/response log files from Alexa
//

'use strict';

const fs = require('fs');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

module.exports = {
  saveLog: function(event, response, options, callback) {
    // Bucket at minimum is mandatory
    if (!options || !options.bucket) {
      if (callback) {
        process.nextTick(() => {
          callback('Missing bucket');
        });
      }
    } else {
      // Default to us-east-1
      AWS.config.update({region: (options.region) ? options.region : 'us-east-1'});

      let keyname = Date.now() + '.txt';
      if (options.keyPrefix) {
        keyname = options.keyPrefix + keyname;
      }

      const params = {Body: JSON.stringify({event: event, response: response}),
        Bucket: options.bucket,
        Key: keyname};
      s3.putObject(params, (err, data) => {
        if (callback) {
          callback(err, data);
        }
      });
    }
  },
  processLogs: function(options, resultFile, callback) {
    // Options structure is required
    if (!options || !resultFile) {
      if (callback) {
        process.nextTick(() => {
          callback('Missing parameters');
        });
      }
      return;
    }

    // In this case, we'll read from a file directory
    if (options.directory) {
      // Delete the output file if it exists
      if (fs.existsSync(resultFile)) {
        fs.unlinkSync(resultFile);
      }

      // Read files and write to a CSV file
      readFiles(options.directory, (err, results) => {
        if (err) {
          if (callback) {
            callback(err);
          }
        } else {
          const text = processLogs(results);
          fs.writeFile(resultFile, text, callback);
        }
      });
    } else {
      // Only supported modes for now
      if (callback) {
        process.nextTick(() => {
          callback('Unsupported file access option');
        });
      }
    }
  },
};

// Read every file from the content directory
function readFiles(dirname, callback) {
  const results = [];

  fs.readdir(dirname, (err, filenames) => {
    if (err) {
      callback(err);
    } else {
      let fileCount = filenames.length;

      filenames.forEach((filename) => {
        fs.readFile(dirname + '/' + filename, 'utf-8', (err, content) => {
          if (err) {
            callback(err);
          } else {
            // Do a little processing
            const log = JSON.parse(content);
            log.timestamp = parseInt(filename.split('.')[0]);
            results.push(log);
            if (--fileCount === 0) {
              callback(null, results);
            }
          }
        });
      });
    }
  });
}

function processLogs(results) {
  // OK, now tie together sessions based on session ID
  // we will store intent name, slot, and response
  // This will then create a nice history that we can write
  const users = {};

  results.forEach((result) => {
    const userId = result.event.session.user.userId;
    const sessionId = result.event.session.sessionId;
    const timestamp = result.timestamp;

    const data = {
      intent: (result.event.request.type === 'IntentRequest')
        ? result.event.request.intent.name
        : result.event.request.type,
      response: (result.response) ? result.response : 'NO RESPONSE',
      timestamp: timestamp,
    };
    if (result.event.request.intent && result.event.request.intent.slots) {
      data.slots = result.event.request.intent.slots;
    }

    // We group these by user and then session ID
    if (!users[userId]) {
      users[userId] = {sessions: {}};
    }
    if (!users[userId].sessions[sessionId]) {
      users[userId].sessions[sessionId] = {};
      users[userId].sessions[sessionId].utterances = [];
    }

    users[userId].sessions[sessionId].utterances.push(data);
  });

  // Now write out each sessions
  let user;
  let session;
  let text = '';

  for (user in users) {
    if (user) {
      const sessions = users[user].sessions;
      text += user + '\n';
      for (session in sessions) {
        if (session) {
          sessions[session].utterances.sort((a, b) => (a.timestamp - b.timestamp));
          text += ',' + (new Date(sessions[session].utterances[0].timestamp)).toString() + '\n';
          sessions[session].utterances.forEach((utterance) => {
            text += ',,"' + utterance.intent + '","';
            if (utterance.slots) {
              text += JSON.stringify(utterance.slots).replace(/"/g, '""');
            }
            text += '","' + utterance.response.replace(/"/g, '""') + '"\n';
          });
        }
      }
    }
  }

  return text;
}
