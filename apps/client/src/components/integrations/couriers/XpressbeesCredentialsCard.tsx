import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { MdKey, MdSave } from 'react-icons/md'
import axiosInstance from '../../../api/axiosInstance'

type XpressbeesCredentialStatus = {
  provider: 'xpressbees'
  apiBase: string
  username: string
  hasPassword: boolean
  hasApiKey: boolean
  apiKeyMasked?: string
}

type CredentialResponse = {
  success: boolean
  data: {
    xpressbees: XpressbeesCredentialStatus
  }
}

const DEFAULT_API_BASE = 'https://shipment.xpressbees.com'

const fetchCourierCredentials = async () => {
  const res = await axiosInstance.get<CredentialResponse>('/couriers/credentials')
  return res.data.data.xpressbees
}

const saveXpressbeesCredentials = async (payload: {
  apiBase: string
  username: string
  password?: string
  apiKey?: string
}) => {
  const res = await axiosInstance.put('/couriers/credentials/xpressbees', payload)
  return res.data
}

const XpressbeesCredentialsCard = () => {
  const queryClient = useQueryClient()
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [notice, setNotice] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['courierCredentials'],
    queryFn: fetchCourierCredentials,
  })

  useEffect(() => {
    if (!data) return
    setApiBase(data.apiBase || DEFAULT_API_BASE)
    setUsername(data.username || '')
  }, [data])

  const mutation = useMutation({
    mutationFn: saveXpressbeesCredentials,
    onSuccess: () => {
      setPassword('')
      setApiKey('')
      setNotice('Xpressbees credentials saved successfully.')
      queryClient.invalidateQueries({ queryKey: ['courierCredentials'] })
    },
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    mutation.mutate({
      apiBase: apiBase.trim() || DEFAULT_API_BASE,
      username: username.trim(),
      ...(password.trim() ? { password: password.trim() } : {}),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    })
  }

  const isReady = Boolean(username.trim() && data?.hasPassword)

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={1.5}
          mb={2}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                Xpressbees Credentials
              </Typography>
              <Chip
                size="small"
                color={isReady ? 'success' : 'warning'}
                label={isReady ? 'Ready' : 'Needs setup'}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Minimum required: API base, account email, and password. Bearer token is optional.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {data?.hasApiKey && <Chip icon={<MdKey />} size="small" label="Token saved" />}
            {data?.hasPassword && <Chip size="small" label="Password saved" />}
          </Stack>
        </Stack>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              label="API Base"
              value={apiBase}
              onChange={(event) => setApiBase(event.target.value)}
              size="small"
              fullWidth
              disabled={isLoading || mutation.isPending}
            />
            <TextField
              label="Email"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              size="small"
              fullWidth
              disabled={isLoading || mutation.isPending}
            />
            <TextField
              label={data?.hasPassword ? 'New Password' : 'Password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              size="small"
              type="password"
              fullWidth
              disabled={isLoading || mutation.isPending}
              helperText={data?.hasPassword ? 'Leave blank to keep existing password' : 'Required'}
            />
            <TextField
              label="Bearer Token"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              size="small"
              type="password"
              fullWidth
              disabled={isLoading || mutation.isPending}
              helperText={data?.hasApiKey ? `Saved ${data.apiKeyMasked || ''}` : 'Optional'}
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<MdSave />}
              disabled={isLoading || mutation.isPending || !username.trim()}
              sx={{ minWidth: 120 }}
            >
              Save
            </Button>
          </Stack>
        </Box>

        {(notice || mutation.error) && (
          <Alert severity={mutation.error ? 'error' : 'success'} sx={{ mt: 2 }}>
            {mutation.error instanceof Error
              ? mutation.error.message
              : notice}
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default XpressbeesCredentialsCard
