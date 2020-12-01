<template>
  <div id="eventstreams-ui-app">
    <router-view/>
  </div>
</template>

<script>
  export default {
    name: 'eventstreams-ui-app',
  };
</script>

<style>
  #eventstreams-ui-app {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-family: arial;
  }
  body {
    margin: 0;
  }
</style>
