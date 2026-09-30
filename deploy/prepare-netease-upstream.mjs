// One-time deterministic patch in a fresh dedicated staging directory only.
// Downloaded upstream is not vendored here; retain its MIT LICENSE on the target.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const directory=process.argv[2];
if(!directory)throw new Error('Provide a fresh upstream staging directory.');
const root=resolve(directory);
const expected={
 'package.json':'2d4a440be68f5e0e2ee33f19f30ab7fcff0dfcb08aa710d7eabe6a995e18ecea',
 'module/song_url_v1.js':'379e7e634d42d3953b1973fc04d1ae4243552b6f1250dada93c5b8b5f9b4a40a'
};
const original={};
for(const [name,hash] of Object.entries(expected)){
 const bytes=await readFile(join(root,name));
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('Upstream does not match audited commit 135df9eddab12cc8879f63c090c0ce808040504f.');
 original[name]=bytes.toString('utf8');
}
const pkg=JSON.parse(original['package.json']);
delete pkg.dependencies['@neteasecloudmusicapienhanced/unblockmusic-utils'];
delete pkg.devDependencies;pkg.scripts={};
let song=original['module/song_url_v1.js'];
const requireStart=song.indexOf('  const {\n    matchID,');
const requireEnd=song.indexOf("  require('dotenv').config()",requireStart);
if(requireStart<0||requireEnd<0)throw new Error('Audited import boundary missing.');
song=song.slice(0,requireStart)+song.slice(requireEnd);
const branchStart=song.indexOf("  if (query.unblock === 'true') {");
const branchEnd=song.indexOf("  if (data.level == 'sky')",branchStart);
if(branchStart<0||branchEnd<0)throw new Error('Audited branch boundary missing.');
song=song.slice(0,branchStart)+song.slice(branchEnd);
if(song.includes('matchID')||song.includes('unblockmusic-utils'))throw new Error('Unlock code survived patch.');
await writeFile(join(root,'package.json'),JSON.stringify(pkg,null,2));
await writeFile(join(root,'module/song_url_v1.js'),song);
await unlink(join(root,'module/song_url_match.js'));
await writeFile(join(root,'EMILY-AUDIT.txt'),'Upstream 135df9eddab12cc8879f63c090c0ce808040504f (4.40.1). Local patch removes unblock dependency and song_url_v1 unlock branch. Only Emily private bridge is used; no upstream server/cache/public routes. Preserve MIT LICENSE. npm install --omit=dev --ignore-scripts generates an operator-retained lock; do not update it implicitly.\n');
console.log('Audited upstream unlock dependency and branches removed.');
