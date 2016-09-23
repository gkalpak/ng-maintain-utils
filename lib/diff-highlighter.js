'use strict';

// Imports
let chalk = require('chalk');
let os = require('os');
let readline = require('readline');
let stream = require('stream');

let eol = os.EOL;
let PassThrough = stream.PassThrough;

// Clasess
class DiffHighlighter {
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
    this._changes = [];

    this._input.on('end', () => this._output.emit('end'));
    this._input.on('error', err => this._output.emit('error', err));

    let rlOptions = {
      input: this._input,
      terminal: false,
      historySize: 0
    };

    readline.
      createInterface(rlOptions).
      on('line', line => this._processLine(line));
  }

  // Methods - Protected
  _getPairs() {
    let changes = this._changes;

    let removed = changes.filter(change => change.type === '-');
    let added = changes.filter(change => change.type === '+');

    let scores = removed.map(change1 => added.map((change2, addedIdx) => {
      let commonLengths = this._getCommonPrefixSuffixLen(change1.line, change2.line);
      let commonLen = commonLengths.prefix + commonLengths.suffix;
      let value = commonLen &&
          ((commonLen / change1.line.length) + (commonLen / change2.line.length));

      return {value, commonLengths, addedIdx};
    }));

    let addedPaired = {};
    let pairs = removed.map((change, removedIdx) => {
      let pair = {removed: change};
      let maxScore = scores[removedIdx].
        filter(score => !addedPaired[score.addedIdx]).
        reduce((aggr, score) => (score.value > aggr.value) ? score : aggr, {value: -1});

      if (maxScore.value > 0.75) {
        addedPaired[maxScore.addedIdx] = true;
        pair.added = added[maxScore.addedIdx];
        pair.commonLengths = maxScore.commonLengths;
      }

      return pair;
    });

    added.
      filter((_, addedIdx) => !addedPaired[addedIdx]).
      forEach(change => pairs.push({added: change}));

    return pairs;
  }

  _getCommonPrefixSuffixLen(line1, line2) {
    let prefix = 0;
    let suffix = 0;

    let minLen = Math.min(line1.length, line2.length);

    for (let i = 0; i < minLen; i++) {
      if (line1.charAt(i) !== line2.charAt(i)) {
        break;
      }
      prefix++;
    }

    for (let i = 1; i <= minLen - prefix; i++) {
      if (line1.charAt(line1.length - i) !== line2.charAt(line2.length - i)) {
        break;
      }
      suffix++;
    }

    return {prefix, suffix};
  }

  _highlightChange(change, prefixLen, suffixLen) {
    let type = change.type;
    let line = change.line;

    let lineStyle = this._styles[(type === '-') ? 'lineRemoved' : 'lineAdded'];
    let areaStyle = this._styles[(type === '-') ? 'areaRemoved' : 'areaAdded'];
    let startIdx = prefixLen || 0;
    let endIdx = line.length - (suffixLen || 0);

    change.highlighted = (!prefixLen && !suffixLen) ?
        lineStyle(type) + areaStyle(line) : (prefixLen + suffixLen === line.length) ?
        lineStyle(type + line) :
        lineStyle(type + line.slice(0, startIdx)) +
            areaStyle(line.slice(startIdx, endIdx)) +
            lineStyle(line.slice(endIdx));
  }

  _highlightPair(pair) {
    let removed = pair.removed;
    let added = pair.added;
    let cl = pair.commonLengths || {};

    if (removed) {
      this._highlightChange(removed, cl.prefix, cl.suffix);
    }

    if (added) {
      this._highlightChange(added, cl.prefix, cl.suffix);
    }
  }

  _processChanges() {
    let changes = this._changes;

    if (!changes.length) {
      return;
    }

    this._getPairs().forEach(pair => this._highlightPair(pair));
    changes.forEach(change => this._writeLine(change.highlighted));
    changes.length = 0;
  }

  _processLine(line) {
    let match = /^([-+])(?!\1\1 )/.exec(line);

    if (!match) {
      this._processChanges();
      this._writeLine(line);
    } else {
      this._changes.push({
        type: match[1],
        line: line.slice(1)
      });
    }
  }

  _writeLine(line) {
    this._output.write(`${line}${eol}`);
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
module.exports = DiffHighlighter;
