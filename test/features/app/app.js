'use strict';

const preq   = require('preq');
const assert = require('../../utils/assert.js');
const Server = require('../../utils/server.js');

describe('express app', function () {

    this.timeout(20000);

    const server = new Server();

    before(() => server.start());

    after(() => server.stop());

    it('should get robots.txt', () => {
        return preq.get({
            uri: `${server.config.uri}robots.txt`
        }).then((res) => {
            assert.deepEqual(res.status, 200);
            assert.deepEqual(res.body, 'User-agent: *\nDisallow: /\n');
        });
    });

    it('should set CORS headers', () => {
        if (server.config.service.conf.cors === false) {
            return true;
        }
        return preq.get({
            uri: `${server.config.uri}robots.txt`
        }).then((res) => {
            assert.deepEqual(res.status, 200);
            assert.deepEqual(res.headers['access-control-allow-origin'], '*');
            assert.deepEqual(!!res.headers['access-control-allow-headers'], true);
            assert.deepEqual(!!res.headers['access-control-expose-headers'], true);
        });
    });

    it('should set CSP headers', () => {
        if (server.config.service.conf.csp === false) {
            return true;
        }
        return preq.get({
            uri: `${server.config.uri}robots.txt`
        }).then((res) => {
            assert.deepEqual(res.status, 200);
            assert.deepEqual(res.headers['x-xss-protection'], '1; mode=block');
            assert.deepEqual(res.headers['x-content-type-options'], 'nosniff');
            assert.deepEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
            assert.deepEqual(res.headers['content-security-policy'], 'default-src \'self\'; object-src \'none\'; media-src *; img-src *; style-src *; frame-ancestors \'self\'');
            assert.deepEqual(res.headers['x-content-security-policy'], 'default-src \'self\'; object-src \'none\'; media-src *; img-src *; style-src *; frame-ancestors \'self\'');
            assert.deepEqual(res.headers['x-webkit-csp'], 'default-src \'self\'; object-src \'none\'; media-src *; img-src *; style-src *; frame-ancestors \'self\'');
        });
    });

// === EventStreams modification ===
    it.skip('should get static content gzipped', () => {
// === End EventStreams modification ===
        return preq.get({
            uri: `${server.config.uri}static/index.html`,
            headers: {
                'accept-encoding': 'gzip, deflate'
            }
        }).then((res) => {
            assert.deepEqual(res.status, 200);
            // if there is no content-length, the reponse was gzipped
            assert.deepEqual(res.headers['content-length'], undefined,
                'Did not expect the content-length header!');
        });
    });

// === EventStreams modification ===
    it.skip('should get static content uncompressed', () => {
// === End EventStreams modification ===
        return preq.get({
            uri: `${server.config.uri}static/index.html`,
            headers: {
                'accept-encoding': ''
            }
        }).then((res) => {
            const contentEncoding = res.headers['content-encoding'];
            assert.deepEqual(res.status, 200);
            assert.deepEqual(contentEncoding, undefined, 'Did not expect gzipped contents!');
        });
    });
});
