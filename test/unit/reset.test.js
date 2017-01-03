import BeanstalkdProtocol from '../../src/index';
import expect from 'unexpected';

const protocol = new BeanstalkdProtocol();

describe('reset', function () {
  it('removes custom commands', function () {
    protocol.addType('key', String);
    protocol.addCommand('auth <key>\r\n');
    expect(Object.keys(protocol.commandMap), 'to contain', 'auth');

    protocol.reset();
    expect(Object.keys(protocol.commandMap), 'not to contain', 'auth');
    expect(Object.keys(protocol.types), 'not to contain', 'key');
  });

  it('removes custom replies', function () {
    protocol.addReply('NOT_AUTHENTICATED\r\n');
    expect(Object.keys(protocol.replyMap), 'to contain', 'NOT_AUTHENTICATED');

    protocol.reset();
    expect(Object.keys(protocol.replyMap), 'not to contain', 'NOT_AUTHENTICATED');
  });
})
