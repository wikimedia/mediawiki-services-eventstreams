export default {
  // Set eventStreamsUri to the base URI of the EventStreams server
  // you want to view streams of.
  // A value of '/' will work with the locally running EventStreams service.
  // If you use this for development, don't use 'npm run serve', but rather
  // 'npm run build' and browse the ui from 'http://locahost:8092/v2/ui'
  // (port might change, depending on how you ran EventStreams server.js).
  // Caveat: You won't be able to consume streams this way locally.
  eventStreamsUri: '/'
  // eventStreamsUri: 'https://stream-beta.wmflabs.org/'
  // eventStreamsUri: 'https://stream.wikimedia.org/'
};
