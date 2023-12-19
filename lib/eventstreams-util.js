'use strict';

const _        = require('lodash');
const {
    objectFactory
} = require('@wikimedia/url-get');
const fs = require('fs');
const redacted_articles = JSON.parse(fs.readFileSync('./redacted_articles.json', 'utf8'));

/**
 * Custom message deserializer for eventstreams.
 * Augments the deserialized message with kafka
 * metadata in the .meta subobject.
 *
 * @param {Object} kafkaMessage
 * @return {Object}
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

function redact(deserializer) {
    return function(...args) {
        kafkaMessage = deserializer(...args)
        if (
            kafkaMessage.message.meta.stream == "mediawiki.page_change.v1" && 
            kafkaMessage.message.wiki_id == "ruwiki" &&
            redacted_articles.includes(kafkaMessage.message.page.page_title)
        ) {
            kafkaMessage.message.performer = {}
            kafkaMessage.message.revision.editor = {}
            kafkaMessage.message.prior_state.revision.editor = {}
        }
    }
}

const redactor = redact(deserializer);

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
    redactor,
    deserializer,
    rdkafkaStatsFilter
};