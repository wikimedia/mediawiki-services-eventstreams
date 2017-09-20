'use strict';

const os = require('os');
const kafkaSse = require('kafka-sse');
const rdkafkaStatsd = require('node-rdkafka-statsd');

const sUtil = require('../lib/util');
const eUtil = require('../lib/eventstreams-util');

const IntervalCounter = eUtil.IntervalCounter;

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
        deserializer:           eUtil.deserializer
    });
}

module.exports = function(appObj) {

    app = appObj;

    // Per-worker metrics will be prefixed with hostname.worker_id
    const workerMetricPrefix = `${os.hostname()}.${app.conf.worker_id}`;
    // This interval counter will be used to report the number of connected clients
    // per stream for this worker every statistics_interval_ms.
    const intervalCounter = new IntervalCounter(
        app.metrics.timing.bind(app.metrics),
        app.conf.statistics_interval_ms || 60000
    );

    // Create a new /stream/${stream} route for each stream name.
    const streamNames = Object.keys(app.conf.streams);
    streamNames.forEach((stream) => {
        router.get(`/stream/${stream}`, (req, res) => {
            // Increment the number of current connections for this stream using this key.
            const streamMetricKey = `${workerMetricPrefix}.connections.stream.${stream}`;
            intervalCounter.increment(streamMetricKey);

            // Start the EventStream
            return eventStream(req, res, app.conf.streams[stream].topics)

            // After the connection is closed, decrement the number
            // of current connections for this stream.
            .finally(intervalCounter.decrement.bind(intervalCounter, streamMetricKey));
        });
    });

    return {
        path: '/v2',
        api_version: 2,
        skip_domain: true,
        router
    };
};
