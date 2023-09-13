'use strict';

const fs = require('fs');
const sUtil = require('../lib/util');
const swaggerUi = require('../lib/swagger-ui');

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * The main application object reported when this module is require()d
 */
let app;

/**
 * GET /robots.txt
 * Instructs robots no indexing should occur on this domain.
 */
router.get('/robots.txt', (req, res) => {

    res.type('text/plain').end('User-agent: *\nDisallow: /\n');

});

/**
 * GET /
 * Main entry point. Currently it only responds if the spec or doc query
 * parameter is given, otherwise lets the next middleware handle it
 */
router.get('/', (req, res, next) => {

    if ({}.hasOwnProperty.call(req.query || {}, 'spec')) {
        res.json(app.conf.spec);
    } else if ({}.hasOwnProperty.call(req.query || {}, 'doc')) {
        return swaggerUi.processRequest(app, req, res);
    } else {
        // === EventStreams modification ===
        // Redirect / to /v2/ui or to /?doc
        const uiEnabled = app.conf.stream_ui_enabled &&
            fs.existsSync(`${__dirname}/../ui/dist`);
        if (uiEnabled) {
            res.redirect(303, '/v2/ui');
        } else {
            res.redirect(303, '/?doc');
        }
        // === End EventStreams modification ===
        next();
    }

});

// === EventStreams modification ===
/**
 * GET /rc
 * This is the deprecated RCStream service route.  It is no longer used, but
 * serve up something useful in case someone navigates here.
 */
router.get('/rc', (req, res, next) => {
    // Redirect /rc to documentation page
    res.redirect(301, '/?doc');
});
// === End EventStreams modification ===

module.exports = (appObj) => {

    app = appObj;

    return {
        path: '/',
        skip_domain: true,
        router
    };

};
