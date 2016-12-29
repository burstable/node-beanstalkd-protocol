import BeanstalkdProtocol from '../../src/index';
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
});
