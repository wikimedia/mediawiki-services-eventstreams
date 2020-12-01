'use strict';

const fs = require('fs');
const _ = require('lodash');
const kafkaSse = require('kafka-sse');
const express = require('express');

const {
    urlGetObject,
    uriGetFirstObject,
} = require('@wikimedia/url-get');

const sUtil = require('../lib/util');
const eUtil = require('../lib/eventstreams-util');
const HTTPError = sUtil.HTTPError;

/**
 * This file exports a function that configures the ExpressJS router to
 * serve /v2/stream/{stream} using information about streams to expose
 * obtained from stream_config_uri.
 */

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * Loads stream configs from app.conf.stream_config_uri.
 * Regex stream names are not supported and will be removed.
 * Streams without a topics setting will be removed.
 * If a stream_aliases setting is found for a stream, that stream
 * config will be duplicated and also keyed by each stream alias.
 *
 * Some stream config settings will be used to augment the OpenAPI spec.
 * See updateSpec below.
 *
 * @param {Object} app
 * @param {Object} app.conf
 * @param {string} app.conf.stream_config_uri
 *  A URI from which stream configs will be requested. This URI should resolve to a JSON
 *  object keyed by stream name with stream config settings.
 * @param {string} app.conf.stream_config_object_path
 *  If set, the stream configs are expected to live in a subobject
 *  of the result object returned from stream_config_uri at this dotted path.
 * @param {Object} app.conf.stream_config_uri_options
 * @param {string} app.conf.stream_config_ttl
 *  How long in seconds stream configs live in cache before being recached.
 *  0 or unset means no expiration.
 * @param {string} app.conf.stream_config_defaults
 *  Defaults to use for stream configs.  This will be applied to the object fetched
 *  from stream_config_uri like _.defaultsDeep(streamConfigs, app.conf.stream_config_defaults)
 * @param {Array<string>} app.conf.allowed_streams
 *  If provided, stream configs will be filtered for streams that are in this list.
 * @param {string} app.conf.schema_latest_version
 *  If given, and no $schema is found in a stream config, a schema URI will
 *  attempt to be constructed a /${schema_title}/${schema_latest_version}.
 *  If this is not set, no schema URU will be inferred using schema_title.
 * @param {Array<string>} app.conf.schema_base_uris
 *  If provided, relative $schema urls for a stream will attempt to be resolved from these.
 * @param {Object} app.conf.schema_uri_options
 */
async function loadStreamConfigs(app) {
    let streamConfigs;
    if (_.isUndefined(app.conf.stream_config_uri)) {
        throw new Error('Must set stream_config_uri with URI of streams to expose.');
    }

    app.logger.log('info', `Loading stream configs from ${app.conf.stream_config_uri}`);
    streamConfigs = await urlGetObject(
        app.conf.stream_config_uri,
        app.conf.stream_config_uri_options || {}
    );

    // If stream_config_object_path was configured,
    // expect the config settings for stream to exist at that path.
    if (app.conf.stream_config_object_path) {
        streamConfigs = _.get(streamConfigs, app.conf.stream_config_object_path);
    }

    // Merge any stream_config_extra overides with fetched stream config
    _.defaultsDeep(streamConfigs, app.conf.stream_config_defaults);

    streamConfigs = _.pickBy(streamConfigs, (streamConfig, streamName) => {
        // eventstreams does not support regex stream keys, so remove those.
        if (streamName.startsWith('/')) {
            app.logger.log(
                'trace',
                `Regex stream names are not supported, removing ${streamName}.`
            );
            return false;
        }

        // We need defined topics in order to consume from a stream.
        if (_.isUndefined(streamConfig.topics)) {
            app.logger.log('trace', `${streamName} does not have configured topics, removing.`);
            return false;
        }

        // Also if allowed_streams is an array, remove any non allowed streams.
        if (
            app.conf.allowed_streams &&
            !app.conf.allowed_streams.includes(streamName)
        ) {
            app.logger.log(
                'trace',
                `${streamName} is not in the list of allowed_streams, removing.`
            );
            return false;
        }

        // Else this stream is allowed.
        return true;
    });

    // Augment streamConfigs with extra info from defaults and schema.
    await Promise.all(_.keys(streamConfigs).map(async (streamName) => {
        const streamConfig = streamConfigs[streamName];

        // Add a nice default description.
        if (_.isUndefined(streamConfig.description)) {
            streamConfig.description = `${streamName} events.`;
        }

        if (_.isUndefined(streamConfig.schema)) {
            if (
                _.isUndefined(streamConfig.$schema) &&
                streamConfig.schema_title &&
                app.conf.schema_base_uris &&
                app.conf.schema_latest_version
            ) {
                streamConfig.$schema =
                    `/${streamConfig.schema_title}/${app.conf.schema_latest_version}`;
            }

            if (streamConfig.$schema) {
                try {
                    app.logger.log(
                        'debug',
                        `Fetching schema for ${streamName} at ${streamConfig.$schema}`
                    );
                    streamConfig.schema = await uriGetFirstObject(
                        streamConfig.$schema,
                        app.conf.schema_base_uris,
                        undefined,
                        app.conf.schema_uri_options
                    );
                } catch (error) {
                    app.logger.log('warn', {
                        msg: `Failed fetching schema for ${streamName} at ` +
                            `${streamConfig.$schema}, not augmenting OpenAPI spec with schema.`,
                        error,
                    });
                }
            }
        }

        // If this stream has stream_aliases defined, duplicate this stream config
        // keyed by this name. When updating the dynamic spec below, and when
        // figuring out what streams are subscribed to, this alias can be used
        // as a shortcut route for a stream name, but the original stream name is
        // still exposed as a route too.
        if (streamConfig.stream_aliases) {
            streamConfig.stream_aliases.forEach(stream_alias => {
                streamConfigs[stream_alias] = _.cloneDeep(streamConfig);
                streamConfigs[stream_alias].description +=
                    `\n\n(NOTE: This stream is an alias of ${streamName})`;
                // Remove the stream_aliases from this copied stream config.
                // stream_aliases should only be set on the canonical stream config.
                delete streamConfigs[stream_alias].stream_aliases;
            });
        }
    }));

    // 'sort' streamConfigs by stream name and then return it.
    // streamConfigs are used to generated the dynamic OpenAPI spec,
    // and it is nice to see the routes in order in /?doc.
    return Object.keys(streamConfigs).sort().reduce((r, k) => {
        r[k] = streamConfigs[k];
        return r;
    }, {});
}

/**
 * Updates the OpenAPI spec at app.conf.spec with path routes exposing
 * the streams declared in streamConfigs.
 *
 * streamConfig.description will be used for the route path description.
 * If streamConfig.schema is given, it will be
 * used as the route path responses schema and example.
 *
 * @param {Object} app
 * @param {Object} streamConfigs
 */
function updateSpec(app, streamConfigs) {
    // Update the /v2/stream/{stream} path spec with the list of available streams.
    app.conf.spec.paths['/v2/stream/{streams}'].get.parameters[0].schema.items.enum =
        _.keys(streamConfigs);

    // Make an OpenAPI spec paths entry for each stream declared in streamConfigs.
    _.forOwn(streamConfigs, (streamConfig, streamName) => {
        // The /v2/stream/{streams} route is the only 'real' route, the stream specific ones
        // are maintained for API clarity and documentation.  Use the /v2/stream/{streams}
        // route as a base for each of the stream specific routes.
        const streamRouteSpec = _.cloneDeep(app.conf.spec.paths['/v2/stream/{streams}']);
        // The stream specific routes do not take a {streams} parameter.  It is the first
        // listed, so shift the parameters array to remove it.
        streamRouteSpec.get.parameters.shift();
        streamRouteSpec.get.summary = `${streamName} events`;

        if (streamConfig.description) {
            // Use the streamConfig description in the route description.
            streamRouteSpec.get.description = streamConfig.description;
        }
        if (streamConfig.schema_title) {
            streamRouteSpec.get.description += `\n\nSchema title: ${streamConfig.schema_title}`;
        }

        if (streamConfig.schema) {
            const schema  = _.cloneDeep(streamConfig.schema);
            const examples = schema.examples;
            // Remove OpenAPI unsupported JSONSchema keywords.
            // See: https://swagger.io/docs/specification/data-models/keywords/
            delete schema.$schema;
            delete schema.$id;
            delete schema.examples;

            // Use the schema in the route response
            streamRouteSpec.get.responses['200'].content['application/json'].schema = schema;
            streamRouteSpec.get.responses['200'].content['text/event-stream'].schema = schema;

            if (!_.isEmpty(examples)) {
                // Use the schema examples in the route response.
                streamRouteSpec.get.responses['200'].content['application/json'].example =
                    examples[0];
                streamRouteSpec.get.responses['200'].content['text/event-stream'].example =
                    examples[0];
            }
        }

        // Add the stream specific route to the OpenAPI spec.
        app.conf.spec.paths[`/v2/stream/${streamName}`] = streamRouteSpec;
    });

}

/**
 * Set up the /v2/stream/{stream} route using stream config.
 * @param {Object} app
 */
module.exports = async (app) => {
    let streamConfigs = await loadStreamConfigs(app);
    updateSpec(app, streamConfigs);
    app.logger.log('trace', { msg: 'Loaded stream configs', streamConfigs });

    if (_.isEmpty(streamConfigs)) {
        throw new Error(
            `No stream configs were configuerd to be exposed in ${app.conf.stream_config_uri}`
        );
    }

    // If we loaded stream_config_uri and it should have a TTL, referesh it every TTL seconds.
    if (!app.conf.streams && app.conf.stream_config_uri && app.conf.stream_config_ttl) {
        setInterval(async () => {
            try {
                streamConfigs = await loadStreamConfigs(app);
                updateSpec(app, streamConfigs);
                app.logger.log('trace', {
                    msg: `Reloaded stream configs after ${app.conf.stream_config_ttl} seconds`,
                    streamConfigs
                });
            } catch (error) {
                app.logger.log('warn', {
                    msg: 'Caught error while reloading stream configs. ' +
                        'Keeping previous stream configs and routes.',
                    error
                });
            }
        }, app.conf.stream_config_ttl * 1000);
    }

    // Connected clients per stream and client IP service-runner metric.
    // This is a guage and indicates the current number of connected clients.
    const connectedClientsMetric = app.metrics.makeMetric({
        type: 'Gauge',
        name: 'connected-clients',
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
        name: 'client-connections-total',
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

        const requestedStreams = req.params.streams.split(',');
        // Ensure all requested streams are available.
        const invalidStreams = requestedStreams.filter(s => !_.includes(_.keys(streamConfigs), s));
        if (invalidStreams.length > 0) {
            throw new HTTPError({
                status: 400,
                type: 'not_found',
                title: 'Stream Not Found',
                detail: `Invalid streams: ${invalidStreams.join(',')}`
            });
        }

        const topics = _.uniq(_.flatMap(
            _.pick(streamConfigs, requestedStreams),
            streamConfig => streamConfig.topics
        ));

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

        requestedStreams.forEach((stream) => {
            // Increment the number of current connections for this stream using this key.
            // NOTE: This is a guage so we have to decrement it when the client is disconnected too.
            connectedClientsMetric.increment(1, [stream, clientIp]);
        });
        // Increment the total counter of clients ever connected to this combination of streams.
        clientConnectionsTotalMetric.increment(1, [requestedStreams.sort().join(',')]);

        // Increment the number of connctions for this clientIp
        connectionCountPerIp[clientIp] = (connectionCountPerIp[clientIp] || 0) + 1;

        // After the connection is closed, decrement the number
        // of current connections for these streams.
        function decrementConnectionCount() {
            app.logger.log('debug/stats', `Decrementing connection counters for ${clientIp}`);
            requestedStreams.forEach((stream) => {
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
                // eslint-disable-next-line no-underscore-dangle
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

    const uiEnabled = app.conf.stream_ui_enabled || true;
    if (uiEnabled) {
        if (!fs.existsSync(`${__dirname}/../ui/dist`)) {
            throw new Error(
                'Cannot enable HTML stream GUI at /v2/ui: The ui/dist directory does not exist.' +
                ' Run `npm run build-ui`.'
            );
        }

        app.logger.log('debug', 'Enabling HTML stream GUI at /v2/ui');
        app.use('/v2/ui', express.static(`${__dirname}/../ui/dist`));
        app.use(express.static(`${__dirname}/../ui/dist`));
    }

    return {
        path: '/v2',
        api_version: 2,
        skip_domain: true,
        router
    };
};

