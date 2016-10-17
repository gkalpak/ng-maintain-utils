'use strict';

// Imports
let chalk = require('chalk');
let os = require('os');
let readline = require('readline');
let stream = require('stream');

let eol = os.EOL;
let PassThrough = stream.PassThrough;

// Constants
const REMOVED_AREA_RE_SRC = '\\[-(.+?)-]';
const ADDED_AREA_RE_SRC = '\\{\\+(.+?)\\+}';
const IS_CHANGE_RE = new RegExp(`${REMOVED_AREA_RE_SRC}|${ADDED_AREA_RE_SRC}`);
const ALL_REMOVED_AREAS = new RegExp(REMOVED_AREA_RE_SRC, 'g');
const ALL_ADDED_AREAS = new RegExp(ADDED_AREA_RE_SRC, 'g');
const ALL_REPLACED_AREAS = new RegExp(REMOVED_AREA_RE_SRC + ADDED_AREA_RE_SRC, 'g');

// Clasess
class DiffHighlighter2 {
  // Constructor
  constructor(styles) {
    let defaultStyles = {
      lineRemoved: chalk.red.bold,
      lineAdded: chalk.green.bold,
      areaRemoved: chalk.bgRed.white,
      areaAdded: chalk.bgGreen.black
    };

    this._styles = Object.assign(defaultStyles, styles);
    this._input = new PassThrough();
    this._output = new PassThrough();
    this._changes = {removed: [], added: []};

    this._input.on('end', () => this._output.emit('end'));
    this._input.on('error', err => this._output.emit('error', err));

    let rlOptions = {
      input: this._input,
      terminal: false,
      historySize: 0
    };

    readline.
      createInterface(rlOptions).
      on('line', rawLine => this._processLine(rawLine));
  }

  // Methods - Protected
  _addChange(rawLine) {
    let refinedLine = this._refineReplacedAreas(rawLine);
    let removedLine = refinedLine.replace(ALL_ADDED_AREAS, '');
    let addedLine = refinedLine.replace(ALL_REMOVED_AREAS, '');

    if (removedLine.trim()) {
      removedLine = removedLine.
        replace(/^\[-(\s+)(.*?)-]/, '$1[-$2-]').
        replace(/\[-(.*?)(\s+)-]$/, '[-$1-]$2');

      this._changes.removed.push(removedLine);
    }

    if (addedLine.trim()) {
      addedLine = addedLine.
        replace(/^\{\+(\s+)(.*?)\+}/, '$1{+$2+}').
        replace(/\{\+(.*?)(\s+)\+}$/, '{+$1+}$2');

      this._changes.added.push(addedLine);
    }
  }

  _getCommonPrefixSuffixLen(text1, text2) {
    let prefix = 0;
    let suffix = 0;

    let minLen = Math.min(text1.length, text2.length);

    for (let i = 0; i < minLen; i++) {
      if (text1.charAt(i) !== text2.charAt(i)) {
        break;
      }
      prefix++;
    }

    for (let i = 1; i <= minLen - prefix; i++) {
      if (text1.charAt(text1.length - i) !== text2.charAt(text2.length - i)) {
        break;
      }
      suffix++;
    }

    return {prefix, suffix};
  }

  _highlightLine(styleSuffix, line) {
    let highlightedLine = '';

    let lineStyle = this._styles[`line${styleSuffix}`];
    let areaStyle = this._styles[`area${styleSuffix}`];
    let areaRegex = (styleSuffix === 'Removed') ? ALL_REMOVED_AREAS : ALL_ADDED_AREAS;

    let lastIdx = 0;
    let match;

    while ((match = areaRegex.exec(line))) {
      let linePart = line.slice(lastIdx, match.index);
      let areaPart = match[1];

      highlightedLine += lineStyle(linePart) + areaStyle(areaPart);

      lastIdx = areaRegex.lastIndex;
    }

    highlightedLine += lineStyle(line.slice(lastIdx));

    return highlightedLine;
  }

  _processChanges() {
    let removed = this._changes.removed;
    let added = this._changes.added;

    removed.forEach(line => this._writeLine(this._highlightLine('Removed', line)));
    added.forEach(line => this._writeLine(this._highlightLine('Added', line)));

    removed.length = added.length = 0;
  }

  _processLine(rawLine) {
    if (IS_CHANGE_RE.test(rawLine)) {
      this._addChange(rawLine);
    } else {
      this._processChanges();
      this._writeLine(rawLine);
    }
  }

  _refineReplacedAreas(rawLine) {
    let refinedLine = '';
    let lastIdx = 0;
    let match;

    while ((match = ALL_REPLACED_AREAS.exec(rawLine))) {
      let removed = match[1];
      let added = match[2];

      let commonPS = this._getCommonPrefixSuffixLen(removed, added);
      let prefix = commonPS.prefix;
      let suffix = commonPS.suffix;

      let totalCommonLen = prefix + suffix;
      let nothingRemoved = removed.length === totalCommonLen;
      let nothingAdded = added.length === totalCommonLen;

      let removedEndIdx = removed.length - suffix;
      let addedEndIdx = added.length - suffix;
      let refinedReplacedArea = removed.slice(0, prefix) +
        (nothingRemoved ? '' : `[-${removed.slice(prefix, removedEndIdx)}-]`) +
        (nothingAdded ? '' : `{+${added.slice(prefix, addedEndIdx)}+}`) +
        removed.slice(removedEndIdx);

      refinedLine += rawLine.slice(lastIdx, match.index) + refinedReplacedArea;
      lastIdx = ALL_REPLACED_AREAS.lastIndex;
    }

    refinedLine += rawLine.slice(lastIdx);

    return refinedLine;
  }

  _writeLine(rawLine) {
    this._output.write(rawLine + eol);
  }

  // Methods - Public
  getInputStream() {
    return this._input;
  }

  getOutputStream() {
    return this._output;
  }
}

// Exports
module.exports = DiffHighlighter2;
