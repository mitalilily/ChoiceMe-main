const isR2Host = (hostname: string) =>
  hostname.includes('cloudflarestorage.com') || /(^|\.)r2(\.|$)/i.test(hostname)

/**
 * Extract an object key from path-style or virtual-hosted S3/R2 URLs.
 *
 * Virtual-hosted R2 URLs already identify the bucket in the hostname, so their
 * complete path is the object key. Path-style URLs include the bucket in the
 * path and must have only that bucket segment removed.
 */
export const extractStorageObjectKey = (url: string, bucket: string): string | null => {
  try {
    const urlObject = new URL(url)
    const pathParts = urlObject.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))

    if (!pathParts.length) return null

    const normalizedBucket = bucket.trim().toLowerCase()
    const bucketIndex = pathParts.findIndex(
      (segment) => segment.toLowerCase() === normalizedBucket,
    )

    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      return pathParts.slice(bucketIndex + 1).join('/')
    }

    if (isR2Host(urlObject.hostname.toLowerCase())) {
      return pathParts.join('/')
    }

    return null
  } catch {
    return null
  }
}
