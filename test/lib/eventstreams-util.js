'use strict';

const _ = require('lodash');
const assert = require('../utils/assert.js');
const { makeMediaWikiRedactorDeserializer } = require('../../lib/eventstreams-util');

/**
 * Creates a helper function to make kafka messages with default values
 *
 * @param {Object} defaults
 * @return {function(Object): {value: string}}
 */
const createKafkaMessageWithDefaults = (defaults) => (override_values) => (
    {
        value: JSON.stringify(_.merge(defaults, override_values)),
        topic: '',
        partition: 0,
        offset: 0,
        timestamp: null,
        key: null
    }
);

describe('eventstream-util', () => {
    context('makeMediaWikiRedactorDeserializer', () => {
        context('mediawiki.page_change.v1', () => {
            let createKafkaMessage;
            before(() => {
                createKafkaMessage = createKafkaMessageWithDefaults({
                    meta: {
                        stream: 'mediawiki.page_change.v1',
                        domain: 'test.domain'
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

            const assertRedactedPageChange = (redacted_page) => {
                // Performer is required by the schema but its properties aren't.
                assert.ok(redacted_page.performer);
                assert.ok(!redacted_page.performer?.user_id);
                assert.ok(!redacted_page.performer?.user_text);

                assert.ok(!redacted_page.revision?.editor);
                assert.ok(!redacted_page.prior_state.revision?.editor);
            };

            it('should redact mediawiki.page_change.v1 message correctly', () => {
                const redactPage1 = createKafkaMessage();
                const redactPage2 = createKafkaMessage({
                    page: { page_title: 'redact_this' }
                });

                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['redact', 'Redact this'] });
                const { message: redactedPage1 } = redactor(redactPage1);
                const { message: redactedPage2 } = redactor(redactPage2);
                assertRedactedPageChange(redactedPage1);
                assertRedactedPageChange(redactedPage2);
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
                        domain: 'test.domain'
                    },
                    title: 'redact',
                    user: {
                        user_text: 'example'
                    },
                });
            });

            it('should redact mediawiki.recentchange message correctly', () => {
                const redactPage1 = createKafkaMessage();
                const redactPage2 = createKafkaMessage({ title: 'redact this' });

                const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['redact', 'Redact this'] });
                const { message: redactedPage1 } = redactor(redactPage1);
                const { message: redactedPage2 } = redactor(redactPage2);

                assert.ok(!redactedPage1?.user);
                assert.ok(!redactedPage2?.user);
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

        context('edge cases', () => {
            const createKafkaMessage = createKafkaMessageWithDefaults();

            const testCases = [
                {
                    title: 'should not fail on empty message',
                    message: {}
                },
                {
                    title: 'should not fail on no title',
                    message: { meta: { domain: 'test.domain' } }
                },
                {
                    title: 'should parse boolean page title',
                    message: {
                        meta: { domain: 'test.domain', stream: 'mediawiki.recentchange' },
                        title: 'false', user: {}
                    },
                    redacted: true
                },
                {
                    title: 'should parse number page title',
                    message: {
                        meta: { domain: 'test.domain', stream: 'mediawiki.page_change.v1' },
                        page: { page_title: '404' }, revision: { editor: {} }
                    },
                    redacted: true
                },
            ];

            const redactor = makeMediaWikiRedactorDeserializer({ 'test.domain': ['redact', 'Redact this', 404, false] });

            testCases.forEach(({ title, message, redacted }) => {
                it(title, () => {
                    const redactedPage = redactor(createKafkaMessage(message));
                    assert.ok(_.isMatch(redactedPage.message, message) !== !!redacted);
                    assert.ok(_.has(redactedPage, 'topic'));
                    assert.ok(_.has(redactedPage, 'offset'));
                    assert.ok(_.has(redactedPage, 'partition'));
                    assert.ok(_.has(redactedPage, 'key'));
                });
            });
        });
    });
});
