import BeanstalkdProtocol from '../../src/index';
import {CRLF} from '../../src/misc';
import expect from 'unexpected';

const protocol = new BeanstalkdProtocol();

describe('protocol', function () {
  describe('buildReply', function () {
    it('errors for incorrect number of arguments', function () {
      expect(() => protocol.buildReply('USING'), 'to throw');
      expect(() => protocol.buildReply('USING', 'bla', 'bla'), 'to throw');
    });

    it('builds buffer for USING reply', function () {
      let tube = Math.random().toString();
      let expectation = new Buffer(`USING ${tube}\r\n`);

      expect(
        protocol.buildReply('USING', {tube}),
        'to equal',
        expectation
      );

      expect(
        protocol.buildReply('USING', [tube]),
        'to equal',
        expectation
      );
    });

    it('builds buffer for PAUSED reply', function () {
      expect(
        protocol.buildReply('PAUSED'),
        'to equal',
        new Buffer('PAUSED\r\n')
      );
    });

    it('works with parseReply', function () {
      let tube = Math.random().toString();
      let expectation = new Buffer(`USING ${tube}\r\n`);
      let [, parsed] = protocol.parseReply(expectation);

      expect(
        protocol.buildReply(parsed.reply, parsed.args),
        'to equal',
        expectation
      );
    });

    it('builds both versions of KICKED', function () {
      let count = Math.ceil(Math.random() * 9);

      expect(protocol.buildReply('KICKED'), 'to equal', new Buffer('KICKED\r\n'));
      expect(protocol.buildReply('KICKED', [count]), 'to equal', new Buffer(`KICKED ${count}\r\n`));
    });
  });
});
