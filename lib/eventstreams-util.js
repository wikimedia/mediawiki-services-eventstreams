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
    kafkaMessage.message.meta.topic     = kafkaMessage.topic_name;
    kafkaMessage.message.meta.partition = kafkaMessage.partition;
    kafkaMessage.message.meta.offset    = kafkaMessage.offset;
    if (kafkaMessage.key) {
        kafkaMessage.message.meta.key   = kafkaMessage.key;
    }

    return kafkaMessage;
}


module.exports = {
    deserializer: deserializer,
    objectFactory: objectFactory,
};
