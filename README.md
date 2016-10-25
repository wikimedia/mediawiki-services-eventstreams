# EventStreams

Publicly exposes streams of MediaWiki and Wikimedia events.  Events will
be streamed to clients using [SSE backed by Kafka](https://github.com/wikimedia/kafkasse).

Here, an 'eventstream' refers to a collection of Kafka topics, each of which are configured
in the `streams` application config object.


## Routes

### `GET /v1/stream/{stream_name}`

`:stream` is configured in config.yaml.  Each key in the `streams` config object will be
created as a route.  Each of these stream routes will consume from configured topics.  E.g.

```yaml
streams:
  edits:
    topics: [datacenter1.edit, datacenter2.edit]
  single-topic-stream:
    topics: [topicA]
```

In this example, `/v1/streams/edits` and `/v1/streams/single-topic-stream` will be created as
routes. Requests to `/v1/streams/edits` will consume from the topics `datacenter1.edit` and
`datacenter2.edit`, and requests to `/v1/streams/single-topic-stream` will consume only from topic
`topicA`.  As long as the `Last-Event-ID` header (see below) is not set, consumption will
start from the latest position in each of these topics.

Requesting a specific stream name will return a never ending SSE stream to the client.
as SSE events.

Note that `{stream_name}` is not a request parameter, but pseudo-code to indicate that
there are multiple routes created under `/v1/stream/`.  These are each real routes, for
which you should add proper entires to spec.yaml.


## Historical Consumption & Offsets
If the `Last-Event-ID` request header is set (usually via EventSource), it will be used for
subscription assignments, instead of the given route's topics.  This header is usually set by an
EventSource implementation on receipt of the `id` field in the SSE events.
It should be an array of `{topic, partition, offsets}` objects.  Each of these will be used for
subscription at a particular point in each topic.  This allows EventSources connections
to auto-resume if they lose their connection to the EventStreams service.

See the [KafkaSSE README](https://github.com/wikimedia/kafkasse#kafkasse) for more information on
how `Last-Event-ID` works.


## TODO:
- Use tagged and versioned kafka-sse in package.json
- server side filtering
