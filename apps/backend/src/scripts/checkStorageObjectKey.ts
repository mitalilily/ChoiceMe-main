import assert from 'node:assert/strict'
import { extractStorageObjectKey } from '../utils/storageObjectKey'

const bucket = 'choicemee'

const cases = [
  {
    name: 'ChoiceMee virtual-hosted R2 label URL',
    url: 'https://choicemee.account-id.r2.cloudflarestorage.com/labels/user-id/123-label.pdf?X-Amz-Signature=test',
    expected: 'labels/user-id/123-label.pdf',
  },
  {
    name: 'path-style R2 URL',
    url: 'https://account-id.r2.cloudflarestorage.com/choicemee/labels/user-id/123-label.pdf',
    expected: 'labels/user-id/123-label.pdf',
  },
  {
    name: 'R2 public URL',
    url: 'https://pub-id.r2.dev/labels/user-id/123-label.pdf',
    expected: 'labels/user-id/123-label.pdf',
  },
  {
    name: 'unrelated external URL',
    url: 'https://example.com/labels/user-id/123-label.pdf',
    expected: null,
  },
]

for (const testCase of cases) {
  assert.equal(
    extractStorageObjectKey(testCase.url, bucket),
    testCase.expected,
    testCase.name,
  )
}

console.log(`Storage object key checks passed (${cases.length} cases).`)
