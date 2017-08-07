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
      retur;
    }

    // Default to us-east-1
    AWS.config.update({region: (options.region) ? options.region : 'us-east-1'});

    let keyname = Date.now() + '.txt';
    if (options.keyPrefix) {
      keyname = options.keyPrefix + keyname;
    }

    // Validate the event - must have certain minimal parameters
    const error = validateEvent(event);
    if (error) {
      if (callback) {
        process.nextTick(() => {
          callback(error);
        });
      }
      return;
    }

    const body = {};
    body.response = response;
    if (options.fullLog) {
      body.event = event;
    } else {
      body.event = {
        session: {
          user: {userId: event.session.user.userId},
          sessionId: event.session.sessionId,
        },
        request: {
          type: event.request.type,
        },
      };

      if (event.request.intent) {
        body.event.request.intent = {};
        if (event.request.intent.name) {
          body.event.request.intent.name = event.request.intent.name;
        }
        if (event.request.intent.slots) {
          body.event.request.intent.slots = event.request.intent.slots;
        }
      }
    }

    const params = {Body: JSON.stringify(body),
      Bucket: options.bucket,
      Key: keyname};
    s3.putObject(params, (err, data) => {
      if (callback) {
        callback(err, data);
      }
    });
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
    } else if (options.s3) {
      // Bucket is required - other fields are optional
      if (!options.s3.bucket) {
        if (callback) {
          process.nextTick(() => {
            callback('Missing parameters');
          });
        }
        return;
      }

      // Delete the output file if it exists
      if (fs.existsSync(resultFile)) {
        fs.unlinkSync(resultFile);
      }

      // Default to us-east-1
      AWS.config.update({region: (options.s3.region) ? options.s3.region : 'us-east-1'});
      readS3Files(options.s3.bucket, options.s3.keyPrefix, (err, results) => {
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

// validates that we have a proper event to log
function validateEvent(event) {
  if (!event.session) {
    return 'Missing session';
  }
  if (!event.session.user) {
    return 'Missing user';
  }
  if (!event.session.user.userId) {
    return 'Missing userId';
  }
  if (!event.session.sessionId) {
    return 'Missing sessionId';
  }
  if (!event.request) {
    return 'Missing request';
  }
  if (!event.request.type) {
    return 'Missing request type';
  }

  // It's valid
  return undefined;
}

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
            log.timestamp = parseInt(filename.replace('.txt', ''));
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

// Read every file from an S3 bucket
function readS3Files(bucket, prefix, callback) {
  const results = [];

  // First get a full directory listing
  getKeyList(bucket, prefix, (err, keyList) => {
    if (err) {
      callback(err);
    } else {
      let keysToProcess = keyList.length;
      (function processFiles(keyList) {
        if (keyList.length === 0) {
          // All done!
          return;
        }

        const key = keyList.pop();
        const timestamp = parseInt(key.replace(prefix, '').replace('.txt', ''));
        s3.getObject({Bucket: bucket, Key: key}, (err, data) => {
          if (err) {
            // Oops, just abort the whole thing
            callback(err);
          } else {
            // OK, let's read this in and split into an array
            const text = data.Body.toString('ascii');
            const log = JSON.parse(text);
            log.timestamp = timestamp;
            results.push(log);

            // Is that it?
            if (--keysToProcess === 0) {
              callback(null, results);
            }
          }
        });

        processFiles(keyList);
      })(keyList);
    }
  });
}

function getKeyList(bucket, prefix, callback) {
  const keyList = [];

  // Loop thru to read in all keys
  (function loop(firstRun, token) {
    const params = {Bucket: bucket};
    if (prefix) {
      params.Prefix = prefix;
    }

    if (firstRun || token) {
      params.ContinuationToken = token;

      const listObjectPromise = s3.listObjectsV2(params).promise();
      return listObjectPromise.then((data) => {
        let i;

        for (i = 0; i < data.Contents.length; i++) {
          keyList.push(data.Contents[i].Key);
        }
        if (data.NextContinuationToken) {
          return loop(false, data.NextContinuationToken);
        }
      });
    }
  })(true, null).then(() => {
    // Success - now parse these into stories
    callback(null, keyList);
  }).catch((err) => {
    callback(err);
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
