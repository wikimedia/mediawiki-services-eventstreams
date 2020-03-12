'use strict';

const os = require('os');
const _ = require('lodash');
const P = require('bluebird');
const kafkaSse = require('kafka-sse');

const sUtil = require('../lib/util');
const eUtil = require('../lib/eventstreams-util');

const IntervalCounter = eUtil.IntervalCounter;

const HTTPError = sUtil.HTTPError;

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * The main application object reported when this module is require()d
 */
let app;


module.exports = function(appObj) {

    app = appObj;

    // Connected clients per stream and client IP service-runner metric.
    // This is a guage and indicates the current number of connected clients.
    const connectedClientsMetric = app.metrics.makeMetric({
        type: 'Gauge',
        name: `connected-clients`,
        prometheus: {
            name: 'eventstreams_connected_clients',
            help: 'Connected clients per stream guage',
            staticLabels: { service: app.metrics.getServiceName() },
        },
        labels: {
            names: ['stream', 'client_ip'],
            omitLabelNames: true,
        }
    });

    // This is a counter of the total number of client connections ever made.
    // We don't care so much about the totals by client IP here, so it is not a label.
    // Also, since clients can connect to multiple streams at once, we keep track
    // of total connections per list of streams, not individual streams.
    // This helps us keep track of how folks connect and use streams together over time.
    // The streams label will be a sorted comma separated string list
    // of streams the client has subscribed to.
    // https://phabricator.wikimedia.org/T238658#5947574
    const clientConnectionsTotalMetric = app.metrics.makeMetric({
        type: 'Counter',
        name: `client-connections-total`,
        prometheus: {
            name: 'eventstreams_client_connections_total',
            help: 'Client connections total per combination of subscribed streams',
            staticLabels: { service: app.metrics.getServiceName() },
        },
        labels: {
            names: ['streams'],
            omitLabelNames: true,
        }
    });

    // Keep track of currently connected client IPs for poor-man's rate limiting.
    const connectionCountPerIp = {};

    router.get('/stream/:streams', (req, res) => {
        const clientIp = req.headers['x-client-ip'] || 'UNKNOWN';

        // ensure the requesting client hasn't gone over the concurrent connection limits.
        if (app.conf.client_ip_connection_limit) {
            if (!req.headers['x-client-ip']) {
                throw new HTTPError({
                    status: 400,
                    type: 'bad_request',
                    title: 'Missing Required X-Client-IP Header',
                    detail: 'X-Client-IP is a required request header'
                });
            }

            const clientIpConnectionCount = connectionCountPerIp[clientIp] || 0;
            if (clientIpConnectionCount >= app.conf.client_ip_connection_limit) {
                throw new HTTPError({
                    status: 429,
                    type: 'too_many_requests',
                    title: 'Too Many Concurrent Connections From Your Client IP',
                    detail: 'Your HTTP client is likely opening too many concurrent connections.'
                });
            }
        }

        const streams = req.params.streams.split(',');
        // Ensure all requested streams are available.
        const invalidStreams = streams.filter(stream => !(stream in app.conf.streams));
        if (invalidStreams.length > 0) {
            throw new HTTPError({
                status: 400,
                type: 'not_found',
                title: 'Stream Not Found',
                detail: `Invalid streams: ${invalidStreams.join(',')}`
            });
        }

        // Get the list of topics that make up the requested streams.
        const topics = _.flatMap(streams, stream => app.conf.streams[stream].topics);

        // If since param is provided, it will be used to consume from
        // a point in time in the past, if Last-Event-ID doesn't already
        // have assignments in it.
        let atTimestamp = req.query.since;
        // If not a milliseconds timestamp, attempt to parse it into one.
        if (atTimestamp && isNaN(atTimestamp)) {
            atTimestamp = Date.parse(atTimestamp);
        }
        // If atTimestamp is defined but is still not a number milliseconds timestamp,
        // throw HTTPError.
        if (atTimestamp !== undefined && isNaN(atTimestamp)) {
            throw new HTTPError({
                status: 400,
                type: 'invalid_timestamp',
                title: 'Invalid timestamp',
                // eslint-disable-next-line max-len
                detail: `since timestamp is not a UTC milliseconds unix epoch and was not parseable: '${req.query.since}'`
            });
        }

        streams.forEach((stream) => {
            // Increment the number of current connections for this stream using this key.
            // NOTE: This is a guage so we have to decrement it when the client is disconnected too.
            connectedClientsMetric.increment(1, [stream, clientIp]);
        });
        // Increment the total counter of clients ever connected to this combination of streams.
        clientConnectionsTotalMetric.increment(1, [streams.sort().join(',')]);

        // Increment the number of connctions for this clientIp
        connectionCountPerIp[clientIp] = (connectionCountPerIp[clientIp] || 0) + 1;

        // After the connection is closed, decrement the number
        // of current connections for these streams.
        function decrementConnectionCount() {
            app.logger.log('debug/stats', `Decrementing connection counters for ${clientIp}`);
            streams.forEach((stream) => {
                connectedClientsMetric.decrement(1, [stream, clientIp]);
            });
            // Decrement the number of concurrent connections for this client ip
            // (never going below 0).
            connectionCountPerIp[clientIp] = Math.max(connectionCountPerIp[clientIp] - 1, 0);
        }
        // I'm not sure why, but the 'close' event is fired when the client closes the connection,
        // and the 'finish' event is fired when KafkaSSE closes the connection (due to an error).
        // Regsiter them both.
        res.on('close', decrementConnectionCount);
        res.on('finish', decrementConnectionCount);

        // Start the SSE EventStream connection with topics.
        return kafkaSse(req, res, topics,
            {
                // Using topics for allowedTopics may seem redundant, but it
                // prevents requests for /stream/streamA from consuming from topics
                // that are not configured for streamA by setting other topics
                // in the Last-Event-ID header.  Last-Event-ID topic, partition, offset
                // assignments will take precedence over topics parameter.
                allowedTopics:          topics,
                // Support multi DC Kafka clusters by using message timestamps
                // in Last-Event-ID instead of offsets.
                useTimestampForId:      true,
                // Give kafkaSse the request bunyan logger to use.
                logger:                 req.logger._logger,
                kafkaConfig:            app.conf.kafka,
                // Use the eventstreams custom deserializer to include
                // kafka message meta data in the deserialized message.meta object
                // that will be sent to the client as an event.
                deserializer:           eUtil.deserializer
            },
            atTimestamp
        );
    });

    return {
        path: '/v2',
        api_version: 2,
        skip_domain: true,
        router
    };
};
