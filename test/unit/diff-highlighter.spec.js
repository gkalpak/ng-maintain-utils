'use strict';

// Imports
let os = require('os');
let readline = require('readline');
let stream = require('stream');

let eol = os.EOL;
let PassThrough = stream.PassThrough;

// Import - Local
let DiffHighlighter = require('../../lib/diff-highlighter');

// Tests
describe('DiffHighlighter', () => {
  let dh;

  beforeEach(() => dh = new DiffHighlighter());

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

  describe('#_breakUpLine()', () => {
    it('should return an object (with appropriate properties)', () => {
      expect(dh._breakUpLine('')).toEqual(jasmine.objectContaining({
        text: jasmine.any(String),
        leadingWhiteSpace: jasmine.any(String),
        trailingWhiteSpace: jasmine.any(String)
      }));
    });

    it('should extract the leading/trailing whitespace', () => {
      expect(dh._breakUpLine(' foo').leadingWhiteSpace).toBe(' ');
      expect(dh._breakUpLine('bar  ').trailingWhiteSpace).toBe('  ');

      expect(dh._breakUpLine('   baz    ')).toEqual(jasmine.objectContaining({
        leadingWhiteSpace: '   ',
        trailingWhiteSpace: '    '
      }));

      expect(dh._breakUpLine('qux')).toEqual(jasmine.objectContaining({
        leadingWhiteSpace: '',
        trailingWhiteSpace: ''
      }));
    });

    it('should isolate the rest of the text', () => {
      expect(dh._breakUpLine(' foo').text).toBe('foo');
      expect(dh._breakUpLine('bar  ').text).toBe('bar');
      expect(dh._breakUpLine('   baz    ').text).toBe('baz');
      expect(dh._breakUpLine('qux').text).toBe('qux');
    });

    it('should ignore non-leading/trailing whitespace', () => {
      expect(dh._breakUpLine('foo bar baz qux')).toEqual(jasmine.objectContaining({
        text: 'foo bar baz qux',
        leadingWhiteSpace: '',
        trailingWhiteSpace: ''
      }));

      expect(dh._breakUpLine(' foo  bar   baz    qux     ')).toEqual(jasmine.objectContaining({
        text: 'foo  bar   baz    qux',
        leadingWhiteSpace: ' ',
        trailingWhiteSpace: '     '
      }));
    });

    it('should detect any type of whitespace', () => {
      expect(dh._breakUpLine(' \t \r foo bar\tbaz\rqux\nbaz\r\nbar foo \n \r\n ')).toEqual({
        text: 'foo bar\tbaz\rqux\nbaz\r\nbar foo',
        leadingWhiteSpace: ' \t \r ',
        trailingWhiteSpace: ' \n \r\n '
      });
    });

    it('should handle whitespace-only strings correctly', () => {
      expect(dh._breakUpLine('     ')).toEqual({
        text: '',
        leadingWhiteSpace: '     ',
        trailingWhiteSpace: ''
      });
    });

    it('should handle empty strings correctly', () => {
      expect(dh._breakUpLine('')).toEqual({
        text: '',
        leadingWhiteSpace: '',
        trailingWhiteSpace: ''
      });
    });
  });

  describe('#_getPairs()', () => {
    it('should pair changes (and calculate `commonLengths`)', () => {
      let changes = [
        {type: '-', line: dh._breakUpLine('1 line')},
        {type: '-', line: dh._breakUpLine('2 hilarious lines')},
        {type: '+', line: dh._breakUpLine('1 funny line')},
        {type: '-', line: dh._breakUpLine('I have not been replaced')},
        {type: '+', line: dh._breakUpLine('2 funny lines')},
        {type: '+', line: dh._breakUpLine('And I have not replaced anyone')}
      ];
      dh._changes = changes.slice(0);

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {removed: changes[0], added: changes[2], commonLengths: {prefix: 2, suffix: 4}},
        {removed: changes[1], added: changes[4], commonLengths: {prefix: 2, suffix: 6}},
        {removed: changes[3]},
        {added: changes[5]}
      ]);
    });

    it('should not include a change in more than one pairs', () => {
      let changes = [
        {type: '-', line: dh._breakUpLine('1 red line')},
        {type: '+', line: dh._breakUpLine('1 green line')},
        {type: '+', line: dh._breakUpLine('1 green line')},
        {type: '-', line: dh._breakUpLine('2 red lines')},
        {type: '-', line: dh._breakUpLine('2 red lines')},
        {type: '+', line: dh._breakUpLine('2 green lines')}
      ];
      dh._changes = changes.slice(0);

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {removed: changes[0], added: changes[1], commonLengths: {prefix: 2, suffix: 5}},
        {removed: changes[3], added: changes[5], commonLengths: {prefix: 2, suffix: 6}},
        {removed: changes[4]},
        {added: changes[2]}
      ]);
    });

    it('should not match changes whose similarity does not exceed a threshold', () => {
      let changes = [
        {type: '-', line: dh._breakUpLine('12223')},
        {type: '+', line: dh._breakUpLine('14443')},
        {type: '-', line: dh._breakUpLine('122223')},
        {type: '+', line: dh._breakUpLine('144443')}
      ];
      dh._changes = changes.slice(0);

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {removed: changes[0], added: changes[1], commonLengths: {prefix: 1, suffix: 1}},
        {removed: changes[2]},
        {added: changes[3]}
      ]);
    });

    it('should ignore leading/trailing whitespace when matching changes', () => {
      let changes = [
        {type: '-', line: dh._breakUpLine('     12223     ')},
        {type: '+', line: dh._breakUpLine('     22222     ')},
        {type: '+', line: dh._breakUpLine('  12423  ')}
      ];
      dh._changes = changes.slice(0);

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {removed: changes[0], added: changes[2], commonLengths: {prefix: 2, suffix: 2}},
        {added: changes[1]}
      ]);
    });

    it('should be able to handle "asymmetric" hunks', () => {
      let changes = [
        {type: '-', line: dh._breakUpLine('1 red line')},
        {type: '-', line: dh._breakUpLine('2 red lines')},
        {type: '-', line: dh._breakUpLine('3 red lines')},
        {type: '+', line: dh._breakUpLine('1 green line')}
      ];
      dh._changes = changes.slice(0);

      let pairs = dh._getPairs();

      expect(pairs).toEqual([
        {removed: changes[0], added: changes[3], commonLengths: {prefix: 2, suffix: 5}},
        {removed: changes[1]},
        {removed: changes[2]}
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

        let changes = [
          {type: '-', line: dh._breakUpLine('1 noob line')},
          {type: '-', line: dh._breakUpLine('1 fine line')},
          {type: '+', line: dh._breakUpLine('1 hilarious line')},
          {type: '+', line: dh._breakUpLine('1 funny line')}
        ];
        dh._changes = changes.slice(0);

        let pairs = dh._getPairs();

        expect(pairs).toEqual([
          {removed: changes[0], added: changes[3], commonLengths: {prefix: 2, suffix: 5}},
          {removed: changes[1], added: changes[2], commonLengths: {prefix: 2, suffix: 5}}
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
    let mockStyles = {
      lineRemoved: str => str && `<red><bold>${str}</bold></red>`,
      lineAdded: str => str && `<green><bold>${str}</bold></green>`,
      areaRemoved: str => str && `<bgRed><white>${str}</white></bgRed>`,
      areaAdded: str => str && `<bgGreen><black>${str}</black></bgGreen>`
    };

    beforeEach(() => dh = new DiffHighlighter(mockStyles));

    it('should add a `highlighted` property (string) to the specified `change`', () => {
      let change1 = {type: '-', line: dh._breakUpLine('Remove this')};
      let change2 = {type: '-', line: dh._breakUpLine('Remove this')};
      let change3 = {type: '-', line: dh._breakUpLine('Remove this')};
      let change4 = {type: '-', line: dh._breakUpLine('Remove this')};

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
      let change1 = {type: '-', line: dh._breakUpLine('Remove this')};
      let change2 = {type: '+', line: dh._breakUpLine('Add that')};

      dh._highlightChange(change1);
      dh._highlightChange(change2);

      expect(change1.highlighted).toContain('-');
      expect(change2.highlighted).toContain('+');
      expect(change1.highlighted).not.toContain('+');
      expect(change2.highlighted).not.toContain('-');
    });

    it('should prepend/append with the leading/trailing whitespace when highlighting', () => {
      let change1 = {type: '-', line: dh._breakUpLine(' Remove this  ')};
      let change2 = {type: '+', line: dh._breakUpLine('   Add that    ')};

      dh._highlightChange(change1);
      dh._highlightChange(change2);

      expect(change1.highlighted).toMatch(/\S\s{1}\S/);
      expect(change1.highlighted).toMatch(/\S\s{2}\S/);
      expect(change2.highlighted).toMatch(/\S\s{3}\S/);
      expect(change2.highlighted).toMatch(/\S\s{4}\S/);
    });

    it('should highlight the leading whitespace as `lineRemoved/Added`', () => {
      let change1 = {type: '-', line: dh._breakUpLine(' please remove this')};
      let change2 = {type: '+', line: dh._breakUpLine('  please add that')};

      dh._highlightChange(change1, 7);
      dh._highlightChange(change2, 7);

      expect(change1.highlighted).toContain('<red><bold>- please </bold></red>');
      expect(change2.highlighted).toContain('<green><bold>+  please </bold></green>');
    });

    it('should highlight the trailing whitespace as `lineRemoved/Added`', () => {
      let change1 = {type: '-', line: dh._breakUpLine('please remove this ')};
      let change2 = {type: '+', line: dh._breakUpLine('please add that  ')};

      dh._highlightChange(change1, null, 5);
      dh._highlightChange(change2, null, 5);

      expect(change1.highlighted).toContain('<red><bold> this </bold></red>');
      expect(change2.highlighted).toContain('<green><bold> that  </bold></green>');
    });

    it('should highlight the prefix as `lineRemoved/Added`', () => {
      let change1 = {type: '-', line: dh._breakUpLine('please remove this')};
      let change2 = {type: '+', line: dh._breakUpLine('please add that')};

      dh._highlightChange(change1, 7);
      dh._highlightChange(change2, 7);

      expect(change1.highlighted).toContain('<red><bold>-please </bold></red>');
      expect(change2.highlighted).toContain('<green><bold>+please </bold></green>');
    });

    it('should highlight the suffix as `lineRemoved/Added`', () => {
      let change1 = {type: '-', line: dh._breakUpLine('please remove this')};
      let change2 = {type: '+', line: dh._breakUpLine('please add that')};

      dh._highlightChange(change1, null, 5);
      dh._highlightChange(change2, null, 5);

      expect(change1.highlighted).toContain('<red><bold> this</bold></red>');
      expect(change2.highlighted).toContain('<green><bold> that</bold></green>');
    });

    it('should highlight the different area as `areaRemoved/Added`', () => {
      let change1 = {type: '-', line: dh._breakUpLine('please remove me')};
      let change2 = {type: '+', line: dh._breakUpLine(' please add me  ')};

      dh._highlightChange(change1, 7, 3);
      dh._highlightChange(change2, 7, 3);

      expect(change1.highlighted).toContain('<bgRed><white>remove</white></bgRed>');
      expect(change2.highlighted).toContain('<bgGreen><black>add</black></bgGreen>');
    });

    it('should highlight the whole line as `areaRemoved/Added` if no prefix and suffix', () => {
      let change1 = {type: '-', line: dh._breakUpLine('please remove this')};
      let change2 = {type: '+', line: dh._breakUpLine(' please add that  ')};

      dh._highlightChange(change1);
      dh._highlightChange(change2);

      expect(change1.highlighted).toBe(
        '<red><bold>-</bold></red>' +
        '<bgRed><white>please remove this</white></bgRed>');
      expect(change2.highlighted).toBe(
        '<green><bold>+</bold></green>' +
        '<bgGreen><black> please add that  </black></bgGreen>');
    });

    it('should merge prefix, suffix and whitespace if the different area is empty', () => {
      let change1 = {type: '-', line: dh._breakUpLine('please remove this')};
      let change2 = {type: '+', line: dh._breakUpLine(' please add that  ')};

      dh._highlightChange(change1, 9, 9);
      dh._highlightChange(change2, 9, 6);

      expect(change1.highlighted).toBe('<red><bold>-please remove this</bold></red>');
      expect(change2.highlighted).toBe('<green><bold>+ please add that  </bold></green>');
    });

    it('should ignore a missing prefix or suffix', () => {
      let change1 = {type: '-', line: dh._breakUpLine('please remove this')};
      let change2 = {type: '+', line: dh._breakUpLine(' please add that  ')};
      let change3 = {type: '-', line: dh._breakUpLine('please remove me')};
      let change4 = {type: '+', line: dh._breakUpLine(' please add me  ')};

      dh._highlightChange(change1, 7);
      dh._highlightChange(change2, 7);
      dh._highlightChange(change3, null, 3);
      dh._highlightChange(change4, null, 3);

      expect(change1.highlighted).toBe(
        '<red><bold>-please </bold></red>' +
        '<bgRed><white>remove this</white></bgRed>');
      expect(change2.highlighted).toBe(
        '<green><bold>+ please </bold></green>' +
        '<bgGreen><black>add that</black></bgGreen>' +
        '<green><bold>  </bold></green>');
      expect(change3.highlighted).toBe(
        '<red><bold>-</bold></red>' +
        '<bgRed><white>please remove</white></bgRed>' +
        '<red><bold> me</bold></red>');
      expect(change4.highlighted).toBe(
        '<green><bold>+ </bold></green>' +
        '<bgGreen><black>please add</black></bgGreen>' +
        '<green><bold> me  </bold></green>');
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
      mockPairs = [{id: 1}, {id: 2}, {id: 3}];

      spyOn(dh, '_getPairs').and.returnValue(mockPairs);
      spyOn(dh, '_highlightPair');
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
      spyOn(dh, '_breakUpLine').and.callFake(rawLine => `<broken-up>${rawLine}</broken-up>`);
      spyOn(dh, '_processChanges');
      spyOn(dh, '_writeLine');
    });

    it('should process the pending changes and print a context line', () => {
      dh._processChanges.and.callFake(() => expect(dh._writeLine).not.toHaveBeenCalled());

      dh._processLine('process me');

      expect(dh._processChanges).toHaveBeenCalled();
      expect(dh._writeLine).toHaveBeenCalledWith('process me');
    });

    it('should break up changed lines with `_breakUpLine()`', () => {
      dh._processLine('- Remove this');
      dh._processLine('- Add that');

      expect(dh._breakUpLine).toHaveBeenCalledTimes(2);
      expect(dh._breakUpLine).toHaveBeenCalledWith(' Remove this');
      expect(dh._breakUpLine).toHaveBeenCalledWith(' Add that');
    });

    it('should record a change for each removed line', () => {
      dh._processLine('- Remove this');

      expect(dh._changes).toEqual([{
        type: '-',
        line: '<broken-up> Remove this</broken-up>',
      }]);
    });

    it('should record a change for each added line', () => {
      dh._processLine('+ Add that');

      expect(dh._changes).toEqual([{
        type: '+',
        line: '<broken-up> Add that</broken-up>',
      }]);
    });

    it('should not confuse header lines with changes', () => {
      spyOn(dh._changes, 'push');

      dh._processLine('--- a/file.ext');
      dh._processLine('+++ b/file.ext');

      expect(dh._writeLine).toHaveBeenCalledTimes(2);
      expect(dh._writeLine).toHaveBeenCalledWith('--- a/file.ext');
      expect(dh._writeLine).toHaveBeenCalledWith('+++ b/file.ext');
      expect(dh._breakUpLine).not.toHaveBeenCalled();
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
});
