'use strict';

// Imports
let os = require('os');
let readline = require('readline');
let stream = require('stream');

let eol = os.EOL;
let PassThrough = stream.PassThrough;

// Import - Local
let DiffHighlighter2 = require('../../lib/diff-highlighter2');

// Tests
describe('DiffHighlighter2', () => {
  let dh;

  beforeEach(() => dh = new DiffHighlighter2());

  describe('#constructor()', () => {
    it('should initialize `_styles` (falling back to default values if necessary)', () => {
      let dh2 = new DiffHighlighter2({lineRemoved: 'just this one'});
      let dh3 = new DiffHighlighter2({
        lineRemoved: 'foo',
        lineAdded: 'bar',
        areaRemoved: 'baz',
        areaAdded: 'qux'
      });

      expect(dh._styles).toEqual({
        lineRemoved: jasmine.any(Function),
        lineAdded: jasmine.any(Function),
        areaRemoved: jasmine.any(Function),
        areaAdded: jasmine.any(Function)
      });

      expect(dh2._styles).toEqual({
        lineRemoved: 'just this one',
        lineAdded: jasmine.any(Function),
        areaRemoved: jasmine.any(Function),
        areaAdded: jasmine.any(Function)
      });

      expect(dh3._styles).toEqual({
        lineRemoved: 'foo',
        lineAdded: 'bar',
        areaRemoved: 'baz',
        areaAdded: 'qux'
      });
    });

    it('should initialize `_input`/`_output` (PassThrough)', () => {
      expect(dh._input).toEqual(jasmine.any(PassThrough));
      expect(dh._output).toEqual(jasmine.any(PassThrough));
    });

    it('should initialize `_changes`', () => {
      expect(dh._changes).toEqual({removed: [], added: []});
    });

    it('should forward `end` event from `_input` to `_output`', done => {
      dh._output.on('end', done);
      dh._input.emit('end');
    });

    it('should process any pending changes on `end`', () => {
      spyOn(dh, '_processChanges');

      expect(dh._processChanges).not.toHaveBeenCalled();

      dh._input.emit('end');

      expect(dh._processChanges).toHaveBeenCalled();
    });

    it('should forward `error` event from `_input` to `_output`', done => {
      dh._output.on('error', err => {
        expect(err).toBe('foo');
        done();
      });

      dh._input.emit('error', 'foo');
    });

    it('should process any pending changes on `error`', () => {
      spyOn(dh, '_processChanges');

      expect(dh._processChanges).not.toHaveBeenCalled();

      dh._output.on('error', () => {});
      dh._input.emit('error', 'foo');

      expect(dh._processChanges).toHaveBeenCalled();
    });

    it('should create a `readline` interface (with appropriate options)', () => {
      spyOn(readline, 'createInterface').and.callThrough();

      let dh2 = new DiffHighlighter2();

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: jasmine.any(PassThrough),
        terminal: false,
        historySize: 0
      });
      expect(readline.createInterface.calls.mostRecent().args[0].input).toBe(dh2._input);
    });

    it('should attach a `line` listener to the `readline` interface', () => {
      let mockInterface = readline.createInterface({input: new PassThrough()});
      spyOn(mockInterface, 'on').and.callThrough();
      spyOn(readline, 'createInterface').and.returnValue(mockInterface);

      let dh2 = new DiffHighlighter2();
      mockInterface.close();
      spyOn(dh2, '_processLine');

      expect(readline.createInterface).toHaveBeenCalled();
      expect(mockInterface.on).toHaveBeenCalledWith('line', jasmine.any(Function));

      let cb = mockInterface.on.calls.mostRecent().args[1];
      cb('foo');

      expect(dh2._processLine).toHaveBeenCalledWith('foo');
    });
  });

  describe('#_addChange()', () => {
    beforeEach(() => {
      spyOn(dh, '_refineReplacedAreas').and.callFake(rawLine => rawLine);
    });

    it('should call `_refineReplacedAreas()`', () => {
      dh._refineReplacedAreas.and.callFake(rawLine => `refined:${rawLine}`);

      dh._addChange('line 1');
      dh._addChange('line 2');
      dh._addChange('line 3');

      expect(dh._refineReplacedAreas).toHaveBeenCalledTimes(3);
      expect(dh._refineReplacedAreas).toHaveBeenCalledWith('line 1');
      expect(dh._refineReplacedAreas).toHaveBeenCalledWith('line 2');
      expect(dh._refineReplacedAreas).toHaveBeenCalledWith('line 3');
    });

    it('should add a removed and an added line to `_changes`', () => {
      dh._addChange('some line');

      expect(dh._changes).toEqual({
        removed: ['some line'],
        added: ['some line']
      });
    });

    it('should remove added areas from the removed line and vice versa', () => {
      dh._addChange('a [-line-] with [-removals-] only');
      dh._addChange('a {+line+} with {+additions+} only');
      dh._addChange('and [-a-] line {+with+} {+both+} [-additions-] [-and-] removals');

      expect(dh._changes).toEqual({
        removed: [
          'a [-line-] with [-removals-] only',
          'a  with  only',
          'and [-a-] line   [-additions-] [-and-] removals'
        ],
        added: [
          'a  with  only',
          'a {+line+} with {+additions+} only',
          'and  line {+with+} {+both+}   removals'
        ]
      });
    });

    it('should not add empty or space only lines to `_changes`', () => {
      dh._addChange('[-empty as added-]');
      dh._addChange('{+empty as removed+}');
      dh._addChange('[-spaces-] [-only-] [-as-] [-added-]');
      dh._addChange('{+spaces+} {+only+} {+as+} {+removed+}');

      expect(dh._changes).toEqual({
        removed: [
          '[-empty as added-]',
          '[-spaces-] [-only-] [-as-] [-added-]'
        ],
        added: [
          '{+empty as removed+}',
          '{+spaces+} {+only+} {+as+} {+removed+}'
        ]
      });
    });

    it('should move leading whitespace out of leading changed areas', () => {
      dh._addChange('[- \t this \t -] is [- \t a \t -] line');
      dh._addChange('{+ \t this \t +} is {+ \t a \t +} line');

      expect(dh._changes).toEqual({
        removed: [
          ' \t [-this \t -] is [- \t a \t -] line',
          ' is  line'
        ],
        added: [
          ' is  line',
          ' \t {+this \t +} is {+ \t a \t +} line',
        ]
      });
    });

    it('should move trailing whitespace out of trailing changed areas', () => {
      dh._addChange('this [- \t is \t -] a [- \t line \t -]');
      dh._addChange('this {+ \t is \t +} a {+ \t line \t +}');

      expect(dh._changes).toEqual({
        removed: [
          'this [- \t is \t -] a [- \t line-] \t ',
          'this  a '
        ],
        added: [
          'this  a ',
          'this {+ \t is \t +} a {+ \t line+} \t '
        ]
      });
    });
  });

  describe('#_getCommonPrefixSuffixLen()', () => {
    it('should return an object (with `prefix`, `suffix` attributes', () => {
      expect(dh._getCommonPrefixSuffixLen('foo', 'bar')).toEqual(jasmine.any(Object));
    });

    it('should return the length of the common prefix', () => {
      expect(dh._getCommonPrefixSuffixLen('foo', 'bar').prefix).toBe(0);
      expect(dh._getCommonPrefixSuffixLen('hello', 'hi').prefix).toBe(1);
      expect(dh._getCommonPrefixSuffixLen('hello', 'hey').prefix).toBe(2);
      expect(dh._getCommonPrefixSuffixLen('hello', 'hello, there').prefix).toBe(5);
    });

    it('should return the length of the common suffix', () => {
      expect(dh._getCommonPrefixSuffixLen('foo', 'bar').suffix).toBe(0);
      expect(dh._getCommonPrefixSuffixLen('hello', 'jlo').suffix).toBe(2);
      expect(dh._getCommonPrefixSuffixLen('hello', 'allo').suffix).toBe(3);
      expect(dh._getCommonPrefixSuffixLen('hello', 'Right, hello').suffix).toBe(5);
    });

    it('should not exceed the total line length', () => {
      expect(dh._getCommonPrefixSuffixLen('0123334560', '124444456')).toEqual({
        prefix: 0,
        suffix: 0
      });

      expect(dh._getCommonPrefixSuffixLen('12333456', '124444456')).toEqual({
        prefix: 2,
        suffix: 3
      });

      expect(dh._getCommonPrefixSuffixLen('12345678', '12345678')).toEqual({
        prefix: 8,
        suffix: 0
      });

      expect(dh._getCommonPrefixSuffixLen('1234-5678', '12345678')).toEqual({
        prefix: 4,
        suffix: 4
      });

      expect(dh._getCommonPrefixSuffixLen('123321', '123-3321')).toEqual({
        prefix: 3,
        suffix: 3
      });

      expect(dh._getCommonPrefixSuffixLen('123321', '-12-3321')).toEqual({
        prefix: 0,
        suffix: 4
      });

      expect(dh._getCommonPrefixSuffixLen('123321', '-123321')).toEqual({
        prefix: 0,
        suffix: 6
      });
    });
  });

  describe('#_highlightLine()', () => {
    let mockStyles = {
      lineRemoved: str => str && `<red><bold>${str}</bold></red>`,
      lineAdded: str => str && `<green><bold>${str}</bold></green>`,
      areaRemoved: str => str && `<bgRed><white>${str}</white></bgRed>`,
      areaAdded: str => str && `<bgGreen><black>${str}</black></bgGreen>`
    };

    beforeEach(() => dh = new DiffHighlighter2(mockStyles));

    it('should highlight removed parts of the line', () => {
      expect(dh._highlightLine('Removed', '[-line 1-]')).toContain(
        '<bgRed><white>line 1</white></bgRed>');

      expect(dh._highlightLine('Removed', 'line[-e-] 1')).toContain(
        '<bgRed><white>e</white></bgRed>');
    });

    it('should highlight added parts of the line', () => {
      expect(dh._highlightLine('Added', '{+line 1+}')).toContain(
        '<bgGreen><black>line 1</black></bgGreen>');

      expect(dh._highlightLine('Added', 'line{+e+} 1')).toContain(
        '<bgGreen><black>e</black></bgGreen>');
    });

    it('should highlight unchanged parts of the line', () => {
      expect(dh._highlightLine('Removed', 'li[-ne-] 1')).toBe(
        '<red><bold>li</bold></red><bgRed><white>ne</white></bgRed><red><bold> 1</bold></red>');

      var line = '[-long-] line {+with+}[-without-] much [-else -]there';
      expect(dh._highlightLine('Removed', line)).toBe(
        '<bgRed><white>long</white></bgRed>' +
        '<red><bold> line {+with+}</bold></red>' +
        '<bgRed><white>without</white></bgRed>' +
        '<red><bold> much </bold></red>' +
        '<bgRed><white>else </white></bgRed>' +
        '<red><bold>there</bold></red>');

      expect(dh._highlightLine('Added', line)).toBe(
        '<green><bold>[-long-] line </bold></green>' +
        '<bgGreen><black>with</black></bgGreen>' +
        '<green><bold>[-without-] much [-else -]there</bold></green>');

      expect(dh._highlightLine('Added', 'li[-ne-] 1')).toBe(
        '<green><bold>li[-ne-] 1</bold></green>');

      expect(dh._highlightLine('Added', 'li{+ne+} 1')).toBe(
        '<green><bold>li</bold></green>' +
        '<bgGreen><black>ne</black></bgGreen>' +
        '<green><bold> 1</bold></green>');
    });

    it('should highlight all parts of the line (in other words)', () => {
      var line = 'this {+is+} one [-long-] line [-which-] contains [-removed (-)-], ' +
                 '{+added (+)+} and {+[un-changed]+} parts';

      expect(dh._highlightLine('Removed', line)).toBe(
        '<red><bold>this {+is+} one </bold></red>' +
        '<bgRed><white>long</white></bgRed>' +
        '<red><bold> line </bold></red>' +
        '<bgRed><white>which</white></bgRed>' +
        '<red><bold> contains </bold></red>' +
        '<bgRed><white>removed (-)</white></bgRed>' +
        '<red><bold>, {+added (+)+} and {+[un-changed]+} parts</bold></red>');

      expect(dh._highlightLine('Added', line)).toBe(
        '<green><bold>this </bold></green>' +
        '<bgGreen><black>is</black></bgGreen>' +
        '<green><bold> one [-long-] line [-which-] contains [-removed (-)-], </bold></green>' +
        '<bgGreen><black>added (+)</black></bgGreen>' +
        '<green><bold> and </bold></green>' +
        '<bgGreen><black>[un-changed]</black></bgGreen>' +
        '<green><bold> parts</bold></green>');
    });
  });

  describe('#_processChanges()', () => {
    beforeEach(() => {
      spyOn(dh, '_highlightLine');
      spyOn(dh, '_writeLine');
    });

    it('should do nothing if there are no changes', () => {
      dh._processChanges();

      expect(dh._highlightLine).not.toHaveBeenCalled();
      expect(dh._writeLine).not.toHaveBeenCalled();
    });

    it('should empty `_changes.removed/added`', () => {
      dh._changes = {
        removed: [{}, {}, {}],
        added: [{}, {}, {}]
      };
      dh._processChanges();

      expect(dh._changes).toEqual({removed: [], added: []});
    });

    it('should highlight each line', () => {
      dh._changes = {
        removed: ['line 1', 'line 2', 'line 3'],
        added: ['line 4', 'line 5', 'line 6']
      };
      dh._processChanges();

      expect(dh._highlightLine).toHaveBeenCalledTimes(6);
      expect(dh._highlightLine).toHaveBeenCalledWith('Removed', 'line 1');
      expect(dh._highlightLine).toHaveBeenCalledWith('Removed', 'line 2');
      expect(dh._highlightLine).toHaveBeenCalledWith('Removed', 'line 3');
      expect(dh._highlightLine).toHaveBeenCalledWith('Added', 'line 4');
      expect(dh._highlightLine).toHaveBeenCalledWith('Added', 'line 5');
      expect(dh._highlightLine).toHaveBeenCalledWith('Added', 'line 6');
    });

    it('should write out each change (after highlighting)', () => {
      dh._highlightLine.and.callFake((styleSuffix, line) => `highlighted:${styleSuffix}:${line}`);

      dh._changes = {
        removed: ['line 1', 'line 2', 'line 3'],
        added: ['line 4', 'line 5', 'line 6']
      };
      dh._processChanges();

      expect(dh._writeLine).toHaveBeenCalledTimes(6);
      expect(dh._writeLine).toHaveBeenCalledWith('highlighted:Removed:line 1');
      expect(dh._writeLine).toHaveBeenCalledWith('highlighted:Removed:line 2');
      expect(dh._writeLine).toHaveBeenCalledWith('highlighted:Removed:line 3');
      expect(dh._writeLine).toHaveBeenCalledWith('highlighted:Added:line 4');
      expect(dh._writeLine).toHaveBeenCalledWith('highlighted:Added:line 5');
      expect(dh._writeLine).toHaveBeenCalledWith('highlighted:Added:line 6');
    });
  });

  describe('#_processLine()', () => {
    beforeEach(() => {
      spyOn(dh, '_addChange');
      spyOn(dh, '_processChanges');
      spyOn(dh, '_writeLine');
    });

    it('should process the pending changes and print a context line', () => {
      dh._processChanges.and.callFake(() => expect(dh._writeLine).not.toHaveBeenCalled());

      dh._processLine('process me');

      expect(dh._processChanges).toHaveBeenCalled();
      expect(dh._writeLine).toHaveBeenCalledWith('process me');
    });

    it('should add a change for each changed line', () => {
      dh._processLine('Hey, [-remove-] this');
      dh._processLine('Yo, {+add+} that');
      dh._processLine('[-Remove this-]{+Add that+}');

      expect(dh._addChange).toHaveBeenCalledTimes(3);
      expect(dh._addChange).toHaveBeenCalledWith('Hey, [-remove-] this');
      expect(dh._addChange).toHaveBeenCalledWith('Yo, {+add+} that');
      expect(dh._addChange).toHaveBeenCalledWith('[-Remove this-]{+Add that+}');
    });
  });

  describe('#_refineReplacedAreas()', () => {
    it('should "focus" on the actually replaced part (not necessarily the whole word)', () => {
      let input = 'this [-was-]{+is+} a line';
      let output = 'this [-wa-]{+i+}s a line';

      expect(dh._refineReplacedAreas(input)).toBe(output);
    });

    it('should process all replaced areas', () => {
      let input = 'this [-sure was-]{+sure is+} a [-full line-]{+fine line+}';
      let output = 'this sure [-wa-]{+i+}s a f[-ull-]{+ine+} line';

      expect(dh._refineReplacedAreas(input)).toBe(output);
    });

    it('should ignore non-replaced areas', () => {
      let input = 'this [-was-] {+is+} a line';
      let output = 'this [-was-] {+is+} a line';

      expect(dh._refineReplacedAreas(input)).toBe(output);
    });

    it('should remove empty removed/added areas', () => {
      let input = 'this [-is-]{+sure is+} a [-fine line-]{+line+} for testing';
      let output = 'this {+sure +}is a [-fine -]line for testing';

      expect(dh._refineReplacedAreas(input)).toBe(output);
    });

    /* eslint-disable */
    function _refineReplacedAreas(rawLine) {
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
    /* eslint-enable */
  });

  describe('#_writeLine()', () => {
    it('should write a line to the output stream', done => {
      dh._output.on('data', data => {
        expect(String(data)).toBe(`foo${eol}`);
        done();
      });

      dh._writeLine('foo');
    });
  });

  describe('#getInputStream()', () => {
    it('should return the input stream', () => {
      expect(dh.getInputStream()).toBe(dh._input);
    });
  });

  describe('#getOutputStream()', () => {
    it('should return the output stream', () => {
      expect(dh.getOutputStream()).toBe(dh._output);
    });
  });
});
