# alexa-logger
Utility functionality that manages request/response for Alexa utterances. This module generates a report that lets you see the interaction of your sessions grouped by user.

# Usage
The exposed functions from this library are `saveLog` which will save a request and response in a supplied AWS S3 bucket and `processLog` which will process a directory of log files for easy consumption.

```
saveLog(event, response, options, callback)

```

The arguments to this function are:

 * event - The event as passed into your skill's exported function
 * response - The response from your skill
 * options - an options structure defined below
 * callback - an optional callback function

The options structure is composed of the following fields with the following default values:

```
{
  bucket,             // Required - the name of the S3 bucket to write to
  region:'us-east-1', // The AWS region hosting the S3 bucket; default is 'us-east-1'
  keyPrefix:'',       // The prefix for the key that will be generated in this bucket
}
```

For example, if you want to write to a 'logs' directory off a 'mydata' S3 bucket, you could call this function as follows:

saveLog(event, 'Welcome to my skill', {bucket: 'mydata', keyPrefix: 'logs/'});

```

processLogs(options, resultFile, callback)
```

This function will process the logs from a directory and organize them by user and by session for easy processing. The content will be saved into a comma-separated file that you can easily view to get a sense of the intents and slot data being passed into your skill, as well as the responses that you are providing to your end customers.

The arguments to this function are:

 * options - an options structure defined below
 * resultFile - the file to write the final results to
 * callback - an optional callback function

The options structure is composed of the following fields:

```
{
  directory,  // If provided, logs will be read from the local filesystem
}
```

I hope you enjoy this utility module; contributions are welcome!