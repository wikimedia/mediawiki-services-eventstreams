'use strict';

const _         = require('lodash');


/**
 * Converts a utf-8 byte buffer or a JSON string into
 * an object and returns it.
 */
function objectFactory(data) {
    // if we are given an object Object, no-op and return it now.
    if (_.isPlainObject(data)) {
        return data;
    }

    // If we are given a byte Buffer, parse it as utf-8
    if (data instanceof Buffer) {
        data = data.toString('utf-8');
    }

    // If we now have a string, then assume it is a JSON string.
    if (_.isString(data)) {
        data = JSON.parse(data);
    } else {
        throw new Error(
            'Could not convert data into an object.  ' +
            'Data must be a utf-8 byte buffer or a JSON string'
        );
    }

    return data;
}


/**
 * Custom message deserializer for eventstreams.
 * Augments the deserialized message with kafka
 * metadata in the .meta subobject.
 */
function deserializer(kafkaMessage) {
    kafkaMessage.message = objectFactory(kafkaMessage.value);

    if (!kafkaMessage.message.meta) {
        kafkaMessage.message.meta = {};
    }
    kafkaMessage.message.meta.topic     = kafkaMessage.topic;
    kafkaMessage.message.meta.partition = kafkaMessage.partition;
    kafkaMessage.message.meta.offset    = kafkaMessage.offset;
    if (kafkaMessage.key) {
        kafkaMessage.message.meta.key   = kafkaMessage.key;
    }

    return kafkaMessage;
}


/**
 * Filter function that will be passed as an option to the
 * event.stats cb function that node-rdkafka-statsd will create
 * to give each new node-rdkafka client instance.
 *
 * We implement a custom filter because we don't care to report
 * some of these rdkafka metrics.  Specifically, we remove
 * metrics about committed offsets, since kafka-sse does not commit.
 */
const rdkafkaStatsWhitelist = [
    // Broker stats
    'outbuf_cnt',
    'outbuf_msg_cnt',
    'waitresp_cnt',
    'waitresp_msg_cnt',
    'tx',
    'txbytes',
    'txerrs',
    'txretries',
    'req_timeouts',
    'rx',
    'rxbytes',
    'rxerrs',
    'rxcorriderrs',
    'rxpartial',
    'rtt',
    'throttle',

    // Topic partition stats
    'msgq_cnt',
    'msgq_bytes',
    'xmit_msgq_cnt',
    'xmit_msgq_bytes',
    'fetchq_cnt',
    'fetchq_size',
    'next_offset',
    'eof_offset',
    'lo_offset',
    'hi_offset',
    'consumer_lag',
    'txmsgs',
    'txbytes',
    'msgs',
    'rx_ver_drops'
];


function rdkafkaStatsFilter(key) {
    return _.includes(rdkafkaStatsWhitelist, key);
}


/**
 * Keeps counters for various keys, and then periodically
 * calls a callback with each key, value pair.
 *
 * Usage:
 *
 *  // Report the counters' values as gauges every minute.
 *  var cb = (key, val) => { console.log(key, val); }
 *  var intervalCounter = new IntervalCounter(cb, 5000);
 *  intervalCounter.increment('key1');     // 0 + 1 == 1
 *  intervalCounter.increment('key1', 2);  // 1 + 2 == 3
 *  intervalCounter.decrement('key1', 1);  // 3 - 1 == 2
 *  intervalCounter.increment('key2', 5);  // 0 + 5 == 5
 *  // After 5 seconds, the current value of each key will be logged.
 *  //   'key1', 2
 *  //   'key2', 5
 *
 * This especially useful if you provide a statsd client callback, e.g. gauge or timing:
 *  var intervalCounter = new IntervalCounter(statsd.gauge.bind(statsd), 60000);
 */
class IntervalCounter {
    /**
     * @param {callback} cb             cb function that takes key, value.
     *                                  This will be called for each stored counter
     * @param {integer}  intervalMs     cb will be called for every key, count this often.
     *                                  Default: 5000
     * @param {boolean}  shouldReset    If true, each stored counter will be nulled every
     *                                  interval ms.  Default: false
     *
     * @class
     */
    constructor(cb, intervalMs, shouldReset) {
        this.cb          = cb;
        this.intervalMs  = intervalMs  || 5000;
        this.shouldReset = shouldReset || false;

        this.counters    = {};
        this._start();
    }

    increment(key, value) {
        value = value || 1;
        this._update(key, value);
    }

    decrement(key, value) {
        value = value || 1;
        // TODO: should we allow negative values????
        this._update(key, -value);
    }

    _update(key, delta) {
        if (!key) {
            throw new Error("Must provide a key");
        }

        if (key in this.counters) {
            this.counters[key] += delta;
        } else {
            this.counters[key] = delta;
        }
    }

    _flush() {
        Object.keys(this.counters).forEach((key) => {
            this.cb(key, this.counters[key]);
            if (this.shouldReset) {
                delete this.counters[key];
            }
        });
    }

    _start() {
        this.timeout = setInterval(this._flush.bind(this), this.intervalMs);
    }

    _stop() {
        clearInterval(this.timeout);
        delete this.timeout;
    }
}


module.exports = {
    deserializer,
    objectFactory,
    rdkafkaStatsFilter,
    IntervalCounter,
};
