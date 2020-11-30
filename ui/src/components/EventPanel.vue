<!-- EventPanel
A table showing a list of events (Json text), one per row.
They are clickable; and once clicked, their style changes
to indicate they have been read.

@prop events {array} List of stringified events to display.

@emit click {event(text)} Fires whenever an event is clicked.
-->

<template>
  <div class="event-panel">
    <el-table
        v-if="formattedEvents.length > 0"
        :data="formattedEvents"
        :row-class-name="tableRowClassName"
        @cell-click="handleClick">
      <el-table-column prop="text">
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
  export default {
    name: 'EventPanel',

    props: [
      'events'
    ],

    data() {
      return {
        readEvents: []
      };
    },

    computed: {
      formattedEvents: function () {
        return this.events.map(function (e, i) {
          return {text: e, index: i};
        });
      }
    },

    watch: {
      events: function (newValue, oldValue) {
        if (newValue.length === 0) {
          // When events are cleared, read indexes need to be cleared, too.
          this.readEvents = [];
        }
      }
    },

    methods: {
      tableRowClassName: function (rowInfo) {
        const event = rowInfo.row;
        return this.readEvents.includes(event.index) ? 'read-event' : 'unread-event';
      },
      handleClick: function (event) {
        this.readEvents.push(event.index);
        this.$emit('click', event.text);
      }
    }
  }
</script>

<style>
  .event-panel {
    font-family: monospace;
  }
  .event-panel .el-table {
    font-size: 12.8px;
    width: 100%;
  }
  .event-panel .el-table__header-wrapper {
    /* Hide empty header */
    margin-top: -38px;
  }
  .event-panel .el-table--enable-row-transition .el-table__body td {
    /* Speed up highlight animation */
    transition: background-color .1s ease !important;
    cursor: pointer;
  }
  .event-panel .unread-event {
    color: #303133;
  }
  .event-panel .read-event {
    color: #909399;
  }
</style>
