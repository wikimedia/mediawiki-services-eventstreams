<!-- StreamStats
A bar containing the streaming status, some streaming statistics, and
a couple convenient actions to download and clear the consumed events.

@prop eventCount {number} The count of consumed events.
@prop isStreaming {boolean} Whether the streaming is on or off.

@emit download {event()} Fires when the user clicks on the download button.
@emit clear {event()} Fires when the user clicks on the clear button.
-->

<template>
  <div class="stream-stats">
    <el-button-group>
      <el-button round plain size="mini"
        class="no-pointer-events status"
        :type="isStreaming ? 'success' : 'info'"
        v-text="isStreaming ? 'Streaming' : 'Stopped'">
      </el-button>

      <el-button size="mini"
        class="no-pointer-events stats"
        v-text="statsText">
      </el-button>

      <el-button size="mini" type="primary"
        icon="el-icon-download"
        title="Download as JSON file"
        :disabled="eventCount === 0"
        @click="$emit('download')">
      </el-button>

      <el-button round size="mini" type="danger"
        icon="el-icon-delete"
        title="Clear events"
        :disabled="eventCount === 0"
        @click="clearEvents">
      </el-button>
    </el-button-group>
  </div>
</template>

<script>
  export default {
    name: 'StreamStats',

    props: [
      'eventCount',
      'isStreaming'
    ],

    data() {
      return {
        streamingStartTs: null,
        lastEventTs: null,
        streamingDuration: 0
      };
    },

    computed: {
      statsText: function () {
        var eventRate;
        if (this.streamingDuration === 0) {
          eventRate = 0;
        } else {
          eventRate = this.eventCount / this.streamingDuration * 1000;
        }
        return `${this.eventCount} evts | ${eventRate.toFixed(1)} evts/sec`;
      }
    },

    watch: {
      eventCount: function (newValue, oldValue) {
        if (newValue > oldValue) {
          const now = new Date();
          if (!this.lastEventTs || this.lastEventTs < this.streamingStartTs) {
            this.streamingDuration += now - this.streamingStartTs;
          } else {
            this.streamingDuration += now - this.lastEventTs;
          }
          this.lastEventTs = now;
        }
      },
      isStreaming: function (newValue, oldValue) {
        const that = this;
        if (!oldValue && newValue) {
          this.streamingStartTs = new Date();
        }
      }
    },

    methods: {
      clearEvents: function () {
        this.$emit('clear');
        this.streamingStartTs = this.isStreaming ? new Date() : null;
        this.lastEventTs = null;
        this.streamingDuration = 0;
      }
    }
  }
</script>

<style>
  .stream-stats .no-pointer-events {
    pointer-events: none;
  }
  .stream-stats .status {
    width: 100px;
  }
  .stream-stats .stats {
    width: 150px;
  }
</style>
