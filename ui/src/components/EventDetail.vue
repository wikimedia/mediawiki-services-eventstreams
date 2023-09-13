<!-- EventDetail
A dialog that shows an event in pretty-printed Json and Yaml.
It allows to copy the text to the clipboard by clicking a button.

@prop eventData {string} Stringified Json object of the event to display.
@prop isVisible {boolean} Whether the dialog is visible.

@emit close {event()} Fired when the dialog is closed.
-->

<template>
  <div class="event-detail">
    <el-dialog
        :visible="isVisible"
        @close="$emit('close')">
      <el-button plain circle
        class="detail-actions"
        size="mini"
        type="primary"
        icon="el-icon-document-copy"
        title="Copy to clipboard"
        @click="copyToClipboard">
      </el-button>

      <el-tabs
          type="card"
          @tab-click="activeTab = $event.label">
        <el-tab-pane
            label="Json"
            class="json-tab">
          <vue-json-pretty
            :show-line="false"
            :select-on-click-node="false"
            :highlight-selected-node="false"
            :collapsed-on-click-brackets="false"
            :data="jsonData">
          </vue-json-pretty>
        </el-tab-pane>

        <el-tab-pane
          label="Yaml"
          class="yaml-tab"
          v-html="yamlHtml">
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script>
  import VueJsonPretty from 'vue-json-pretty';
  import 'vue-json-pretty/lib/styles.css';
  import Utils from '@/utils';
  import 'yaml';

  export default {
    name: 'EventDetail',

    components: {
      VueJsonPretty
    },

    props: [
      'eventData',
      'isVisible'
    ],

    data() {
      return {
        activeTab: 'Json'
      };
    },

    computed: {
      jsonData: function () {
        return this.eventData ? JSON.parse(this.eventData) : '';
      },
      jsonText: function () {
        return JSON.stringify(this.jsonData, null, 2) + '\n';
      },
      yamlText: function () {
        return yaml.stringify(this.jsonData, 10, 2);
      },
      yamlHtml: function () {
        return Utils.yamlToHtml(this.yamlText);
      }
    },

    methods: {
      copyToClipboard: function () {
        const text = this.activeTab === 'Json' ? this.jsonText : this.yamlText;
        navigator.clipboard.writeText(text).then(this.notifyCopied);
      },
      notifyCopied: function () {
        this.$notify({
          message: 'Event successfully copied!',
          type: 'success',
          position: 'bottom-right',
          duration: 2000
        });
      }
    }
  }
</script>

<style>
  .event-detail {
    font-family: monospace;
  }
  .event-detail .el-dialog {
    width: 900px;
  }
  .event-detail .detail-actions {
    float: right;
    margin: -28px 28px 0 0;
  }
  .event-detail .el-tab-pane {
    padding: 16px;
    color: #303133;
    line-height: 20px;
  }
  .event-detail .el-tabs__item {
    font-family: arial;
  }

  /* Overriding vue-json-pretty highlight style */
  .event-detail .vjs-value__number { color: red; }
  .event-detail .vjs-value__string { color: green; }
  .event-detail .vjs-value__boolean { color: blue; }

  /* Adjusting element-ui style */
  .event-detail .vjs-tree__brackets:hover {
    color: #606266;
    cursor: text;
  }
  .event-detail .el-tabs__item {
    color: #606266;
  }
  .event-detail .el-tabs__item.is-active {
    color: #303133;
  }
  .event-detail .el-dialog__header, .event-detail .el-dialog__body {
    padding-top: 16px;
  }
  /* Not prefixed on purpose */
  .el-notification {
    font-family: arial;
  }
</style>
