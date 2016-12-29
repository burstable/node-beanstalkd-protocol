import BeanstalkdProtocol, {convertArgs} from '../../src/index';
import {CRLF} from '../../src/misc';
import expect from 'unexpected';

const protocol = new BeanstalkdProtocol();

describe('protocol', function () {
  describe('parseCommand', function () {
    it('immediately returns short buffers', function () {
      let buffer = new Buffer('abc');

      expect(protocol.parseCommand(buffer), 'to equal', [buffer, null]);
    });

    it('immediately returns buffer if no CRLF', function () {
      let buffer = new Buffer('put 1000 0 60');

      expect(protocol.parseCommand(buffer), 'to equal', [buffer, null]);
    });

    it('parses simple stats command', function () {
      let tube = Math.random().toString();
      let buffer = new Buffer('stats\r\n');

      expect(protocol.parseCommand(buffer), 'to equal', [null, {command: 'stats', args: {}}]);
    });

    it('parses simple use command', function () {
      let tube = Math.random().toString();
      let buffer = new Buffer(`use ${tube}\r\n`);

      expect(protocol.parseCommand(buffer), 'to equal', [null, {command: 'use', args: {tube}}]);
    });

    it('parses put command over two buffers', function () {
      let data = new Buffer(JSON.stringify({
        [Math.random().toString()]: Math.random().toString(),
        [Math.random().toString()]: Math.random().toString(),
        [Math.random().toString()]: Math.random().toString()
      }));

      let full = Buffer.concat([
        new Buffer(`put 0 0 60 ${data.length}`),
        CRLF,
        data,
        CRLF
      ]);

      let buffers = [
        full.slice(0, 65),
        full.slice(65)
      ];

      let [remainder, result] = protocol.parseCommand(buffers[0]);
      expect(result, 'to equal', null);
      expect(remainder.length, 'to equal', buffers[0].length);

      expect(
        protocol.parseCommand(Buffer.concat([remainder, buffers[1]])),
        'to equal',
        [null, {
          command: 'put',
          args: {
            pri: 0,
            delay: 0,
            ttr: 60,
            bytes: data.length,
            data: data
          }
        }]
      );
    });

    it('parses multiple commands in buffer', function () {
      let tube = Math.random().toString();
      let buffer = new Buffer(`watch ${tube}\r\nignore default\r\n`);

      let [remainder, result] = protocol.parseCommand(buffer);
      expect(remainder, 'not to equal', null);
      expect(result, 'to equal', {command: 'watch', args: {tube}});

      [remainder, result] = protocol.parseCommand(remainder);
      expect(remainder, 'to equal', null);
      expect(result, 'to equal', {command: 'ignore', args: {tube: 'default'}});
    });

    it('parses custom commands', function () {
      protocol.addType('key', String);
      protocol.addCommand('auth <key>\r\n');

      let key = Math.random().toString();
      let buffer = new Buffer(`auth ${key}\r\n`);

      expect(
        protocol.parseCommand(buffer),
        'to equal',
        [null, {
          command: 'auth',
          args: {
            key
          }
        }]
      );
    });
  });

  describe('buildCommand', function () {
    it('errors for incorrect number of arguments', function () {
      expect(() => protocol.buildCommand('use'), 'to throw');
      expect(() => protocol.buildCommand('use', 'bla', 'bla'), 'to throw');
    });

    it('builds buffer for use command', function () {
      let tube = Math.random().toString();
      let expectation = new Buffer(`use ${tube}\r\n`);

      expect(
        protocol.buildCommand('use', {tube}),
        'to equal',
        expectation
      );

      expect(
        protocol.buildCommand('use', [tube]),
        'to equal',
        expectation
      );
    });

    it('builds buffer for stats command', function () {
      expect(
        protocol.buildCommand('stats'),
        'to equal',
        new Buffer('stats\r\n')
      );
    });

    it('works with parseCommand', function () {
      let tube = Math.random().toString();
      let expectation = new Buffer(`use ${tube}\r\n`);
      let [, parsed] = protocol.parseCommand(expectation);

      expect(
        protocol.buildCommand(parsed.command, parsed.args),
        'to equal',
        expectation
      );
    });

    it('builds buffer for put command', function () {
      let data = new Buffer(JSON.stringify({
        [Math.random().toString()]: Math.random().toString(),
        [Math.random().toString()]: Math.random().toString(),
        [Math.random().toString()]: Math.random().toString()
      }));

      let expectation = Buffer.concat([
        new Buffer(`put 0 0 60 ${data.length}`),
        CRLF,
        data,
        CRLF
      ]);

      expect(
        protocol.buildPut([0, 0, 60, data]),
        'to equal',
        expectation
      );
    });
  });

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

    function generateArgs(command, array = true) {
      let args = protocol.commandMap[command].args;

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

      if (protocol.commandMap[command].body) {
        args.push(generateValue(Buffer));
      }

      return args;
    }

    Object.keys(protocol.commandMap).forEach(function (command) {
      describe(command, function () {
        it('works with array args', function () {
          let args = generateArgs(command);
          let buffer = protocol.buildCommand(command, args);

          expect(protocol.parseCommand(buffer), 'to equal', [
            null,
            {
              command,
              args: convertArgs(protocol.commandMap[command], args)
            }
          ]);
        });

        it('works with object args', function () {
          let args = generateArgs(command, false);
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
          let args = generateArgs(command, false);
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
  });
});
