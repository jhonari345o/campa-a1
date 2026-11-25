export async function boundedJson(request:Request,maxBodyBytes:number):Promise<unknown>{
  if(Number(request.headers.get("content-length"))>maxBodyBytes)throw new Error("SIZE");
  const reader=request.body?.getReader();
  if(!reader)throw new Error("BODY");
  const chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBodyBytes){await reader.cancel();throw new Error("SIZE");}chunks.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
