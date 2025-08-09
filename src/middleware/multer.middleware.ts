import multer from 'multer'
import fs from "fs";


const path = "./public/tmp";

if (!fs.existsSync(path)) {
    console.log(path, "does not exist, creating it now");
  fs.mkdirSync(path, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const extension = file.originalname.substring(file.originalname.lastIndexOf('.'));
        cb(null, file.fieldname + '-' + uniqueSuffix + extension)
        // cb(null, file.originalname)
    }
})

export const upload = multer({ storage: storage })
