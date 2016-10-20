'use strict';

const sUtil = require('../lib/util');
const kafkaSse = require('kafka-sse');

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

    return {
        path: '/',
        api_version: 1,
        router: router
    };

};

