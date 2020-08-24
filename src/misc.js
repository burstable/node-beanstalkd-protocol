export const CRLF  = Buffer.from([0x0d, 0x0a]);  // '\r\n'
export const SPACE = Buffer.from([0x20]);        // ' '

export function reduce(collection, callback, accumulator) {
  if (!collection) return accumulator;

  var index = -1
    , length = collection.length;

  while (++index < length) {
    accumulator = callback(accumulator, collection[index], index, collection);
  }
  return accumulator;
}
