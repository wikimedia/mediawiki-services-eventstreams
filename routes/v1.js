'use strict';

const _         = require('lodash');
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
        allowedTopics:          app.conf.allowed_topics,
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

    // kafka-sse will use allowed_topics to make sure it will never allow
    // subscription to a topic not defined here.  We select all topics configured
    // for each stream route.
    app.conf.allowed_topics = _.uniq(_.flatten(
        stream_names.map(stream => app.conf.streams[stream].topics)
    ));

    // Create a new /v1/stream/${stream} route for each stream name.
    stream_names.forEach(stream => {
        router.get(`/stream/${stream}`, (req, res) => {
            return eventStream(req, res, app.conf.streams[stream].topics);
        });
    });

    return {
        path: '/v1',
        api_version: 1,
        skip_domain: true,
        router: router
    };
};

