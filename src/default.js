export const commands = [
  'put <pri> <delay> <ttr> <bytes>\r\n<data>\r\n',
  'use <tube>\r\n',
  'reserve\r\n',
  'reserve-with-timeout <seconds>\r\n',
  'delete <id>\r\n',
  'release <id> <pri> <delay>\r\n',
  'bury <id> <pri>\r\n',
  'touch <id>\r\n',
  'watch <tube>\r\n',
  'ignore <tube>\r\n',
  'peek <id>\r\n',
  'peek-ready\r\n',
  'peek-delayed\r\n',
  'peek-buried\r\n',
  'kick <bound>\r\n',
  'kick-job <id>\r\n',
  'stats-job <id>\r\n',
  'stats-tube <tube>\r\n',
  'stats\r\n',
  'list-tubes\r\n',
  'list-tube-used\r\n',
  'list-tubes-watched\r\n',
  'quit\r\n',
  'pause-tube <tube> <delay>\r\n'
];

export const types = {
  pri: Number,
  delay: Number,
  ttr: Number,
  bytes: Number,
  data: Buffer,
  id: Number,
  tube: String,
  bound: Number,
  seconds: Number
};
