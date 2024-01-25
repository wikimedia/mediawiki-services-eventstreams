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
                        stream: 'mediawiki.page_change.v1'
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

            it('should redact mediawiki.page_change.v1 message correctly', () => {
                const redactPage = createKafkaMessage({ meta: { domain: 'test.domain' } });

                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['redact'] });
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
                    meta: { domain: 'other.domain' },
                    page: {
                        page_title: 'no redact'
                    },
                });

                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['no redact'] });
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

            it('should redact mediawiki.recentchange message correctly', () => {
                const redactPage = createKafkaMessage({ meta: { domain: 'test.domain' } });

                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['redact'] });
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(!redactedPage?.user);
            });

            it('should not redact mediawiki.recentchange message correctly', () => {
                const redactPage = createKafkaMessage({
                    meta: { domain: 'other.domain' },
                    title: 'no redact'
                });

                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['no redact'] });
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

            it('should redact other performer fragments correctly', () => {
                const redactPage = createKafkaMessage({ meta: { domain: 'test.domain' } });
                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['redact'] });
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(!redactedPage?.performer);
            });

            it('should not redact other performer fragments correctly', () => {
                const redactPage = createKafkaMessage({
                    page_title: 'no redact',
                    meta: { domain: 'other.domain' }
                });
                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['redact this'] });
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(redactedPage.performer);
            });

            it('should redact titles with spaces correctly', () => {
                const redactPage = createKafkaMessage({ meta: { domain: 'test.domain' }, page_title: 'redact_this' });
                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['redact this'] });
                const { message: redactedPage } = redactor(redactPage);

                assert.ok(!redactedPage?.performer);
            });
        });
    });
});
