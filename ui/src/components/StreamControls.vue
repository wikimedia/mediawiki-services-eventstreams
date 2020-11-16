<!-- StreamControls
Set of inputs that allows to add/remove streams to consume,
and start/stop consumption of those.

@prop availableStreams {array} List of stream names to select from.

@prop selectedStreams {array} List of stream names that are selected.

@prop isStreaming {boolean} Whether selected streams are being consumed.

@emit selectedStreamsChange {event(selectedStreams)} Fires whenever
       the user adds or removes a stream. Passes the new selectedStreams value.
@emit isStreamingChange {event(isStreaming)} Fires whenever the user
       starts or stops consumption. Passes the new isStreaming value.
-->

<template>
  <div class="stream-controls">
    <el-select filterable multiple
        class="stream-select"
        placeholder="Select streams..."
        v-model="selectedStreamsCopy">
      <el-option
        v-for="stream in availableStreams"
        :key="stream"
        :value="stream"
        :label="stream">
      </el-option>
    </el-select>

    <el-button
      class="stream-button"
      :disabled="selectedStreamsCopy.length === 0"
      :type="isStreamingCopy ? 'danger' : 'success'"
      v-text="isStreamingCopy ? 'Stop' : 'Stream'"
      @click="isStreamingCopy = !isStreamingCopy">
    </el-button>
  </div>
</template>

<script>
  export default {
    name: 'StreamControls',

    props: [
      'availableStreams',
      'selectedStreams',
      'isStreaming'
    ],

    data() {
      return {
        // Copies used to allow two-way binding.
        selectedStreamsCopy: [],
        isStreamingCopy: false
      };
    },

    watch: {
      isStreaming: function (newValue) {
        if (this.isStreamingCopy !== newValue) {
          this.isStreamingCopy = newValue;
        }
      },
      isStreamingCopy: function (newValue) {
        this.$emit('isStreamingChange', newValue);
      },
      selectedStreams: function (newValue) {
        if (this.selectedStreamsCopy !== newValue) {
          this.selectedStreamsCopy = newValue;
        }
      },
      selectedStreamsCopy: function (newValue, oldValue) {
        this.$emit('selectedStreamsChange', newValue);
        if (oldValue.length > 0 && newValue.length === 0) {
          this.isStreamingCopy = false;
        }
      }
    }
  }
</script>

<style>
  .stream-controls .stream-select {
    width: 512px;
  }
  .stream-controls .stream-button {
    width: 130px;
    margin-left: 16px;
    font-weight: bold;
  }

  /* Adjusting element-ui style. */
  .stream-controls input.el-input__inner {
    border: solid 1px #888;
  }
  .stream-controls input.el-input__inner::placeholder {
    color: #888;
  }
  .stream-controls span.el-select__tags-text {
    color: #666;
    font-size: 20px;
  }
  .stream-controls i.el-select__caret {
    color: #666;
  }
  .stream-controls span.el-select__tags-text {
    font-size: 12px;
  }
</style>
