'use strict';

const _        = require('lodash');

const {
    objectFactory
} = require('@wikimedia/url-get');

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

/**
 * @param {{string: string[]}} redacted_pages Map of wiki to list of redacted pages.
 * @return {function(Object): Object}
 */
function makeMediaWikiRedactorDeserializer(redacted_pages) {
    const wikis = Object.keys(redacted_pages);
    return (kafkaMessage) => {
        const km = deserializer(kafkaMessage);
        if ( // case mediawiki.page_change.v1
            km.message.meta.stream === 'mediawiki.page_change.v1' &&
            wikis.includes(km.message.wiki_id) &&
            redacted_pages[km.message.wiki_id].includes(km.message.page.page_title)
        ) {
            delete km.message.performer.user_id;
            delete km.message.performer.user_text;
            delete km.message.revision.editor;
            delete km.message.prior_state.revision.editor;
        } else if ( // case recentchange
            km.message.meta.stream === 'mediawiki.recentchange' &&
            wikis.includes(km.message.wiki) &&
            redacted_pages[km.message.wiki].includes(km.message.title)
        ) {
            delete km.message.user;
        } else if ( // case all other streams
            wikis.includes(km.message.database) &&
            redacted_pages[km.message.database].includes(km.message.page_title)
        ) {
            delete km.message.performer;
        }
        return km;
    };
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
    makeMediaWikiRedactorDeserializer,
    deserializer,
    rdkafkaStatsFilter
};
