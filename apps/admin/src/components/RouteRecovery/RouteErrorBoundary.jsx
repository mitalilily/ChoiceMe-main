import { Box, Button, Text } from '@chakra-ui/react'
import React, { useEffect } from 'react'

const ROUTE_RELOAD_KEY = 'choicemee-admin-route-asset-reload'

const isRouteAssetError = (error) => {
  const message = error instanceof Error ? error.message : String(error || '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    message,
  )
}

const reloadOnceForFreshAssets = () => {
  const alreadyReloaded = window.sessionStorage.getItem(ROUTE_RELOAD_KEY)
  if (alreadyReloaded) return
  window.sessionStorage.setItem(ROUTE_RELOAD_KEY, '1')
  window.location.reload()
}

export function RouteAssetRecovery() {
  useEffect(() => {
    const clearReloadMarker = window.setTimeout(() => {
      window.sessionStorage.removeItem(ROUTE_RELOAD_KEY)
    }, 2500)

    const handleRejectedImport = (event) => {
      if (isRouteAssetError(event.reason)) reloadOnceForFreshAssets()
    }

    const handleScriptError = (event) => {
      if (isRouteAssetError(event.error || event.message)) reloadOnceForFreshAssets()
    }

    window.addEventListener('unhandledrejection', handleRejectedImport)
    window.addEventListener('error', handleScriptError)

    return () => {
      window.clearTimeout(clearReloadMarker)
      window.removeEventListener('unhandledrejection', handleRejectedImport)
      window.removeEventListener('error', handleScriptError)
    }
  }, [])

  return null
}

export class RouteErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    if (isRouteAssetError(error)) {
      reloadOnceForFreshAssets()
      return
    }
    console.error('Admin route render failed', error, info)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <Box
        minH="60vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        gap="12px"
        textAlign="center"
      >
        <Text fontWeight="700" color="gray.700">
          This page could not finish loading.
        </Text>
        <Button colorScheme="brand" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </Box>
    )
  }
}
