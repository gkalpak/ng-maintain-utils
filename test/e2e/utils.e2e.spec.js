'use strict';

// Imports
let stream = require('stream');

let PassThrough = stream.PassThrough;

// Imports - Local
let Utils = require('../../lib/utils');

// Tests
describe('Utils', () => {
  let utils;

  beforeEach(() => {
    utils = new Utils();
  });

  describe('#spawnAsPromised()', () => {
    let nodeExecutable = process.execPath;
    let nodeCatProgram =
        'var data = \'\'; ' +
        'process.stdin.on(\'data\', d => data += d); ' +
        'process.stdin.on(\'end\', () => { ' +
          'console.log(data); ' +
          'process.exit(0); ' +
        '});';
    let nodeCatCommand = `"${nodeExecutable}" -e "${nodeCatProgram}"`;
    let nodeNoopCommand = `"${nodeExecutable}" -e "process.exit(process.argv[1])"`;

    it('should resolve if the spawned process exits normally', done => {
      let command = `${nodeNoopCommand} 0`;
      let response = runCommand(command);

      response.promise.then(done);
    });

    it('should reject if the spawned process exits with an error', done => {
      let command = `${nodeNoopCommand} 42`;
      let response = runCommand(command);

      response.promise.
        catch(exitCode => {
          expect(exitCode).toBe(42);

          done();
        });
    });

    it('should support piping from stdout', done => {
      let command = 'echo "Hello, world!"';
      let response = runCommand(command);

      response.promise.
        then(() => expect(response.stdout.trim()).toBe('"Hello, world!"')).
        then(done);
    });

    it('should support piping to stdin', done => {
      let command = nodeCatCommand;
      let response = runCommand(command);

      response.promise.
        then(() => expect(response.stdout.trim()).toBe('Hello, world!')).
        then(done);

      response.inputStream.end('Hello, world!');
    });

    it('should support command piping', done => {
      let command1 = `echo "Hello, world!" | ${nodeCatCommand} | ${nodeCatCommand}`;
      let response1 = runCommand(command1);

      let command2 = `echo "Hello, world!" | ${nodeCatCommand} | ${nodeNoopCommand}`;
      let response2 = runCommand(command2);

      Promise.
        all([
          response1.promise.then(() => expect(response1.stdout.trim()).toBe('"Hello, world!"')),
          response2.promise.then(() => expect(response2.stdout.trim()).toBe(''))
        ]).
        then(done);
    });

    // Helpers
    function runCommand(command) {
      let inputStream = new PassThrough();
      let outputStream = new PassThrough();

      outputStream.on('data', data => response.stdout += data);

      let response = {
        inputStream,
        outputStream,
        stdout: '',
        promise: utils.spawnAsPromised(command, inputStream, outputStream)
      };

      return response;
    }
  });
});
