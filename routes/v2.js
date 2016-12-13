'use strict';

const kafkaSse  = require('kafka-sse');

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
    });
}


module.exports = function(appObj) {

    app = appObj;

    const stream_names = Object.keys(app.conf.streams);

    // Create a new /stream/${stream} route for each stream name.
    stream_names.forEach(stream => {
        router.get(`/stream/${stream}`, (req, res) => {
            return eventStream(req, res, app.conf.streams[stream].topics);
        });
    });

    return {
        path: '/v2',
        api_version: 1,
        skip_domain: true,
        router: router
    };
};

