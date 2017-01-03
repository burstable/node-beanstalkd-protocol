# Beanstalkd protocol parser for Node.js/Javascript

```sh
npm install --save beanstalkd-protocol
```

## Examples

See unit tests

```js
import Protocol from 'beanstalkd-protocol';

```

## API

### protocol.parseCommand(buffer)

Parses a Buffer for a consumer/worker command.

Buffer can be a partial chunk of a stream, the method will return values based on whether or not it has enough information to parse the full command yet.

* **buffer** `Buffer` to parse. Can be a partial chunk of a stream.
* Returns: `[null, {command, args}]` returned if command was the only thing in the chunk
* Returns: `[Buffer, null]` returns passed chunk if no command was found or not enough data was available to fully parse command
* Returns: `[Buffer, {command, args}]` returns remaining part of chunk + found command if chunk is larger than command

### protocol.parseReply(buffer)

Parses a Buffer for a beanstalkd server reply.

Buffer can be a partial chunk of a stream, the method will return values based on whether or not it has enough information to parse the full command yet.

* **buffer** `Buffer` to parse. Can be a partial chunk of a stream.
* Returns: `[null, {reply, args}]` returned if reply was the only thing in the chunk
* Returns: `[Buffer, null]` returns passed chunk if no reply was found or not enough data was available to fully parse reply
* Returns: `[Buffer, {reply, args}]` returns remaining part of chunk + found reply if chunk is larger than reply

#### protocol.reset()

Removes all custom types, commands & replies
