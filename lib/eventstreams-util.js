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
 * Time sensitive, one off, implementation to support T354456.
 *
 * Redact message content based on deny list of page titles,
 * populated with the full page name.
 *
 * TODO: re-evaluate this approach after integration testing.
 *
 * @param {{string: string[]}} redacted_pages Map of wiki to list of redacted pages.
 * @param {Object} options
 * @param {Object} options.logger Logger
 * @param {string} options.clientIp
 * @param {string} options.userAgent
 * @return {function(Object): Object}
 */
function makeMediaWikiRedactorDeserializer(redacted_pages, options = {}) {
    // Time sensitive, one off, implementation to support T354456.
    // Users are expected to provide *normalized* page names. This data is not available
    // in some legacy streams. Apply some normalization before comparing user configs
    // to kafka messages. This won't cover all MediaWiki cases, it's used only to have
    // consistent naming within this method.
    //
    // We can't match on page IDs, because not all streams ship it (e.g. mediawiki.recentchange).
    // We could create lookup up tables by querying the MediaWiki Action/REST APIs at service
    // startup, but given the use case here we might get away with simple logic (at the cost of
    // generating false positives).
    //
    // 1. Trim any space at the beginning and end of the string. E.g. " a b " -> "a b".
    // 2. Replace all space occurrences with an underscore, to match page titles (uri) naming.
    //    E.g. 'a b    c' -> 'a_b_c'.
    // 3. Ignore site-specific capitalization rules, and preemptively lower case page titles
    //    to workaround case sensitivity settings.
    // We compare with titles regardless of capitalization.
    // This might increase false positives, but decrease the risk of PII leaks.
    // References:
    //  - https://www.mediawiki.org/wiki/Manual:Page_title
    //  - https://wikitech.wikimedia.org/wiki/Analytics/Data_Lake/Traffic/Pageviews/Redirects
    const normalizePageTitle = (pageTitle, defaultReturnValue = null) => {
        if (pageTitle === null || pageTitle === undefined) {
            return defaultReturnValue;
        }
        // Make sure page_title is a string
        pageTitle = String(pageTitle);
        pageTitle = pageTitle.trim();
        return pageTitle.replace(/ +/g, '_').toLowerCase();
    };

    for (const domain in redacted_pages) {
        redacted_pages[domain] = redacted_pages[domain].flatMap(
            (pageTitle) => normalizePageTitle(pageTitle, [])
        );
    }
    const domains = Object.keys(redacted_pages);
    return (kafkaMessage) => {
        const { message } = deserializer(kafkaMessage);
        const domain = message.meta.domain;
        if (!domain || !domains.includes(domain)) {
            return { message };
        }

        let pageTitle;
        if ( // case mediawiki.page_change.v1
            message.meta.stream === 'mediawiki.page_change.v1' &&
            domains.includes(message.meta.domain) &&
            redacted_pages[message.meta.domain].includes(
                normalizePageTitle(message.page?.page_title)
            )
        ) {
            // Performer field is required in the schema.
            message.performer = {};
            delete message.revision.editor;
            delete message.prior_state?.revision?.editor;
            pageTitle = message.page?.page_title;
        } else if ( // case recentchange
            message.meta.stream === 'mediawiki.recentchange' &&
            domains.includes(message.meta.domain) &&
            redacted_pages[message.meta.domain].includes(normalizePageTitle(message.title))
        ) {
            delete message.user;
            pageTitle = message.title;
        } else if ( // case all other streams
            domains.includes(message.meta?.domain) &&
            (redacted_pages[message.meta.domain].includes(normalizePageTitle(message?.page_title)) ||
            redacted_pages[message.meta.domain].includes(normalizePageTitle(message?.page?.page_title)))
        ) {
            delete message.performer;
            pageTitle = message?.page_title ?? message?.page?.page_title;
        }

        if (options.logger && !!pageTitle) {
            options.logger.log('info', `
                Redacted Page. Wiki: ${domain},
                Stream: ${message.meta.stream},
                Page: ${pageTitle},
                ClientIp: ${options.clientIp ?? ''},
                UserAgent: ${options.userAgent ?? ''}
            `);
        }

        return { message };
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
