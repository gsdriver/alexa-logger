//
// Test file
//

const logger = require('../index');

const options = {
  directory: 'logs',
  daterange: {},
};

function processResult(err, info) {
  if (err) {
    console.log(err);
  } else {
    console.log('Successful call ' + JSON.stringify(info));
  }
}

// No options
//logger.processLogs(null, 'summary.csv', processResult);

// Call one of these
//logger.processLogs(options, 'summary.csv', processResult);

options.daterange.start = (new Date('Sat Aug 05 2017 22:00:00 GMT-0700 (Pacific Daylight Time)')).valueOf();
logger.processLogs(options, 'summary.csv', processResult);

//options.daterange.end = (new Date('Sat Aug 05 2017 22:00:00 GMT-0700 (Pacific Daylight Time)')).valueOf();
//logger.processLogs(options, 'summary.csv', processResult);
