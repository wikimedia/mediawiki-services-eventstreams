<!-- Home
The main view of this UI. It is composed of a header, which contains some
links of interest, the stream controls and the streaming status bar; And a
main body, which contains the event panel and the event detail, which render
the consumed events.
This component interacts with the EventStreamsApi and coordinates props and
emitted events for all sub-components.
-->

<template>
  <div class="home">
    <el-header>
      <div class="nav-bar">
        <Links/>
        <div class="centered">
          <span class="logo-text">EventStreams</span>
          <StreamControls
            :availableStreams="availableStreams"
            :selectedStreams="selectedStreams"
            :isStreaming="isStreaming"
            @selectedStreamsChange="updateSelectedStreams"
            @isStreamingChange="updateIsStreaming"/>
        </div>
      </div>

      <div class="opaque">
        <StreamStats
          :eventCount="consumedEvents.length"
          :isStreaming="isStreaming"
          @clear="clearConsumedEvents"
          @download="downloadConsumedEvents"/>
      </div>
    </el-header>

    <el-main>
      <EventPanel
        :events="consumedEvents"
        @click="openEventDetail"/>
      <EventDetail
        :eventData="eventDetailData"
        :isVisible="eventDetailIsVisible"
        @close="closeEventDetail"/>
    </el-main>
  </div>
</template>

<script>
  import Links from '@/components/Links.vue';
  import StreamControls from '@/components/StreamControls.vue';
  import StreamStats from '@/components/StreamStats.vue';
  import EventPanel from '@/components/EventPanel.vue';
  import EventDetail from '@/components/EventDetail.vue';
  import EventStreamsApi from '@/apis/EventStreamsApi.js';
  import Utils from '@/utils';

  export default {
    name: 'Home',

    components: {
      Links,
      StreamControls,
      StreamStats,
      EventPanel,
      EventDetail
    },

    data() {
      return {
        availableStreams: null,
        selectedStreams: [],
        isStreaming: false,
        eventSource: null,
        consumedEvents: [],
        eventDetailData: null,
        eventDetailIsVisible: false
      };
    },

    created: function () {
      const that = this;
      EventStreamsApi.getAvailableStreams().then(function (streams) {
        that.availableStreams = streams;
        that.applyStreamsFromQueryString();
      });
    },
    beforeDestroy: function () {
      this.closeEventSource();
    },

    watch: {
      '$route.query': function () {
        this.applyStreamsFromQueryString();
      }
    },

    methods: {
      applyStreamsFromQueryString: function () {
        var queryStreams = "";
        if ('streams' in this.$route.query) {
          queryStreams = this.$route.query.streams;
        }
        if (queryStreams !== this.selectedStreams.join(',')) {
          this.closeEventSource();
          this.isStreaming = false;
          this.selectedStreams = queryStreams.split(',');
        }
      },
      applyStreamsToQueryString: function () {
        const streams = this.selectedStreams.join(',');
        const queryStreams = this.$route.query.streams || '';
        if (streams !== queryStreams) {
          if (streams === '') {
            this.$router.push({path: '/'});
          } else {
            this.$router.push({path: '/', query: {streams: streams}});
          }
        }
      },
      updateSelectedStreams: function (newValue) {
        this.selectedStreams = newValue;
        this.applyStreamsToQueryString();
        // Update the SSE EventSource.
        this.closeEventSource();
        if (this.isStreaming && newValue.length > 0) {
          this.eventSource = EventStreamsApi.consumeStreams(
            newValue,
            this.consumeEvent
          );
        }
      },
      updateIsStreaming: function (newValue) {
        this.isStreaming = newValue;
        // Update the SSE EventSource.
        if (newValue) {
          this.eventSource = EventStreamsApi.consumeStreams(
            this.selectedStreams,
            this.consumeEvent
          );
        } else {
          this.closeEventSource();
        }
      },
      consumeEvent: function (event) {
        this.consumedEvents.push(event.data);
      },
      closeEventSource: function () {
        if (this.eventSource !== null) {
          this.eventSource.close();
          this.eventSource = null;
        }
      },
      downloadConsumedEvents: function () {
        const text = this.consumedEvents.join('\n') + '\n';
        const filename = 'eventStreamsUI.txt';
        Utils.downloadText(text, filename);
      },
      clearConsumedEvents: function () {
        this.consumedEvents = [];
      },
      openEventDetail: function (eventData) {
        this.eventDetailData = eventData;
        this.eventDetailIsVisible = true;
      },
      closeEventDetail: function () {
        this.eventDetailIsVisible = false;
      }
    }
  };
</script>

<style>
  .links {
    margin-right: 16px;
    text-align: right;
  }
  .centered {
    width: 900px;
    margin: 0 auto;
  }
  .logo-text {
    font-size: 32px;
    font-family: sans-serif;
    color: #fff;
    margin-right: 8px;
    vertical-align: middle;
  }
  .stream-controls {
    display: inline;
  }
  .nav-bar {
    background-color: #606266;
    padding: 8px 0 14px 0;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
  }
  .opaque {
    width: 360px;
    margin: 8px auto 0 auto;
    background-color: white;
    padding: 11px 0;
    border-radius: 24px;
  }
  .stream-stats {
    width: 335px;
    margin: 0 auto;
  }
  .el-header {
    padding: 0 !important;
    position: fixed;
    height: 102px !important;
    width: 100%;
    z-index: 2;
  }
  .el-main {
    padding-top: 145px !important;
    z-index: 1;
  }
</style>
