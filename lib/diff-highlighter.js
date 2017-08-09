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

    this._input.on('end', () => {
      this._processChanges();
      this._output.emit('end');
    });
    this._input.on('error', err => {
      this._processChanges();
      this._output.emit('error', err);
    });

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
  _breakUpLine(rawLine) {
    let leadingWhiteSpace = /^\s*/.exec(rawLine)[0];
    let trailingWhiteSpace = /\s*$/.exec(rawLine.slice(leadingWhiteSpace.length))[0];

    let startIdx = leadingWhiteSpace.length;
    let endIdx = rawLine.length - trailingWhiteSpace.length;
    let text = rawLine.slice(startIdx, endIdx);

    return {text, leadingWhiteSpace, trailingWhiteSpace};
  }

  _getPairs() {
    let changes = this._changes;

    let removed = changes.filter(change => change.type === '-');
    let added = changes.filter(change => change.type === '+');

    let scores = removed.map(change1 => added.map((change2, addedIdx) => {
      let text1 = change1.line.text;
      let text2 = change2.line.text;

      let commonLengths = this._getCommonPrefixSuffixLen(text1, text2);
      let totalCommonLen = commonLengths.prefix + commonLengths.suffix;
      let value = totalCommonLen &&
          ((totalCommonLen / text1.length) + (totalCommonLen / text2.length));

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

  _highlightChange(change, prefixLen, suffixLen) {
    let type = change.type;
    let text = change.line.text;
    let leadingWs = change.line.leadingWhiteSpace;
    let trailingWs = change.line.trailingWhiteSpace;

    let wholeLine = leadingWs + text + trailingWs;

    let styleSuffix = (type === '-') ? 'Removed' : 'Added';
    let lineStyle = this._styles[`line${styleSuffix}`];
    let areaStyle = this._styles[`area${styleSuffix}`];
    let startIdx = prefixLen || 0;
    let endIdx = text.length - (suffixLen || 0);

    change.highlighted = (!prefixLen && !suffixLen) ?
      lineStyle(type) + areaStyle(wholeLine) : (prefixLen + suffixLen === text.length) ?
        lineStyle(type + wholeLine) :
        lineStyle(type + leadingWs + text.slice(0, startIdx)) +
          areaStyle(text.slice(startIdx, endIdx)) +
          lineStyle(text.slice(endIdx) + trailingWs);
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

  _processLine(rawLine) {
    let match = /^([-+])(?!\1\1 )/.exec(rawLine);

    if (!match) {
      this._processChanges();
      this._writeLine(rawLine);
    } else {
      this._changes.push({
        type: match[1],
        line: this._breakUpLine(rawLine.slice(1))
      });
    }
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
module.exports = DiffHighlighter;
