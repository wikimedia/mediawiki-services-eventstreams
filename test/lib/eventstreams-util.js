'use strict';

const _ = require('lodash');
const assert = require('../utils/assert.js');
const { makeMediaWikiRedactorDeserializer } = require('../../lib/eventstreams-util');

/**
 * Creates a helper function to make kafka messages with default values
 * @param {Object} defaults
 * @return {function(Object): {value: string}}
 */
const createKafkaMessageWithDefaults = (defaults) => (override_values) => ({ value: JSON.stringify(_.merge(defaults, override_values)) });

describe('eventstream-util', () => {
    context('makeMediaWikiRedactorDeserializer', () => {
        context('mediawiki.page_change.v1', () => {
            let createKafkaMessage;
            before(() => {
                createKafkaMessage = createKafkaMessageWithDefaults({
                    meta: {
                        stream: 'mediawiki.page_change.v1',
                    },
                    page: {
                        page_title: 'redact'
                    },
                    performer: {
                        user_id: 123,
                        user_text: 'example'
                    },
                    revision: {
                        editor: {
                            user_id: 123,
                            user_text: 'example'
                        }
                    },
                    prior_state: {
                        revision: {
                            editor: {
                                user_id: 123,
                                user_text: 'example'
                            }
                        },
                    },
                });
            });

            it('should redact ruwiki mediawiki.page_change.v1 message correctly', () => {
                const redactPage = createKafkaMessage({ wiki_id: 'ruwiki' });

                const redactor = makeMediaWikiRedactorDeserializer(['redact']);
                const { message: redactedPage } = redactor(redactPage);

                // Performer is required by the schema but its properties aren't.
                assert.ok(redactedPage.performer);
                assert.ok(!redactedPage.performer?.user_id);
                assert.ok(!redactedPage.performer?.user_text);

                assert.ok(!redactedPage.revision?.editor);
                assert.ok(!redactedPage.prior_state.revision?.editor);
            });

            it('should not redact mediawiki.page_change.v1 message correctly', () => {
                const redactPage = createKafkaMessage({
                    wiki_id: 'jawiki',
                    page: {
                        page_title: 'no redact'
                    },
                });

                const redactor = makeMediaWikiRedactorDeserializer(['no redact']);
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(redactedPage.performer.user_id);
                assert.ok(redactedPage.performer.user_text);

                assert.ok(redactedPage.revision.editor);
                assert.ok(redactedPage.prior_state.revision.editor);
            });
        });

        context('mediawiki.recentchange', () => {
            let createKafkaMessage;
            before(() => {
                createKafkaMessage = createKafkaMessageWithDefaults({
                    meta: {
                        stream: 'mediawiki.recentchange',
                    },
                    title: 'redact',
                    user: {
                        user_text: 'example'
                    },
                });
            });

            it('should redact ruwiki mediawiki.recentchange message correctly', () => {
                const redactPage = createKafkaMessage({ wiki: 'ruwiki' });

                const redactor = makeMediaWikiRedactorDeserializer(['redact']);
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(!redactedPage?.user);
            });

            it('should not redact mediawiki.recentchange message correctly', () => {
                const redactPage = createKafkaMessage({
                    wiki: 'jawiki',
                    title: 'no redact'
                });

                const redactor = makeMediaWikiRedactorDeserializer(['no redact']);
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(redactedPage.user);
            });
        });

        context('other streams', () => {
            let createKafkaMessage;
            before(() => {
                createKafkaMessage = createKafkaMessageWithDefaults({
                    page_title: 'redact',
                    performer: {
                        user_id: 123,
                        user_text: 'example'
                    },
                });
            });

            it('should redact ruwiki database message correctly', () => {
                const redactPage = createKafkaMessage({ database: 'ruwiki' });
                const redactor = makeMediaWikiRedactorDeserializer(['redact']);
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(!redactedPage?.performer);
            });

            it('should not redact other database message correctly', () => {
                const redactPage = createKafkaMessage({
                    page_title: 'no redact',
                    database: 'jawiki',
                });
                const redactor = makeMediaWikiRedactorDeserializer(['no redact']);
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(redactedPage.performer);
            });
        });
    });
});
