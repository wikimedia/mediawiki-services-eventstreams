'use strict';

const assert = require('../../utils/assert.js');
const eUtil = require('../../../lib/eventstreams-util');


describe('eventstreams-util', function () {

    it('should get topics for statically defined stream configs', () => {
        const options = {
            streams: {
                stream_a: {
                    topics: ['prefix0.stream_a', 'prefix1.stream_a']
                },
                stream_b: {
                    topics: ['prefix0.stream_b', 'prefix1.stream_b']
                }
            }
        };

        const expected = ['prefix0.stream_a', 'prefix1.stream_a', 'prefix0.stream_b', 'prefix1.stream_b'];
        const topics = eUtil.getTopicsForStreams(['stream_a', 'stream_b'], options);

        assert.deepEqual(topics, expected);
    });

    it('should get topics for statically defined stream config using topic prefixes', () => {
        const options = {
            stream_topic_prefixes: ['prefix0.', 'prefix1.'],

            streams: {
                stream_a: {
                    dummy_config: true
                },
                stream_b: {
                    dummy_config: true
                }
            }
        };

        const expected = ['prefix0.stream_a', 'prefix1.stream_a', 'prefix0.stream_b', 'prefix1.stream_b'];
        const topics = eUtil.getTopicsForStreams(['stream_a', 'stream_b'], options);

        assert.deepEqual(topics, expected);
    });

    it('should get topics with no stream config using topic prefixes', () => {
        const options = {
            stream_topic_prefixes: ['prefix0.', 'prefix1.'],
        };

        const expected = ['prefix0.stream_a', 'prefix1.stream_a', 'prefix0.stream_b', 'prefix1.stream_b'];
        const topics = eUtil.getTopicsForStreams(['stream_a', 'stream_b'], options);

        assert.deepEqual(topics, expected);
    });

    it('should get topics with no stream config without topic prefixes', () => {
        const options = {};

        const expected = ['stream_a', 'stream_b'];
        const topics = eUtil.getTopicsForStreams(['stream_a', 'stream_b'], options);

        assert.deepEqual(topics, expected);
    });


});
