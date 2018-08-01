# EventStreams

Publicly exposes streams of MediaWiki and Wikimedia events.  Events will
be streamed to clients using [SSE backed by Kafka](https://github.com/wikimedia/kafkasse).

Here, an 'eventstream' refers to a collection of Kafka topics, each of which are configured
in the `streams` application config object.


## Routes

### `GET /v2/stream/{streams}`

Streams are configured in config.yaml.  Each key in the `streams` config object will allowed
to be provided in the {streams} parameter.  {streams} is a comma separated list of streams names.
Each of these stream routes will consume from configured topics.  E.g.

```yaml
streams:
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

When configuring new streams, you should also update spec.yaml to include the new streams.
The parameter based /v2/stream/{streams} is the real route, but it is convenient to be able
to read the API docs as if each individual stream was a real explicit route.

All /v2/stream/{streams} routes take a `timestamp` query parameter.  This parameter
is expected to either be an integer milliseconds unix epoch timestamp in UTC, or
a string parseable via `Data.parse()`.  If given, then the requested streams will
be attempted to start from offsets that correspond (in Kafka) with the given timestamp.
If Kafka does not have offsets for the timestamp in its index, then the stream will
just begin from the end.


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
