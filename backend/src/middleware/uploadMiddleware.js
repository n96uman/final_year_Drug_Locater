const fs = require('fs'); const path = require('path'); const multer = require('multer'); const dir=path.join(process.cwd(),'uploads'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
const storage = multer.diskStorage({ destination:(_r,_f,cb)=>cb(null,dir), filename:(_r,f,cb)=>cb(null,`profile-${Date.now()}-${f.originalname}`) })
exports.uploadProfileImage = multer({storage,limits:{fileSize:3*1024*1024},fileFilter:(_r,f,cb)=>cb(null,(f.mimetype||'').startsWith('image/'))})
