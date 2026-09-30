const letters = [
  ["11111","10000","10000","11110","10000","10000","11111"],
  ["00000","00000","11010","10101","10101","10101","10101"],
  ["00100","00000","01100","00100","00100","00100","01110"],
  ["01100","00100","00100","00100","00100","00100","01110"],
  ["00000","00000","10001","10001","01111","00001","01110"]
];
/** Original station lettering rendered as a dot matrix, no external font request. */
export function HostWordmark() {
  return <svg className="host-wordmark" viewBox="0 0 116 28" aria-hidden="true">{letters.flatMap((rows, letter) => rows.flatMap((row, y) => [...row].flatMap((dot, x) => dot === "1" ? [<circle key={`${letter}-${y}-${x}`} cx={2 + letter * 24 + x * 4} cy={2 + y * 4} r=".95" fill="currentColor" />] : [])))}</svg>;
}
