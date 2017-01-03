import BeanstalkdProtocol, {convertArgs} from '../../src/index';
import {CRLF} from '../../src/misc';
import expect from 'unexpected';

const protocol = new BeanstalkdProtocol();

describe('protocol', function () {
  describe('fuzzy', function () {
    function generateValue(type) {
      if (type === Number) {
        return Math.floor(Math.random() * 999);
      }
      if (type === String) {
        let text = "";
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (let i = 0; i < 15; i++) {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
      }
      if (type === Buffer) {
        return new Buffer(JSON.stringify({
          [Math.random().toString()]: Math.random().toString(),
          [Math.random().toString()]: Math.random().toString(),
          [Math.random().toString()]: Math.random().toString()
        }));
      }

      throw new Error('Cant for ' + type)
    }

    function generateArgs(spec, array = true) {
      let args = spec.args;

      args = args.reduce(function (collection, arg) {
        let type = protocol.types[arg];
        let value = generateValue(type);

        if (array) {
          collection.push(value);
          return collection;
        }
        collection[arg] = value;
        return collection;
      }, array ? [] : {});

      if (spec.args.indexOf('bytes') !== -1) {
        if (array) {
          args[spec.args.indexOf('bytes')] = args[spec.args.indexOf('data')].length;
        } else {
          args.bytes = args.data.length;
        }
      }

      return args;
    }

    Object.keys(protocol.commandMap).forEach(function (command) {
      describe(command, function () {
        it('works with array args', function () {
          let args = generateArgs(protocol.commandMap[command]);
          let buffer = protocol.buildCommand(command, args);

          expect(protocol.parseCommand(buffer), 'to equal', [
            null,
            {
              command,
              args: convertArgs(protocol.commandMap[command], args, protocol.types)
            }
          ]);
        });

        it('works with object args', function () {
          let args = generateArgs(protocol.commandMap[command], false);
          let buffer = protocol.buildCommand(command, args);

          expect(protocol.parseCommand(buffer), 'to equal', [
            null,
            {
              command,
              args
            }
          ]);
        });

        it('works split in half', function () {
          let args = generateArgs(protocol.commandMap[command], false);
          let buffer = protocol.buildCommand(command, args);
          let parts = [
            buffer.slice(0, Math.floor(buffer.length / 2)),
            buffer.slice(Math.floor(buffer.length / 2))
          ];

          expect(protocol.parseCommand(parts[0]), 'to equal', [
            parts[0],
            null
          ]);

          expect(protocol.parseCommand(Buffer.concat(parts)), 'to equal', [
            null,
            {
              command,
              args
            }
          ]);
        });
      });
    });

    Object.keys(protocol.replyMap).forEach(function (reply) {
      describe(reply, function () {
        it('works with array args', function () {
          let args = generateArgs(protocol.replyMap[reply]);
          let buffer = protocol.buildReply(reply, args);

          expect(protocol.parseReply(buffer), 'to equal', [
            null,
            {
              reply,
              args: convertArgs(protocol.replyMap[reply], args, protocol.types)
            }
          ]);
        });

        it('works with object args', function () {
          let args = generateArgs(protocol.replyMap[reply], false);
          let buffer = protocol.buildReply(reply, args);

          expect(protocol.parseReply(buffer), 'to equal', [
            null,
            {
              reply,
              args
            }
          ]);
        });

        it('works split in half', function () {
          let args = generateArgs(protocol.replyMap[reply], false);
          let buffer = protocol.buildReply(reply, args);
          let parts = [
            buffer.slice(0, Math.floor(buffer.length / 2)),
            buffer.slice(Math.floor(buffer.length / 2))
          ];

          expect(protocol.parseReply(parts[0]), 'to equal', [
            parts[0],
            null
          ]);

          expect(protocol.parseReply(Buffer.concat(parts)), 'to equal', [
            null,
            {
              reply,
              args
            }
          ]);
        });
      });
    });
  });
});
