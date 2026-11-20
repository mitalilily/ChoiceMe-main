import React from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToStaticMarkup } from 'react-dom/server.node'
import CourierCredentials from './CourierCredentials'

jest.mock('hooks/useCouriers', () => ({
  useCourierCredentials: () => ({ data: { shadowfax: { hasApiToken: true, environment: 'production' } } }),
  useUpdateDeliveryOneCredentials: () => ({ mutate: jest.fn() }),
  useUpdateShadowfaxCredentials: () => ({ mutate: jest.fn(), reset: jest.fn() }),
}))

test('Shadowfax credential card asks only for a blank production token', () => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<ChakraProvider><CourierCredentials /></ChakraProvider>)
  const token = host.querySelector('#shadowfax-production-token')
  expect(token).not.toBeNull()
  expect(token.type).toBe('password')
  expect(token.value).toBe('')
  const card = token.closest('.chakra-stack').parentElement
  expect(card.querySelectorAll('input').length).toBe(1)
  expect(card.textContent).toContain('Production token saved')
  expect(card.textContent).toContain('shipment booking remains disabled')
  expect(card.querySelector('button').disabled).toBe(true)
})
