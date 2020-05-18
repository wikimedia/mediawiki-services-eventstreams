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
 * Given a list of streams, this returns a list of Kafka topics to consume from.
 * This uses options to vary how the topics are built.
 *
 * If options.streams[stream].topics, these topics will be used for the stream.
 * Else if options.stream_topic_prefixes, the topics will be the stream prefixed
 * by each of these.
 * Else the stream name is used as the topic as given.
 *
 * @param  {Array} streams stream names to get topics for
 * @param  {Object} options
 * @param  {Object} options.streams
 *         Static stream configs.  Maps stream names to stream configs.
 *         If topics is set, this should be a static array of topics that
 *         compose the stream.
 * @param  {Array} options.stream_topic_prefixes
 *         If a requested stream does not have a list of topics defined
 *         for it in in options.streams, then the stream will be
 *         prefixed with each of the prefixes in this array to build
 *         the list of topics that make up this stream.
 *
 * @return {Array}
 */
function getTopicsForStreams(streams, options={}) {

    return _.flatMap(streams, (stream) => {
        if (options.streams && options.streams[stream] && options.streams[stream].topics) {
            return options.streams[stream].topics;
        } else {
            if (options.stream_topic_prefixes) {
                return _.flatMap(options.stream_topic_prefixes, prefix => prefix + stream);
            } else {
                return stream;
            }
        }
    });

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
    deserializer,
    objectFactory,
    rdkafkaStatsFilter,
    getTopicsForStreams,
};
