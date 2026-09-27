import sharp from 'sharp';import fs from 'node:fs';import path from 'node:path';
const root=process.cwd();const input=process.argv[2];if(!input)throw Error('Supply input image folder');
const out=path.join(root,'apps/web/public/images');fs.mkdirSync(out,{recursive:true});
for(let i=1;i<=3;i++)await sharp(path.join(input,`home-${i}.jpg`)).resize({width:1600,withoutEnlargement:true}).webp({quality:82}).toFile(path.join(out,`home-${i}.webp`));
console.log('Three optimized website images ready.');
