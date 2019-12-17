'use strict';

var assert = require('assert');
var eUtil = require('../../../lib/eventstreams-util');
var IntervalCounter = eUtil.IntervalCounter;

describe('IntervalCounter', function() {
    this.timeout(5000);

    // Returns a cb function for IntervalCounter that
    // calls done() once the cb has been called
    // as many times as there are keys in shouldBe.
    function makeTestCb(shouldBe, done) {
        let cbCallCount = 0;

        return (key, value) => {
            assert.equal(shouldBe[key], value);
            cbCallCount++;
            if (cbCallCount >= Object.keys(shouldBe).length) {
                done();
            }
        }
    }

    it('should cb after interval ms', function(done) {
        const shouldBe = {
            'key1': 5,
        };

        // Make the IntervalCounter cb that will
        // assert that the key/value pairs match what
        // is in shouldBe, and stops the timeout interval and
        // calls the test done() function once shouldBe items
        // have been checked.
        const cb = makeTestCb(shouldBe, () => {
            intervalCounter._stop();
            done();
        });

        const intervalCounter = new IntervalCounter(cb, 500);
        intervalCounter.increment('key1', 5);
    });

    it('should increment and decrement', function(done) {
        const shouldBe = {
            'key1': 2,
        };

        const cb = makeTestCb(shouldBe, () => {
            intervalCounter._stop();
            done();
        });

        const intervalCounter = new IntervalCounter(cb, 500);
        intervalCounter.increment('key1', 9);
        intervalCounter.decrement('key1', 7);
    });

    it('should increment and decrement multiple keys', function(done) {
        const shouldBe = {
            'key1': 2,
            'key2': 9,
        };

        const cb = makeTestCb(shouldBe, () => {
            intervalCounter._stop();
            done();
        });

        const intervalCounter = new IntervalCounter(cb, 500);
        intervalCounter.increment('key1', 9);
        intervalCounter.decrement('key1', 7);
        intervalCounter.increment('key2', 11);
        intervalCounter.decrement('key2', 2);
    });

    it('should error on null key', function() {
        let intervalCounter = new IntervalCounter(null, 500);
        assert.throws(() => {
            intervalCounter.increment(null, 9);
        });
        intervalCounter._stop();
    });
});
