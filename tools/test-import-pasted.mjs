// tools/test-import-pasted.mjs
// Ejecuta el script en un sandbox para obtener PASTED_DATA con \t ya interpretados
import { readFileSync } from 'fs';
import vm from 'vm';

const src = readFileSync('tools/import-pasted.js', 'utf-8');
// Extraemos solo la declaracion de PASTED_DATA y la evaluamos
const declMatch = src.match(/const PASTED_DATA = `([\s\S]*?)`;/);
if (!declMatch) {
  console.error('No encontre PASTED_DATA');
  process.exit(1);
}
const expr = declMatch[0].replace('const ', '').replace(/;$/, '');
const pasted = vm.runInNewContext('(' + expr + ')');

function pastedToRows(text) {
  return text.split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cleaned = line.startsWith('\t') ? line.slice(1) : line;
      const cols = cleaned.split('\t');
      while (cols.length < 8) cols.push('');
      cols.unshift('', '');
      return cols;
    });
}

const { parseSheet } = await import('./parser.js');
const data = parseSheet(pastedToRows(pasted));

console.log('Jugadores: ', data.players.length);
console.log('Pagos:     ', data.payments.length);
console.log('Categorias:', data.categories.length);
console.log('Skipped:   ', data.skipped.length);
if (data.skipped.length) console.log(data.skipped);

