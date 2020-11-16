import Config from '@/config';

/**
 * Gets the list of stream names that can be consumed
 * from the configured EventStreams instance.
 * @return {promise} When resolved, will contain the list of stream names
 *                   that can be consumed from the configured EventStreams.
 */
function getAvailableStreams () {
  return new Promise(function (resolve) {
    fetch(Config.eventStreamsUri + '?spec')
      .then(function (response) { return response.json(); })
      .then(function (data) { resolve(formatAvailableStreams(data)); });
  });
}

// Extracts the stream names from the EventStreams spec.
function formatAvailableStreams (spec) {
  // /v2/stream/{streams} endpoint spec has a list of all available streams.
  return spec.paths['/v2/stream/{streams}'].get.parameters[0].schema.items.enum;
}

/**
 * Opens an SSE EventSource that consumes the passed stream names.
 * Subscribes the passed callback to be called whenever an event is consumed.
 * Finally, returns the EventSource object, so it can be closed.
 * @param streamList {array} List of stream names to be consumed.
 * @param onMessage {function} To be called whenever an event is consumed.
 * @returns {object} Corresponding EventSource object.
 */
function consumeStreams (streamList, onMessage) {
   const streamCSV = streamList.join(',');
   const streamUrl = Config.eventStreamsUri + "v2/stream/" + streamCSV;
   const eventSource = new EventSource(streamUrl);
   eventSource.onmessage = onMessage;
   return eventSource;
}

export default {
  getAvailableStreams,
  consumeStreams
};
