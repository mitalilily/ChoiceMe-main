import multer from 'multer'
import type { RequestHandler } from 'express'

const storage = multer.memoryStorage() // store file in memory

export const MAX_UPLOAD_FILE_SIZE_MB = 64

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024,
  },
})

export const uploadSingleFile = (fieldName = 'file'): RequestHandler => (req, res, next) => {
  upload.single(fieldName)(req, res, (err: unknown) => {
    if (!err) {
      next()
      return
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        message: `File is too large. Maximum upload size is ${MAX_UPLOAD_FILE_SIZE_MB} MB.`,
      })
      return
    }

    res.status(400).json({
      message: err instanceof Error ? err.message : 'Invalid file upload.',
    })
  })
}
