/**
 * Returns an HTML blob that represents the passed yaml text.
 * The values will be color-highlighted, depending on type.
 */
function yamlToHtml (yamlText) {
  const lines = yamlText.trim().split('\n');

  const formattedLines = lines.map(function (line) {
    if (/^\s*-/.test(line)) {
      // Line is a list item, thus is entirely a value (no label).
      const indentation = line.indexOf('-');
      const value = line.substr(indentation + 1).trim();
      return '&nbsp;'.repeat(indentation) + '- ' + valueToHtml(value);
    } else {
      // Line has a label and optionally a value.
      const indentation = /^(\s*)/g.exec(line)[1].length;
      const colonIndex = line.indexOf(':');
      const label = line.substr(indentation, colonIndex - indentation);
      const value = line.substr(colonIndex + 1).trim();
      return '&nbsp;'.repeat(indentation) + label + ': ' + valueToHtml(value);
    }
  });
  return formattedLines.join('<br>');
}

// Returns the passed value withing an HTML span,
// color-highlighting it depending on type.
function valueToHtml (value) {
  var color;

  if (value === 'true' || value === 'false') {
    color = 'blue';
  } else if (isNaN(Number(value))) {
    color = 'green';
  } else {
    color = 'red';
  }

  const htmlValue = value.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<span style="color:${color}">${htmlValue}</span>`;
}

/**
 * Triggers a download of the given text
 * within a file with the specified filename.
 */
function downloadText (text, filename) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export default {
  yamlToHtml,
  downloadText
};
