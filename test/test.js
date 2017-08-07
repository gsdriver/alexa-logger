//
// Test file
//

const logger = require('../index');

const options = {
  directory: 'logs',
};

// No options
logger.processLogs(null, 'logs/summary.csv', (err) => {
  console.log(err);
});

logger.processLogs(options, 'logs/summary.csv', (err) => {
  console.log(err);
});
