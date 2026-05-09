import { Box, Typography } from '@mui/material'
import React from 'react'
import './loader.css'
import Logo from '/brand/choiceme-logo.png'
import { brandIdentity } from '../../../theme/brand'

type Props = {
  night?: boolean
}

const FullScreenLoader: React.FC<Props> = ({ night = false }) => {
  return (
    <Box className={`loader-overlay ${night ? 'night' : ''}`}>
      <Box className="loader-content">
        <div className="logo-container">
          <img src={Logo} alt={brandIdentity.name} className="loader-logo" />
        </div>
        <Typography
          sx={{
            color: '#10324A',
            fontWeight: 800,
            letterSpacing: '0.08em',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
          }}
        >
          {brandIdentity.name}
        </Typography>
      </Box>
    </Box>
  )
}

export default FullScreenLoader
