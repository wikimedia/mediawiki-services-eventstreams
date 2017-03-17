'use strict';

const preq = require('preq');
const sUtil = require('../lib/util');

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * The main application object reported when this module is require()d
 */
let app;

/**
 * Local cache of schema request results so we don't
 * request them more than once.
 */
const schemaResultCache = new Map();

// word characters, / . and -
const schemaURIRegex = /^[\w/.-]+$/;
function validateSchemaURI(schemaURI) {
    return schemaURI.match(schemaURIRegex);
}

function schemaRoute(req, res) {
    /**
     * Sends the schemaResult object back as the originating client result.
     */
    function sendSchemaResult(schemaResult) {
        res.status(schemaResult.status)
            .type(schemaResult.headers['content-type'])
            .send(schemaResult.body);
    }

    /**
     * Saves schemaResult in schemaResultCache and sets content-type
     * if it is not set.
     */
    function cacheSchemaResult(key, schemaResult) {
        // Make sure content-type is set if it isn't already.
        if (!('content-type' in schemaResult.headers)) {
            schemaResult.headers('content-type', 'application/json');
        }
        schemaResultCache.set(key, schemaResult);
    }

    /**
     * Caches schemaResult and then sends it to the client.
     */
    function cacheAndSendSchemaResult(key, schemaResult) {
        cacheSchemaResult(key, schemaResult);
        sendSchemaResult(schemaResult);
    }

    // Can't use named route req param here, because schemaUris have / in them.
    const schemaURI = req.params[0];
    // validate schemaURI
    if (!validateSchemaURI(schemaURI)) {
        throw new sUtil.HTTPError({
            status: 400,
            title: 'InvalidSchemaURI',
            type: 'user_error',
            detail: `Invalid schema uri: '${schemaURI}'`
        });
    }

    const schemaURL = `${app.conf.schema_proxy_uri}/${req.params[0]}`;
    // If we've already requested this schemaUri, then send
    // our cached schema response to the client.
    if (schemaResultCache.has(schemaURI)) {
        sendSchemaResult(schemaResultCache.get(schemaURI));
    } else {
        // Else, request the schemaUrl and then,
        // cache and send a http result or 4xx error.
        return preq.get({ uri: schemaURL })
        .then(cacheAndSendSchemaResult.bind(null, schemaURI))
        .catch(
            (e) => { return e.status >= 400 && e.status < 500; },
            cacheAndSendSchemaResult.bind(null, schemaURI)
        );
    }
}

module.exports = function(appObj) {
    app = appObj;

    // Only enable the /schema route if schema_proxy_uri is configured.
    if (app.conf.schema_proxy_uri) {
        router.get('/schema/*', schemaRoute);
    }
    return {
        path: '/v2',
        api_version: 2,
        skip_domain: true,
        router
    };
};
