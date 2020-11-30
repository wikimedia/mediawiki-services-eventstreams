<!-- Links
A collection of links to related sites.
-->

<template>
  <div class="links">
    <el-link type="info" href="https://wikitech.wikimedia.org/wiki/Event_Platform/EventStreams" target="_blank">Docs</el-link> |
    <el-link type="info" href="https://github.com/wikimedia/mediawiki-services-eventstreams" target="_blank">Code</el-link> |
    <el-link type="info" href="https://phabricator.wikimedia.org/maniphest/task/edit/?title=EventStreams%20bug&projectPHIDs=EventStreams,Analytics" target="_blank">Report a bug</el-link>
  </div>
</template>

<script>
  export default {
    name: 'Links'
  }
</script>

<style>
  .links, .links:hover {
    color: #909399;
  }
  .links a, .links a:hover {
    color: #fff !important;
    text-decoration-color: #fff;
  }
</style>
