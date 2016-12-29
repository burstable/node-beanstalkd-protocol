import BeanstalkdProtocol from '../../src/index';
import {CRLF} from '../../src/misc';
import expect from 'unexpected';

const protocol = new BeanstalkdProtocol();

describe('protocol', function () {
  describe('parseReply', function () {
    it('immediately returns short buffers', function () {
      let buffer = new Buffer('abc');

      expect(protocol.parseReply(buffer), 'to equal', [buffer, null]);
    });

    it('immediately returns buffer if no CRLF', function () {
      let buffer = new Buffer('put 1000 0 60');

      expect(protocol.parseReply(buffer), 'to equal', [buffer, null]);
    });

    it('parses simple DELETED reply', function () {
      let tube = Math.random().toString();
      let buffer = new Buffer('DELETED\r\n');

      expect(protocol.parseReply(buffer), 'to equal', [null, {reply: 'DELETED', args: {}}]);
    });

    it('parses simple USING reply', function () {
      let tube = Math.random().toString();
      let buffer = new Buffer(`USING ${tube}\r\n`);

      expect(protocol.parseReply(buffer), 'to equal', [null, {reply: 'USING', args: {tube}}]);
    });

    it('parses both versions of KICKED', function () {
      let count = Math.ceil(Math.random() * 9);

      expect(protocol.parseReply(new Buffer('KICKED\r\n')), 'to equal', [null, {reply: 'KICKED', args: {}}]);
      expect(protocol.parseReply(new Buffer(`KICKED ${count}\r\n`)), 'to equal', [null, {reply: 'KICKED', args: {count}}]);
    });

    it('parses unknown ERROR', function () {
      expect(protocol.parseReply(new Buffer('UNKNOWN_ERROR\r\n')), 'to equal', [null, {reply: 'UNKNOWN_ERROR', args: {}, unknown: true}]);
    });

    it('parses RESERVED reply over two buffers', function () {
      let data = new Buffer(JSON.stringify({
        [Math.random().toString()]: Math.random().toString(),
        [Math.random().toString()]: Math.random().toString(),
        [Math.random().toString()]: Math.random().toString()
      }));

      let full = Buffer.concat([
        new Buffer(`RESERVED 1337 ${data.length}`),
        CRLF,
        data,
        CRLF
      ]);

      let buffers = [
        full.slice(0, 65),
        full.slice(65)
      ];

      let [remainder, result] = protocol.parseReply(buffers[0]);
      expect(result, 'to equal', null);
      expect(remainder.length, 'to equal', buffers[0].length);

      expect(
        protocol.parseReply(Buffer.concat([remainder, buffers[1]])),
        'to equal',
        [null, {
          reply: 'RESERVED',
          args: {
            id: 1337,
            bytes: data.length,
            data: data
          }
        }]
      );
    });

    it('parses large RESERVED reply', function () {
      let values = {};
      for (let i = 0; i < 10000; i++) {
        values[Math.random().toString()] = Math.random().toString();
      }

      let data = new Buffer(JSON.stringify(values));

      let full = Buffer.concat([
        new Buffer(`RESERVED 1337 ${data.length}`),
        CRLF,
        data,
        CRLF
      ]);

      let buffer = new Buffer(0);
      for (let i = 0; i < full.length; i += 65536) {
        let piece = full.slice(i, i + 65536);

        if (piece.length === 65536) {
          let [remainder, result] = protocol.parseReply(Buffer.concat([buffer, piece]));
          expect(result, 'to equal', null);
          buffer = remainder;
        } else {
          buffer = Buffer.concat([buffer, piece]);
        }
        }

      expect(
        protocol.parseReply(buffer),
        'to equal',
        [null, {
          reply: 'RESERVED',
          args: {
            id: 1337,
            bytes: data.length,
            data: data
          }
        }]
      );
    });

    it('parses RESERVED reply containg CRLF', function () {
      let data = new Buffer('yolo\r\nyolo');
      let buffer = Buffer.concat([
        new Buffer(`RESERVED 1234 ${data.length}`),
        CRLF,
        data,
        CRLF
      ]);

      expect(
        protocol.parseReply(buffer),
        'to equal',
        [null, {
          reply: 'RESERVED',
          args: {
            id: 1234,
            bytes: data.length,
            data: data
          }
        }]
      );
    });

    it('parses multiple replies in buffer', function () {
      let tube = Math.random().toString();
      let buffer = new Buffer(`USING ${tube}\r\nKICKED 2\r\n`);

      let [remainder, result] = protocol.parseReply(buffer);
      expect(remainder, 'not to equal', null);
      expect(result, 'to equal', {reply: 'USING', args: {tube}});

      [remainder, result] = protocol.parseReply(remainder);
      expect(remainder, 'to equal', null);
      expect(result, 'to equal', {reply: 'KICKED', args: {count: 2}});
    });

    it('parses custom replies', function () {
      protocol.addReply('NOT_AUTHENTICATED\r\n');

      let buffer = new Buffer(`NOT_AUTHENTICATED\r\n`);

      expect(
        protocol.parseReply(buffer),
        'to equal',
        [null, {
          reply: 'NOT_AUTHENTICATED',
          args: {}
        }]
      );
    });
  });
});
