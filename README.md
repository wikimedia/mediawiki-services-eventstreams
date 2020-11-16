# EventStreams

Publicly exposes streams of MediaWiki and Wikimedia events.  Events will
be streamed to clients using [SSE backed by Kafka](https://github.com/wikimedia/kafkasse).

Here, an 'eventstream' refers to a collection of Kafka topics, each of which are configured
in the `streams` application config object.

## Routes

### `GET /v2/stream/{streams}`

Streams can be configured at `stream_config_uri`.  The content at this URI is expected to be
configuration for all streams that could be exposed.  You can limit the streams exposed from this
configuration object by setting a list of names in the `allowed_streams` config.

At minimum, stream configuration must map stream name to a list of Kafka topics, e.g.

```yaml
edits:
  topics: [datacenter1.edit, datacenter2.edit]
single-topic-stream:
  topics: [topicA]
```

In this example, `/v2/stream/edits` and `/v2/stream/single-topic-stream` would be valid requests.
Requests to `/v2/stream/edits` will consume from the topics `datacenter1.edit` and
`datacenter2.edit`, and requests to `/v1/streams/single-topic-stream` will consume only from topic
`topicA`. Multiple streams can be requested, by providing the stream names in a comma separated list,
e.g. `/v2/stream/edits,single-topic-stream`.  As long as the `Last-Event-ID` header
(see below) is not set, consumption will start from the latest position in each of these topics.

Requesting streams will return a never ending SSE stream to the client as SSE events.

All /v2/stream/{streams} routes take a `since` query parameter.  This parameter
is expected to either be an integer milliseconds unix epoch timestamp in UTC, or
a date-time string parseable via `Date.parse()`.  If given, then the requested streams will
be attempted to start from offsets that correspond (in Kafka) with the given timestamp.
If Kafka does not have offsets for the timestamp in its index, then the stream will
just begin from the end.

## application/json instead of text/event-stream.

By default streams will be returned in SSE text/event-stream format, meant to be consumed by a
SSE client (AKA EventSource).  If you'd prefer to just consume JSON, you can set the `Accept`
header to `application/json`.  The stream will then be returned in newline delimited
JSON event objects.

## Historical Consumption & Offsets
If the `Last-Event-ID` request header is set (usually via EventSource), it will be used for
subscription assignments, instead of the given route's topics.  This header is usually set by an
EventSource implementation on receipt of the `id` field in the SSE events.
It should be an array of `{topic, partition, timestamp}` objects.  Each of these will be
used for subscription at a particular point in each topic.  This allows EventSources connections
to auto-resume if they lose their connection to the EventStreams service.  If you need to
specify different timestamps for each of the topic-partitions in your requested streams,
you may choose to set the `timestamp` field in the Last-Event-ID object entry.  This will
be used for that topic-partition to query Kafka for the offset associated with the timestamp.
If no offset is found, the topic-partition assignment will begin from the end.

`timestamp` is now used instead of `offset` by default in the Last-Event-ID in order to support
multi datacenter Kafka clusters for better high availability of the EventStreams service.

See the [KafkaSSE README](https://github.com/wikimedia/kafkasse#kafkasse) for more information on
how `Last-Event-ID` works.

## Dynamic OpenAPI spec
Stream configuration found at `stream_config_uri` can be used to build a dynamic OpenAPI spec.
EventStreams app config is combined with stream config settings to augment the spec
with request description, response schema and response examples.
config.yaml documentents how stream config settings are used to do this.
