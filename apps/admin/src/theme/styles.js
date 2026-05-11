import { mode } from '@chakra-ui/theme-tools'
import { brand, brandFonts, brandGradients } from './brand'
import colors from './foundations/colors'

export const globalStyles = {
  colors: {
    ...colors,
  },
  styles: {
    global: (props) => ({
      body: {
        bg: mode(brand.page, '#050B24')(props),
        color: mode('gray.900', 'whiteAlpha.900')(props),
        fontFamily: brandFonts.body,
        backgroundImage: mode(
          brandGradients.page,
          'radial-gradient(circle at 8% 6%, rgba(255,255,255,0.1) 0%, transparent 26%), radial-gradient(circle at 92% 4%, rgba(255,138,40,0.14) 0%, transparent 24%), linear-gradient(180deg, #0D1B4D 0%, #050B24 100%)',
        ),
        backgroundAttachment: 'fixed',
      },
      html: {
        fontFamily: brandFonts.body,
        bg: mode(brand.page, '#050B24')(props),
      },
      '#root': {
        minHeight: '100vh',
      },
      '*': {
        boxSizing: 'border-box',
      },
      '.chakra-button': {
        borderRadius: '10px !important',
        minHeight: '40px',
        alignItems: 'center',
        justifyContent: 'center',
      },
      '.chakra-icon-button': {
        borderRadius: '10px !important',
      },
      '.admin-card': {
        borderRadius: '14px !important',
      },
      '.chakra-modal__content': {
        borderRadius: '16px !important',
      },
      '.chakra-input, .chakra-select, .chakra-textarea': {
        borderRadius: '10px !important',
      },
      '::selection': {
        background: mode('brand.100', 'accent.600')(props),
      },
      '::-webkit-scrollbar': {
        width: '10px',
        height: '10px',
      },
      '::-webkit-scrollbar-track': {
        background: mode('rgba(255,255,255,0.72)', 'rgba(255,255,255,0.06)')(props),
      },
      '::-webkit-scrollbar-thumb': {
        background: mode('linear-gradient(180deg, rgba(215,226,243,0.92) 0%, rgba(71,120,189,0.92) 100%)', 'rgba(255,255,255,0.22)')(props),
        borderRadius: '999px',
      },
    }),
  },
}
