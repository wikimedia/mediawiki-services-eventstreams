'use strict';

const kafkaSse = require('kafka-sse');
const rdkafkaStatsd = require('node-rdkafka-statsd');

const sUtil = require('../lib/util');
const eUtil = require('../lib/eventstreams-util');

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * The main application object reported when this module is require()d
 */
let app;


/**
 * kafkaSse function wrapper that uses app config and req logger.
 * This function only exists to DRY route creation below.
 */
function eventStream(req, res, topics) {
    return kafkaSse(req, res, topics, {
        // Using topics for allowedTopics may seem redundant, but it
        // prevents requests for /stream/streamA from consuming from topics
        // that are not configured for streamA by setting other topics
        // in the Last-Event-ID header.  Last-Event-ID topic, partition, offset
        // assignments will take precedence over topics parameter.
        allowedTopics:          topics,
        // Give kafkaSse the request bunyan logger to use.
        logger:                 req.logger._logger,
        kafkaConfig:            app.conf.kafka,
        // Use the eventstreams custom deserializer to include
        // kafka message meta data in the deserialized message.meta object
        // that will be sent to the client as an event.
        deserializer:           eUtil.deserializer,
        kafkaEventHandlers: {
            // Create a child of this app's metrics object to use
            // for consumer specific rdkafka metric reporting via node-rdkafka-statsd.
            // This will emit consumer specific metrics prefixed like:
            // eventstreams.rdkafka.2807ee91-bcc0-11e6-9e1f-a1c84e764327.
            'event.stats': rdkafkaStatsd(
                app.metrics.makeChild(`rdkafka.${req.headers['x-request-id']}`),
                { filterFn: eUtil.rdkafkaStatsFilter }
            )
        }
    });
}

module.exports = function(appObj) {

    app = appObj;

    const streamNames = Object.keys(app.conf.streams);

    // Create a new /stream/${stream} route for each stream name.
    streamNames.forEach((stream) => {
        router.get(`/stream/${stream}`, (req, res) => {
            // Increment the number of current connections for this stream.
            app.metrics.increment(`connections.stream.${stream}`);
            return eventStream(req, res, app.conf.streams[stream].topics)
            // After the connection is closed, decrement the number
            // of current connections for this stream.
            .finally(app.metrics.decrement.bind(null, `connections.stream.${stream}`));
        });
    });

    return {
        path: '/v2',
        api_version: 1,
        skip_domain: true,
        router
    };
};

