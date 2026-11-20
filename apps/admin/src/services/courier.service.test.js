import api from './axios'
import { updateShadowfaxCredentials } from './courier.service'

jest.mock('./axios', () => ({ put: jest.fn() }))

test('Shadowfax card sends only the production token to its authenticated endpoint', async () => {
  api.put.mockResolvedValueOnce({ data: { success: true, data: { hasApiToken: true } } })
  await expect(updateShadowfaxCredentials('test-production-token-12345')).resolves.toEqual({ hasApiToken: true })
  expect(api.put).toHaveBeenCalledWith('/admin/couriers/credentials/shadowfax', { productionToken: 'test-production-token-12345' })
})

test('credential failures discard request configuration and token-bearing errors', async () => {
  api.put.mockRejectedValueOnce({ message: 'sensitive request', config: { data: 'secret-token' } })
  try {
    await updateShadowfaxCredentials('test-production-token-12345')
    throw new Error('Expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect(error.config).toBeUndefined()
    expect(error.message).not.toContain('secret-token')
    expect(error.message).not.toContain('sensitive request')
  }
})
