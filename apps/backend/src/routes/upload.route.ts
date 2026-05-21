import { Router } from "express";
import {
  createPresignedUrl,
  getPresignedDownloadUrl,
  uploadFile,
} from "../controllers/upload.controller";
import { uploadSingleFile } from "../middlewares/upload";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/presign", requireAuth, createPresignedUrl);
router.post("/file", requireAuth, uploadSingleFile("file"), uploadFile);
router.post("/presign-download-url", requireAuth, getPresignedDownloadUrl);

export default router;
