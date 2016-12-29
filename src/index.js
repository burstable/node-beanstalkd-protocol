import {CRLF, SPACE, reduce} from './misc';
import {commands, replies, types} from './default';
import assert from 'assert';

export default class BeanstalkdProtocol {
  constructor() {
    this.types = types;
    this.commandMap = {};
    this.replyMap = {};

    commands.forEach((signature) => {
      this.addCommand(signature);
    });

    replies.forEach((signature) => {
      this.addReply(signature);
    });
  }

  addType(key, type) {
    this.types[key] = type;
  }

  add(signature, key) {
    if (signature.substr(-2) !== CRLF.toString()) {
      throw new Error(`${key} ${signature} does not end in CRLF`);
    }

    let parts = signature.split(CRLF.toString()).slice(0, -1).map(part => {
      return part.split(SPACE.toString());
    });

    let identifier = parts[0].shift();

    parts = parts.map(part => {
      return part.map(arg => {
        arg = arg.substr(1, arg.length - 2);

        if (!this.types[arg]) throw new Error(`arg ${arg} does not have a type defined`);
        return arg;
      });
    });

    let args = parts.reduce((args, part) => args.concat(part), []);
    let existing = this[key + 'Map'][identifier];

    if (!existing) {
      this[key + 'Map'][identifier] = {
        args: args,
        parts,
        argsOptional: false
      };
    } else if (existing.args.length !== args.length) {
      existing.argsOptional = true;

      if (!existing.args.length && args.length) {
        existing.args = args;
      }
    }
  }

  parse(buffer, key) {
    if (buffer.length < 4) return [buffer, null];

    let boundary = buffer.indexOf(CRLF);
    if (boundary === -1) return [buffer, null];

    let specMap = this[key + 'Map'];

    if (buffer.indexOf(' ') === -1) {
      let identifier = buffer.slice(0, boundary).toString();

      if (specMap[identifier]) {
        return [null, {
          [key]: identifier,
          args: {}
        }];
      }
    }

    let parts = [buffer.slice(0, boundary).toString().split(SPACE.toString())];
    let identifier = parts[0].shift();
    let spec = specMap[identifier];
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
      [key]: identifier,
      args: convertArgs(spec, args)
    }];
  }

  build(identifier, args, key) {
    let spec = this[key + 'Map'][identifier]
      , isArray = args && Array.isArray(args)
      , expectsArgsLength = spec.args.length
      , argsOptional = spec.argsOptional
      , argsLength = args && (isArray ? args.length : Object.keys(args).length);

    if (!isArray && args) {
      args = spec.args.map(key => args[key]);
    }

    assert(argsOptional || !expectsArgsLength || (args || args.length), `${identifier} requires args`);
    assert(argsOptional || !args || !args.length || expectsArgsLength === argsLength, `${identifier} expects ${spec.args.length} args`);

    if (!args || !argsLength) {
      return new Buffer(identifier + CRLF);
    }

    if (spec.parts.length < 2) {
      return new Buffer(identifier + ' ' + args.join(' ') + CRLF);
    }

    let buffers = [
      new Buffer(identifier + ' '),
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

  addCommand(signature) {
    this.add(signature, 'command');
  }

  parseCommand(buffer) {
    return this.parse(buffer, 'command');
  }

  buildCommand(command, args) {
    return this.build(command, args, 'command');
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

  addReply(signature) {
    this.add(signature, 'reply');
  }

  parseReply(buffer) {
    return this.parse(buffer, 'reply');
  }

  buildReply(reply, args) {
    return this.build(reply, args, 'reply');
  }
}

export function convertArgs(spec, args) {
  return reduce(args, function (args, arg, i) {
    let key = spec.args[i];
    args[key] = types[key](arg);
    return args;
  }, {});
}
