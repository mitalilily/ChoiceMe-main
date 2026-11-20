import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Spinner,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useCourierCredentials, useUpdateDeliveryOneCredentials, useUpdateShadowfaxCredentials } from 'hooks/useCouriers'

const CourierCredentials = () => {
  const toast = useToast()
  const { data, isLoading, error } = useCourierCredentials()
  const updateDeliveryOne = useUpdateDeliveryOneCredentials()
  const updateShadowfax = useUpdateShadowfaxCredentials()
  const [shadowfaxToken, setShadowfaxToken] = useState('')

  const handleSaveShadowfax = () => {
    const token = shadowfaxToken.trim()
    if (!token) return
    updateShadowfax.mutate(token, {
      onSuccess: () => {
        setShadowfaxToken('')
        updateShadowfax.reset()
        toast({ title: 'Shadowfax production token saved', status: 'success' })
      },
      onError: () => {
        setShadowfaxToken('')
        updateShadowfax.reset()
        toast({ title: 'Could not save Shadowfax token', description: 'Check the production token and try again.', status: 'error' })
      },
    })
  }

  const [deliveryOneForm, setDeliveryOneForm] = useState({
    apiBase: '',
    clientId: '',
    username: '',
    password: '',
    apiKey: '',
    webhookSecret: '',
  })

  useEffect(() => {
    if (data?.deliveryOne) {
      setDeliveryOneForm({
        apiBase: data.deliveryOne.apiBase || '',
        clientId: data.deliveryOne.clientId || '',
        username: data.deliveryOne.username || '',
        password: '',
        apiKey: '',
        webhookSecret: '',
      })
    }
  }, [data])

  const handleSaveDeliveryOne = () => {
    updateDeliveryOne.mutate(
      {
        apiBase: deliveryOneForm.apiBase,
        clientId: deliveryOneForm.clientId,
        username: deliveryOneForm.username,
        ...(deliveryOneForm.password ? { password: deliveryOneForm.password } : {}),
        ...(deliveryOneForm.apiKey ? { apiKey: deliveryOneForm.apiKey } : {}),
        ...(deliveryOneForm.webhookSecret
          ? { webhookSecret: deliveryOneForm.webhookSecret }
          : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Delhivery credentials updated', status: 'success' })
          setDeliveryOneForm((prev) => ({
            ...prev,
            password: '',
            apiKey: '',
            webhookSecret: '',
          }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Delhivery credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  if (isLoading) return <Spinner size="md" />
  if (error) return <Text color="red.500">Failed to load courier credentials</Text>

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={4}>
      <Text fontSize="xl" fontWeight="bold">
        Courier Credentials
      </Text>

      <Flex gap={4} flexWrap="wrap">
        <Box borderWidth="1px" borderRadius="lg" p={5} minW={{ base: 0, md: '320px' }} w="100%" flex="1" maxW="520px">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Delhivery</Text>
              <Badge colorScheme={data?.deliveryOne?.hasApiKey ? 'green' : 'orange'}>
                {data?.deliveryOne?.hasApiKey ? 'API key set' : 'Missing API key'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={deliveryOneForm.apiBase}
                onChange={(e) =>
                  setDeliveryOneForm((prev) => ({ ...prev, apiBase: e.target.value }))
                }
                placeholder="https://track.delhivery.com"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Client ID</FormLabel>
              <Input
                value={deliveryOneForm.clientId}
                onChange={(e) =>
                  setDeliveryOneForm((prev) => ({ ...prev, clientId: e.target.value }))
                }
                placeholder="Delhivery client ID"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Username / Email</FormLabel>
              <Input
                value={deliveryOneForm.username}
                onChange={(e) =>
                  setDeliveryOneForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="Delhivery username or email"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={deliveryOneForm.password}
                onChange={(e) =>
                  setDeliveryOneForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Leave blank to keep existing password"
              />
              {data?.deliveryOne?.hasPassword && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Password already configured on Delhivery.
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>API Key / Token</FormLabel>
              <Input
                type="password"
                value={deliveryOneForm.apiKey}
                onChange={(e) =>
                  setDeliveryOneForm((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder={data?.deliveryOne?.apiKeyMasked || 'Enter Delhivery API key'}
              />
              {!!data?.deliveryOne?.apiKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current key: {data.deliveryOne.apiKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Webhook Secret</FormLabel>
              <Input
                type="password"
                value={deliveryOneForm.webhookSecret}
                onChange={(e) =>
                  setDeliveryOneForm((prev) => ({ ...prev, webhookSecret: e.target.value }))
                }
                placeholder="Leave blank to keep existing webhook secret"
              />
              {data?.deliveryOne?.hasWebhookSecret && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Webhook secret already configured on Delhivery.
                </Text>
              )}
            </FormControl>

            <Text fontSize="xs" color="gray.500">
              Leave password, API key, or
              webhook secret blank to keep the saved value.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveDeliveryOne}
              isLoading={updateDeliveryOne.isPending}
              alignSelf="flex-start"
            >
              Save Delhivery Credentials
            </Button>
          </VStack>
        </Box>
        <Box borderWidth="1px" borderRadius="lg" p={5} minW={{ base: 0, md: '320px' }} w="100%" flex="1" maxW="520px" alignSelf="flex-start">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center" gap={2} flexWrap="wrap">
              <Text fontWeight="semibold">Shadowfax</Text>
              <Badge colorScheme={data?.shadowfax?.hasApiToken && data.shadowfax.environment === 'production' ? 'green' : 'orange'}>
                {data?.shadowfax?.hasApiToken && data.shadowfax.environment === 'production' ? 'Production token saved' : 'Production token required'}
              </Badge>
            </Flex>
            <FormControl>
              <FormLabel htmlFor="shadowfax-production-token">Production Token</FormLabel>
              <Input
                id="shadowfax-production-token"
                name="shadowfax-production-token"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={shadowfaxToken}
                onChange={(event) => setShadowfaxToken(event.target.value)}
                placeholder={data?.shadowfax?.hasApiToken ? 'Enter a new token to replace the saved token' : 'Enter Shadowfax production token'}
                isDisabled={updateShadowfax.isPending}
              />
            </FormControl>
            <Text fontSize="sm" color="gray.500">
              The production API URL is configured automatically. Your saved token is never displayed.
              You can prepare B2C rate cards while shipment booking remains disabled.
            </Text>
            <Button colorScheme="blue" onClick={handleSaveShadowfax} isLoading={updateShadowfax.isPending}
              isDisabled={!shadowfaxToken.trim()} alignSelf={{ base: 'stretch', md: 'flex-start' }}>
              Save Shadowfax Token
            </Button>
          </VStack>
        </Box>
      </Flex>
    </Flex>
  )
}

export default CourierCredentials
