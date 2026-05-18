import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import './loader.css'

const MIN_DISPLAY_TIME = 180

/**
 * Shows lightweight route feedback without blocking clicks during quick navigation.
 */
export default function NavigationLoader() {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading(true)

    const timer = setTimeout(() => {
      setIsLoading(false)
    }, MIN_DISPLAY_TIME)

    return () => {
      clearTimeout(timer)
    }
  }, [location.pathname, location.search, location.hash])

  if (!isLoading) return null

  return <div className="navigation-progress" aria-hidden="true" />
}
