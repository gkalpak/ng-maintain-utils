'use strict';

// Imports
let childProcess = require('child_process');
let minimist = require('minimist');

// Variables - Private
let slice = Array.prototype.slice.call.bind(Array.prototype.slice);

// Classes
class Utils {
  // Methods - Protected
  _parseSingleCmd(cmd) {
    let tokens = cmd.
      split('"').
      reduce((arr, str, idx) => {
        let newTokens = (idx % 2) ? [`"${str}"`] : str.split(' ');
        let lastToken = arr[arr.length - 1];

        if (lastToken) arr[arr.length - 1] += newTokens.shift();

        return arr.concat(newTokens);
      }, []).
      filter(Boolean).
      map(token => this._removeSurroundingQuotes(token));

    return {
      executable: tokens.shift(),
      args: tokens
    };
  }

  _removeSurroundingQuotes(value) {
    let match = /^"([^"]*)"$/.exec(value) || /^'([^']*)'$/.exec(value);

    return match ? match[1] : value;
  }

  // Methods - Public
  asPromised(fn, context) {
    doAsPromised.fn = fn;
    doAsPromised.context = context;

    return doAsPromised;

    // Helpers
    function doAsPromised() {
      return new Promise((resolve, reject) => {
        let cb = (err, value) => (err ? reject : resolve)(err || value);
        let args = slice(arguments).concat(cb);

        fn.apply(context, args);
      });
    }
  }

  interpolate(text, data) {
    return text.replace(/{{\s*(\S*?)\s*}}/g, (_, key) => data[key]);
  }

  parseArgs(rawArgs) {
    let opts = {boolean: true};
    let args = minimist(rawArgs, opts);

    Object.keys(args).forEach(key => {
      let value = args[key];

      if (typeof value === 'string') {
        args[key] = this._removeSurroundingQuotes(value);
      } else if (Array.isArray(value)) {
        args[key] = value.map(v => this._removeSurroundingQuotes(v));
      }
    });

    return args;
  }

  resetOutputStyleOnExit(proc) {
    if (!proc) {
      throw Error('No process specified.');
    } else if (proc.$$resetOutputStyleOnExit) {
      console.warn('The process is already set up for output style reset on exit.');
      return;
    }

    const resetStyle = code => {
      proc.stdout.write('\u001b[0m');
      proc.exit(code);
    };

    proc.on('exit', resetStyle);
    proc.on('SIGINT', resetStyle);

    proc.$$resetOutputStyleOnExit = true;
  }

  spawnAsPromised(rawCmd, inputStream, outputStream) {
    return new Promise((resolve, reject) => {
      let pipedCmdSpecs = rawCmd.
        split(/\s+\|\s+/).
        map(cmd => this._parseSingleCmd(cmd));

      let lastStdout = pipedCmdSpecs.reduce((prevStdout, cmdSpec, idx, arr) => {
        let isLast = idx === arr.length - 1;

        let executable = cmdSpec.executable;
        let args = cmdSpec.args;
        let options = {
          stdio: [
            prevStdout ? 'pipe' : 'inherit',
            (isLast && !outputStream) ? 'inherit' : 'pipe',
            'inherit'
          ]
        };

        let proc = childProcess.
          spawn(executable, args, options).
          on('error', reject).
          on('exit', (code, signal) => {
            if (code !== 0) return reject(code || signal);
            if (isLast) return resolve();
          });

        if (prevStdout) prevStdout.pipe(proc.stdin);

        return proc.stdout;
      }, inputStream);

      if (outputStream) lastStdout.pipe(outputStream);
    });
  }

  waitAsPromised(duration) {
    return new Promise(resolve => setTimeout(resolve, duration));
  }
}
Utils.prototype.execAsPromised = Utils.prototype.asPromised(childProcess.exec, childProcess);

// Exports
module.exports = Utils;
