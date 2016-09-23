'use strict';

// Imports
let chalk = require('chalk');
let os = require('os');
let readline = require('readline');
let stream = require('stream');

let eol = os.EOL;
let PassThrough = stream.PassThrough;

// Import - Local
let DiffHighlighter = require('../../lib/diff-highlighter');

// Tests
describe('DiffHighlighter', () => {
  let originalStyles = getStyles(['bgGreen', 'bgRed', 'black', 'bold', 'green', 'red', 'white']);
  let dh;

  beforeEach(() => {
    mockStyles(Object.keys(originalStyles));

    dh = new DiffHighlighter();
  });

  afterEach(() => {
    restoreStyles(originalStyles);
  });

  describe('#constructor()', () => {
    it('should initialize `_styles` (falling back to default values if necessary)', () => {
      let dh2 = new DiffHighlighter({lineRemoved: 'just this one'});
      let dh3 = new DiffHighlighter({
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

    it('should initialize `_changes` to an empty Array', () => {
      expect(dh._changes).toEqual([]);
    });

    it('should forward `end` event from `_input` to `_output`', done => {
      dh._output.on('end', done);
      dh._input.emit('end');
    });

    it('should forward `error` event from `_input` to `_output`', done => {
      dh._output.on('error', err => {
        expect(err).toBe('foo');
        done();
      });

      dh._input.emit('error', 'foo');
    });

    it('should create a `readline` interface (with appropriate options)', () => {
      spyOn(readline, 'createInterface').and.callThrough();

      let dh2 = new DiffHighlighter();

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

      let dh2 = new DiffHighlighter();
      mockInterface.close();
      spyOn(dh2, '_processLine');

      expect(readline.createInterface).toHaveBeenCalled();
      expect(mockInterface.on).toHaveBeenCalledWith('line', jasmine.any(Function));

      let cb = mockInterface.on.calls.mostRecent().args[1];
      cb('foo');

      expect(dh2._processLine).toHaveBeenCalledWith('foo');
    });
  });

  describe('#_getPairs()', () => {
    it('should pair changes (and calculate `commonLengths`)', () => {
      dh._changes = [
        {type: '-', line: '1 line'},
        {type: '-', line: '2 hilarious lines'},
        {type: '+', line: '1 funny line'},
        {type: '-', line: 'I have not been replaced'},
        {type: '+', line: '2 funny lines'},
        {type: '+', line: 'And I have not replaced anyone'}
      ];

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {
          removed: {type: '-', line: '1 line'},
          added: {type: '+', line: '1 funny line'},
          commonLengths: {prefix: 2, suffix: 4}
        },
        {
          removed: {type: '-', line: '2 hilarious lines'},
          added: {type: '+', line: '2 funny lines'},
          commonLengths: {prefix: 2, suffix: 6}
        },
        {
          removed: {type: '-', line: 'I have not been replaced'}
        },
        {
          added: {type: '+', line: 'And I have not replaced anyone'}
        }
      ]);
    });

    it('should not include a change in more than one pairs', () => {
      dh._changes = [
        {type: '-', line: '1 red line'},
        {type: '+', line: '1 green line'},
        {type: '+', line: '1 green line'},
        {type: '-', line: '2 red lines'},
        {type: '-', line: '2 red lines'},
        {type: '+', line: '2 green lines'}
      ];

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {
          removed: {type: '-', line: '1 red line'},
          added: {type: '+', line: '1 green line'},
          commonLengths: {prefix: 2, suffix: 5}
        },
        {
          removed: {type: '-', line: '2 red lines'},
          added: {type: '+', line: '2 green lines'},
          commonLengths: {prefix: 2, suffix: 6}
        },
        {
          removed: {type: '-', line: '2 red lines'}
        },
        {
          added: {type: '+', line: '1 green line'}
        }
      ]);
    });

    it('should not match changes whose similarity does not exceed a threshold', () => {
      dh._changes = [
        {type: '-', line: '12223'},
        {type: '+', line: '14443'},
        {type: '-', line: '122223'},
        {type: '+', line: '144443'}
      ];

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {
          removed: {type: '-', line: '12223'},
          added: {type: '+', line: '14443'},
          commonLengths: {prefix: 1, suffix: 1}
        },
        {
          removed: {type: '-', line: '122223'}
        },
        {
          added: {type: '+', line: '144443'}
        }
      ]);
    });

    it('should be able to handle "asymmetric" hunks', () => {
      dh._changes = [
        {type: '-', line: '1 red line'},
        {type: '-', line: '2 red lines'},
        {type: '-', line: '3 red lines'},
        {type: '+', line: '1 green line'}
      ];

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {
          removed: {type: '-', line: '1 red line'},
          added: {type: '+', line: '1 green line'},
          commonLengths: {prefix: 2, suffix: 5}
        },
        {
          removed: {type: '-', line: '2 red lines'}
        },
        {
          removed: {type: '-', line: '3 red lines'}
        }
      ]);
    });

    it('should stick to the first best match per change (even if the overall score is not best)',
      () => {
        // Scores:
        //               | +1 hilarious line | +1 funny line
        // --------------|-------------------|---------------
        //  -1 noob line |              1.07 |          1.22
        //  -1 fine line |              1.07 |          1.39
        //
        //  Ideal match:
        //    Pairs: (-1 noob line <--> +1 hilarious line), (-1 fine line <--> +1 funny line)
        //    Score: 2.46
        //
        //  Actual match:
        //    Pairs: (-1 noob line <--> +1 funny line), (-1 fine line <--> +1 hilarious line)
        //    Score: 2.29

        dh._changes = [
          {type: '-', line: '1 noob line'},
          {type: '-', line: '1 fine line'},
          {type: '+', line: '1 hilarious line'},
          {type: '+', line: '1 funny line'}
        ];

        let pairs = dh._getPairs();

        expect(pairs).toEqual([
          {
            removed: {type: '-', line: '1 noob line'},
            added: {type: '+', line: '1 funny line'},
            commonLengths: {prefix: 2, suffix: 5}
          },
          {
            removed: {type: '-', line: '1 fine line'},
            added: {type: '+', line: '1 hilarious line'},
            commonLengths: {prefix: 2, suffix: 5}
          }
        ]);
      }
    );
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

  describe('#_highlightChange()', () => {
    it('should add a `highlighted` property (string) to the specified `change`', () => {
      let change1 = {type: '-', line: 'Remove me'};
      let change2 = {type: '-', line: 'Remove me'};
      let change3 = {type: '-', line: 'Remove me'};
      let change4 = {type: '-', line: 'Remove me'};

      dh._highlightChange(change1);
      dh._highlightChange(change2, 4);
      dh._highlightChange(change3, null, 2);
      dh._highlightChange(change4, 4, 2);

      expect(change1.highlighted).toEqual(jasmine.any(String));
      expect(change2.highlighted).toEqual(jasmine.any(String));
      expect(change3.highlighted).toEqual(jasmine.any(String));
      expect(change4.highlighted).toEqual(jasmine.any(String));
    });

    it('should prepend with the proper symbol (`type`) when highlighting', () => {
      let change1 = {type: '-', line: 'Remove me'};
      let change2 = {type: '+', line: 'Add me'};

      dh._highlightChange(change1);
      dh._highlightChange(change2);

      expect(change1.highlighted).toContain('-');
      expect(change2.highlighted).toContain('+');
      expect(change1.highlighted).not.toContain('+');
      expect(change2.highlighted).not.toContain('-');
    });

    it('should highlight the prefix as `lineRemoved/Added`', () => {
      let change1 = {type: '-', line: 'please remove me'};
      let change2 = {type: '+', line: 'please add me'};

      dh._highlightChange(change1, 7);
      dh._highlightChange(change2, 7);

      expect(change1.highlighted).toContain('<red><bold>-please </bold></red>');
      expect(change2.highlighted).toContain('<green><bold>+please </bold></green>');
    });

    it('should highlight the suffix as `lineRemoved/Added`', () => {
      let change1 = {type: '-', line: 'please remove me'};
      let change2 = {type: '+', line: 'please add me'};

      dh._highlightChange(change1, null, 3);
      dh._highlightChange(change2, null, 3);

      expect(change1.highlighted).toContain('<red><bold> me</bold></red>');
      expect(change2.highlighted).toContain('<green><bold> me</bold></green>');
    });

    it('should highlight the different area as `areaRemoved/Added`', () => {
      let change1 = {type: '-', line: 'please remove me'};
      let change2 = {type: '+', line: 'please add me'};

      dh._highlightChange(change1, 7, 3);
      dh._highlightChange(change2, 7, 3);

      expect(change1.highlighted).toContain('<bgRed><white>remove</white></bgRed>');
      expect(change2.highlighted).toContain('<bgGreen><black>add</black></bgGreen>');
    });

    it('should highlight the whole line as `areaRemoved/Added` if no prefix and suffix', () => {
      let change1 = {type: '-', line: 'please remove me'};
      let change2 = {type: '+', line: 'please add me'};

      dh._highlightChange(change1);
      dh._highlightChange(change2);

      expect(change1.highlighted).toBe(
          '<red><bold>-</bold></red>' +
          '<bgRed><white>please remove me</white></bgRed>');
      expect(change2.highlighted).toBe(
          '<green><bold>+</bold></green>' +
          '<bgGreen><black>please add me</black></bgGreen>');
    });

    it('should merge prefix and suffix if the different area is empty', () => {
      let change1 = {type: '-', line: 'please remove me'};
      let change2 = {type: '+', line: 'please add me'};

      dh._highlightChange(change1, 8, 8);
      dh._highlightChange(change2, 8, 5);

      expect(change1.highlighted).toBe('<red><bold>-please remove me</bold></red>');
      expect(change2.highlighted).toBe('<green><bold>+please add me</bold></green>');
    });

    it('should ignore a missing prefix or suffix', () => {
      let change1 = {type: '-', line: 'please remove me'};
      let change2 = {type: '+', line: 'please add me'};
      let change3 = {type: '-', line: 'please remove me'};
      let change4 = {type: '+', line: 'please add me'};

      dh._highlightChange(change1, 7);
      dh._highlightChange(change2, 7);
      dh._highlightChange(change3, null, 3);
      dh._highlightChange(change4, null, 3);

      expect(change1.highlighted).toBe(
          '<red><bold>-please </bold></red>' +
          '<bgRed><white>remove me</white></bgRed>');
      expect(change2.highlighted).toBe(
          '<green><bold>+please </bold></green>' +
          '<bgGreen><black>add me</black></bgGreen>');
      expect(change3.highlighted).toBe(
          '<red><bold>-</bold></red>' +
          '<bgRed><white>please remove</white></bgRed>' +
          '<red><bold> me</bold></red>');
      expect(change4.highlighted).toBe(
          '<green><bold>+</bold></green>' +
          '<bgGreen><black>please add</black></bgGreen>' +
          '<green><bold> me</bold></green>');
    });
  });

  describe('#_highlightPair()', () => {
    beforeEach(() => {
      spyOn(dh, '_highlightChange');
    });

    it('should call `_highlightChange()` for both `added` and `removed`', () => {
      let pair = {removed: 'foo', added: 'bar', commonLengths: {prefix: 'pre', suffix: 'suf'}};

      dh._highlightPair(pair);

      expect(dh._highlightChange).toHaveBeenCalledTimes(2);
      expect(dh._highlightChange).toHaveBeenCalledWith('foo', 'pre', 'suf');
      expect(dh._highlightChange).toHaveBeenCalledWith('bar', 'pre', 'suf');
    });

    it('should be able to handle "single" pairs', () => {
      let pair1 = {removed: 'foo', commonLengths: {prefix: 'pre', suffix: 'suf'}};
      let pair2 = {added: 'bar', commonLengths: {prefix: 'pre', suffix: 'suf'}};

      dh._highlightPair(pair1);

      expect(dh._highlightChange).toHaveBeenCalledTimes(1);
      expect(dh._highlightChange).toHaveBeenCalledWith('foo', 'pre', 'suf');

      dh._highlightPair(pair2);

      expect(dh._highlightChange).toHaveBeenCalledTimes(2);
      expect(dh._highlightChange).toHaveBeenCalledWith('bar', 'pre', 'suf');
    });

    it('should be able to handle pairs without `commonLengths`', () => {
      let pair1 = {removed: 'foo', added: 'bar'};
      let pair2 = {removed: 'baz', commonLengths: null};

      dh._highlightPair(pair1);

      expect(dh._highlightChange).toHaveBeenCalledTimes(2);
      expect(dh._highlightChange).toHaveBeenCalledWith('foo', undefined, undefined);
      expect(dh._highlightChange).toHaveBeenCalledWith('bar', undefined, undefined);

      dh._highlightPair(pair2);

      expect(dh._highlightChange).toHaveBeenCalledTimes(3);
      expect(dh._highlightChange).toHaveBeenCalledWith('baz', undefined, undefined);
    });
  });

  describe('#_processChanges()', () => {
    let mockPairs;

    beforeEach(() => {
      mockPairs = [{id: 1}, {id: 1}, {id: 3}];

      spyOn(dh, '_getPairs').and.returnValue(mockPairs);
      spyOn(dh, '_highlightPair').and.callFake(pair => pair.highlighted = `<${pair.line}>`);
      spyOn(dh, '_writeLine');
    });

    it('should do nothing if there are no changes', () => {
      dh._processChanges();

      expect(dh._getPairs).not.toHaveBeenCalled();
      expect(dh._highlightPair).not.toHaveBeenCalled();
      expect(dh._writeLine).not.toHaveBeenCalled();
    });

    it('should pair changes', () => {
      dh._changes.push({});
      dh._processChanges();

      expect(dh._getPairs).toHaveBeenCalled();
    });

    it('should highlight each pair', () => {
      dh._changes.push({});
      dh._processChanges();

      expect(dh._highlightPair).toHaveBeenCalledTimes(3);
      expect(dh._highlightPair.calls.argsFor(0)[0]).toBe(mockPairs[0]);
      expect(dh._highlightPair.calls.argsFor(1)[0]).toBe(mockPairs[1]);
      expect(dh._highlightPair.calls.argsFor(2)[0]).toBe(mockPairs[2]);
    });

    it('should write out each change (after highlighting)', () => {
      dh._writeLine.and.callFake(() => expect(dh._highlightPair).toHaveBeenCalled());

      dh._changes = [{highlighted: 1}, {highlighted: 2}, {highlighted: 3}];
      dh._processChanges();

      expect(dh._writeLine).toHaveBeenCalledTimes(3);
      expect(dh._writeLine).toHaveBeenCalledWith(1);
      expect(dh._writeLine).toHaveBeenCalledWith(2);
      expect(dh._writeLine).toHaveBeenCalledWith(3);
    });

    it('should empty `_changes`', () => {
      dh._changes = [{}, {}, {}];
      dh._processChanges();

      expect(dh._changes).toEqual([]);
    });
  });

  describe('#_processLine()', () => {
    beforeEach(() => {
      spyOn(dh, '_processChanges');
      spyOn(dh, '_writeLine');
    });

    it('should process the pending changes and print a context line', () => {
      dh._processChanges.and.callFake(() => expect(dh._writeLine).not.toHaveBeenCalled());

      dh._processLine('process me');

      expect(dh._processChanges).toHaveBeenCalled();
      expect(dh._writeLine).toHaveBeenCalledWith('process me');
    });

    it('should record a change for each removed line', () => {
      dh._processLine('- Removed this');

      expect(dh._changes).toEqual([{
        type: '-',
        line: ' Removed this',
      }]);
    });

    it('should record a change for each added line', () => {
      dh._processLine('+ Added that');

      expect(dh._changes).toEqual([{
        type: '+',
        line: ' Added that',
      }]);
    });

    it('should not confuse header lines with changes', () => {
      spyOn(dh._changes, 'push');

      dh._processLine('--- a/file.ext');
      dh._processLine('+++ b/file.ext');

      expect(dh._writeLine).toHaveBeenCalledTimes(2);
      expect(dh._writeLine).toHaveBeenCalledWith('--- a/file.ext');
      expect(dh._writeLine).toHaveBeenCalledWith('+++ b/file.ext');
      expect(dh._changes.push).not.toHaveBeenCalled();
      expect(dh._changes.length).toBe(0);
    });
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

  // Helpers
  function getStyles(names) {
    let styles = {};

    names.forEach(name => styles[name] = {
      open: chalk.styles[name].open,
      close: chalk.styles[name].close
    });

    return styles;
  }

  function mockStyles(names) {
    names.forEach(name => {
      chalk.styles[name].open = `<${name}>`;
      chalk.styles[name].close = `</${name}>`;
    });
  }

  function restoreStyles(styles) {
    Object.keys(styles).forEach(name => {
      chalk.styles[name].open = styles[name].open;
      chalk.styles[name].close = styles[name].close;
    });
  }
});
