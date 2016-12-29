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

    it('parses two stats replies in a single buffer', function () {
      let buffer = new Buffer(
        'OK 927' +
        '\r\n' +
        '---\ncurrent-jobs-urgent: 202\ncurrent-jobs-ready: 202\ncurrent-jobs-reserved: 0\ncurrent-jobs-delayed: 0\ncurrent-jobs-buried: 0\ncmd-put: 216\ncmd-peek: 15\ncmd-peek-ready: 0\ncmd-peek-delayed: 0\ncmd-peek-buried: 0\ncmd-reserve: 0\ncmd-reserve-with-timeout: 201\ncmd-delete: 14\ncmd-release: 0\ncmd-use: 181\ncmd-watch: 180\ncmd-ignore: 178\ncmd-bury: 0\ncmd-kick: 0\ncmd-touch: 0\ncmd-stats: 85\ncmd-stats-job: 0\ncmd-stats-tube: 0\ncmd-list-tubes: 0\ncmd-list-tube-used: 18\ncmd-list-tubes-watched: 18\ncmd-pause-tube: 0\njob-timeouts: 0\ntotal-jobs: 216\nmax-job-size: 5000000\ncurrent-tubes: 128\ncurrent-connections: 1\ncurrent-producers: 0\ncurrent-workers: 0\ncurrent-waiting: 0\ntotal-connections: 519\npid: 1\nversion: 1.10\nrusage-utime: 0.064000\nrusage-stime: 0.412000\nuptime: 4766\nbinlog-oldest-index: 0\nbinlog-current-index: 0\nbinlog-records-migrated: 0\nbinlog-records-written: 0\nbinlog-max-size: 10485760\nid: eb22a9da2b666fa1hostname: 2656fb9c580b' +
        '\r\n' +
        'OK 927' +
        '\r\n' +
        '---\ncurrent-jobs-urgent: 202\ncurrent-jobs-ready: 202\ncurrent-jobs-reserved: 0\ncurrent-jobs-delayed: 0\ncurrent-jobs-buried: 0\ncmd-put: 216\ncmd-peek: 15\ncmd-peek-ready: 0\ncmd-peek-delayed: 0\ncmd-peek-buried: 0\ncmd-reserve: 0\ncmd-reserve-with-timeout: 201\ncmd-delete: 14\ncmd-release: 0\ncmd-use: 181\ncmd-watch: 180\ncmd-ignore: 178\ncmd-bury: 0\ncmd-kick: 0\ncmd-touch: 0\ncmd-stats: 85\ncmd-stats-job: 0\ncmd-stats-tube: 0\ncmd-list-tubes: 0\ncmd-list-tube-used: 18\ncmd-list-tubes-watched: 18\ncmd-pause-tube: 0\njob-timeouts: 0\ntotal-jobs: 216\nmax-job-size: 5000000\ncurrent-tubes: 128\ncurrent-connections: 1\ncurrent-producers: 0\ncurrent-workers: 0\ncurrent-waiting: 0\ntotal-connections: 519\npid: 1\nversion: 1.10\nrusage-utime: 0.064000\nrusage-stime: 0.412000\nuptime: 4766\nbinlog-oldest-index: 0\nbinlog-current-index: 0\nbinlog-records-migrated: 0\nbinlog-records-written: 0\nbinlog-max-size: 10485760\nid: eb22a9da2b666fa1hostname: 2656fb9c580b' +
        '\r\n'
      );

      let [remainder, result] = protocol.parseReply(buffer);
      expect(remainder, 'not to equal', null);
    });
  });
});
