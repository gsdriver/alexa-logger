//
// Test file
//

const logger = require('../index');

const options = {
  directory: 'logs',
};

logger.processLogs(options, 'logs/summary.csv', (err) => {
  console.log(err);
});
