import {CRLF, SPACE, reduce} from './misc';
import {commands, types} from './default';
import assert from 'assert';

export default class BeanstalkdProtocol {
  constructor() {
    this.types = types;
    this.commandMap = {};

    commands.forEach((signature) => {
      this.addCommand(signature);
    });
  }

  addType(key, type) {
    this.types[key] = type;
  }

  addCommand(signature) {
    if (signature.substr(-2) !== CRLF.toString()) {
      throw new Error(`command ${signature} does not end in CRLF`);
    }

    let parts = signature.split(CRLF.toString()).slice(0, -1).map(part => {
      return part.split(SPACE.toString());
    });

    let command = parts[0].shift();

    parts = parts.map(part => {
      return part.map(arg => {
        arg = arg.substr(1, arg.length - 2);

        if (!this.types[arg]) throw new Error(`arg ${arg} does not have a type defined`);
        return arg;
      });
    });

    this.commandMap[command] = {
      args: parts.reduce((args, part) => args.concat(part), []),
      parts
    };
  }

  parseCommand(buffer) {
    if (buffer.length < 4) return [buffer, null];

    let boundary = buffer.indexOf(CRLF);
    if (boundary === -1) return [buffer, null];

    if (buffer.indexOf(' ') === -1) {
      let command = buffer.slice(0, boundary).toString();

      if (this.commandMap[command]) {
        return [null, {
          command,
          args: {}
        }];
      }
    }

    let parts = [buffer.slice(0, boundary).toString().split(SPACE.toString())];
    let command = parts[0].shift();
    let spec = this.commandMap[command];
    let remainder = buffer.length > boundary + CRLF.length ? buffer.slice(boundary + CRLF.length) : null;
    let args;

    if (spec.parts.length > 1) {
      for (let i = 0; i < (spec.parts.length - 1); i++) {
        if (!remainder) return [buffer, null];

        let boundary = remainder.indexOf(CRLF);
        if (boundary === -1) return [buffer, null];

        // TODO: Support non buffer args
        parts.push(remainder.slice(0, boundary));
        remainder = remainder.length > boundary + CRLF.length ? buffer.slice(remainder + CRLF.length) : null;
      }

      args = Array.prototype.concat.apply([], parts);
    } else {
      args = parts[0];
    }

    return [remainder, {
      command,
      args: convertArgs(spec, args)
    }];
  }

  buildCommand(command, args) {
    let spec = this.commandMap[command]
      , isArray = args && Array.isArray(args)
      , expectsArgsLength = spec.args.length
      , argsLength = args && (isArray ? args.length : Object.keys(args).length);

    assert(!expectsArgsLength || args, `${command} requires args`);
    assert(!args || expectsArgsLength === argsLength, `${command} expects ${spec.args.length} args`);

    if (!args || !argsLength) {
      return new Buffer(command + CRLF);
    }

    if (!isArray) {
      args = spec.args.map(key => args[key]);
    }

    if (spec.parts.length < 2) {
      return new Buffer(command + ' ' + args.join(' ') + CRLF);
    }

    let buffers = [
      new Buffer(command + ' '),
    ];

    let offset = 0;
    spec.parts.forEach(function (part) {
      let partArgs = args.slice(offset, offset + part.length);
      offset += part.length;

      partArgs.forEach(function (arg, i) {
        if (i) {
          buffers.push(SPACE);
        }

        if (Buffer.isBuffer(arg)) {
          buffers.push(arg);
        } else {
          buffers.push(new Buffer(arg.toString()));
        }
      });
      buffers.push(CRLF);
    });

    return Buffer.concat(buffers);
  }

  buildPut(args) {
    let isArray = Array.isArray(args);
    if (!isArray) {
      let spec = this.commandMap['put'];
      args = spec.args.map(key => args[key]);
    }

    let body = args.pop();
    args.push(body.length);
    args.push(body);

    return this.buildCommand('put', args);
  }
}

export function convertArgs(spec, args) {
  return reduce(args, function (args, arg, i) {
    let key = spec.args[i];
    args[key] = types[key](arg);
    return args;
  }, {});
}
