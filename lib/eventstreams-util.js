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
    }

    else {
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



module.exports = {
    deserializer:       deserializer,
    objectFactory:      objectFactory,
    rdkafkaStatsFilter: rdkafkaStatsFilter,
};
