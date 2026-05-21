import axios from "axios";
import axiosInstance from "./axiosInstance";

export type UploadStrategy = "auto" | "direct" | "proxy";

let directUploadUnavailable = false;

export const getPresignedDownloadUrls = async (keys: string | string[]) => {
  const response = await axiosInstance.post("/uploads/presign-download-url", {
    keys,
  });

  if (Array.isArray(keys)) {
    return response.data.urls as string[];
  } else {
    return response.data.url as string;
  }
};

export const uploadFileToStorage = async ({
  file,
  folderKey,
  onUploadProgress,
  uploadStrategy = "auto",
}: {
  file: File;
  folderKey?: string;
  onUploadProgress?: (progress: number) => void;
  uploadStrategy?: UploadStrategy;
}) => {
  const contentType = resolveFileContentType(file);
  const shouldTryDirectUpload =
    uploadStrategy !== "proxy" && (uploadStrategy === "direct" || !directUploadUnavailable);

  if (shouldTryDirectUpload) {
    try {
      const { data } = await axiosInstance.post("/uploads/presign", {
        filename: file.name,
        contentType,
        folder: folderKey,
      });

      if (!data?.uploadUrl || !data?.key) {
        throw new Error("Invalid upload URL response");
      }

      await axios.put(data.uploadUrl, file, {
        headers: { "Content-Type": contentType },
        withCredentials: false,
        timeout: 120000,
        onUploadProgress: (event) => {
          if (event.total && onUploadProgress) {
            onUploadProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      });

      return data as { publicUrl: string; key: string; bucket: string };
    } catch (directUploadError) {
      if (uploadStrategy === "direct") {
        throw directUploadError;
      }

      directUploadUnavailable = true;
      // Fall back to the API proxy for environments where bucket CORS is not configured yet.
      console.warn("Direct storage upload failed, falling back to API upload.", directUploadError);
    }
  }

  const formData = new FormData();
  formData.append("file", file, file.name);
  if (folderKey) {
    formData.append("folder", folderKey);
  }

  const response = await axiosInstance.post("/uploads/file", formData, {
    timeout: 120000,
    onUploadProgress: (event) => {
      if (event.total && onUploadProgress) {
        onUploadProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  });

  return response.data as { publicUrl: string; key: string; bucket: string };
};

const resolveFileContentType = (file: File) => {
  if (file.type) return file.type;

  const extension = file.name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
};
