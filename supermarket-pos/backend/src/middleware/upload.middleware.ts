import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { RequestHandler } from 'express';
import { ValidationError } from '../utils/errors';

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const extensions: Record<string,string> = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
export function hasImageSignature(data:Buffer,mime:string) {
  if(mime==='image/png') return data.length>=8 && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='image/jpeg') return data.length>=3 && data[0]===255 && data[1]===216 && data[2]===255;
  if(mime==='image/webp') return data.length>=12 && data.subarray(0,4).toString()==='RIFF' && data.subarray(8,12).toString()==='WEBP';
  return false;
}
const receive=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:5,parts:6}}).single('image');
export const uploadProductImage:RequestHandler=(req,res,next)=>receive(req,res,error=>{
  if(error)return next(new ValidationError('Upload one JPEG, PNG or WebP image, up to 5 MB'));
  const file=req.file;
  if(!file)return next(new ValidationError('An image is required'));
  const extension=extensions[file.mimetype];
  if(!extension||!hasImageSignature(file.buffer,file.mimetype))return next(new ValidationError('The uploaded data is not a supported image'));
  // Never preserve an untrusted filename extension on the same-origin asset server.
  file.filename=crypto.randomUUID()+extension;
  file.path=path.join(UPLOAD_DIR,file.filename);
  fs.writeFile(file.path,file.buffer,{mode:0o600},err=>err?next(err):next());
});
