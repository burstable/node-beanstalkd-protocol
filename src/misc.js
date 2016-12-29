export const CRLF = new Buffer([0x0d, 0x0a]);
export const SPACE = new Buffer(' ');

export function reduce(collection, callback, accumulator) {
  if (!collection) return accumulator;

  var index = -1
    , length = collection.length;

  while (++index < length) {
    accumulator = callback(accumulator, collection[index], index, collection);
  }
  return accumulator;
}
