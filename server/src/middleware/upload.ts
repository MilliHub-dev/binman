import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../services/storage.service';

/**
 * Files are buffered in memory and handed to the storage service, which owns
 * validation and persistence. Nothing is written to disk by multer itself.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 5,
  },
});

export const uploadProofPhotos = upload.array('photos', 5);
export const uploadSingleImage = upload.single('image');
