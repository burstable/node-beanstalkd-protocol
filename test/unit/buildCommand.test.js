import BeanstalkdProtocol from '../../src/index';
import {CRLF} from '../../src/misc';
import expect from 'unexpected';

const protocol = new BeanstalkdProtocol();

describe('protocol', function () {
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
});
