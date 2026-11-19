import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import sharp from "sharp";

const root=process.cwd(),assets=path.join(root,"public"),out=path.join(assets,"providers/optimized");
await mkdir(out,{recursive:true});
const entries={};let before=0,after=0;
for(const folder of ["providers/radio","providers/tv","providers/catomedia"]){
  for(const file of (await readdir(path.join(assets,folder),{recursive:true})).sort()){
    if(!/\.(png|jpe?g|webp|svg)$/i.test(file)||folder!=="providers/tv"&&!/logo\.(png|jpe?g|webp|svg)$/i.test(file))continue;
    const source=await readFile(path.join(assets,folder,file));
    const bytes=await sharp(source).rotate().resize({width:320,height:320,fit:"inside",withoutEnlargement:true}).webp({quality:80,effort:5}).toBuffer();
    const hash=createHash("sha256").update(bytes).digest("hex").slice(0,16);
    await writeFile(path.join(out,`${hash}.webp`),bytes);
    entries[`/${folder}/${file.split(path.sep).join("/")}`]=`/providers/optimized/${hash}.webp`;
    before+=source.length;after+=bytes.length;
  }
}
await writeFile(path.join(root,"lib/catalog-logo-assets.json"),JSON.stringify(entries,null,2)+"\n");
console.log(JSON.stringify({logos:Object.keys(entries).length,before,after}));
