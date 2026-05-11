import { extendTheme } from '@chakra-ui/react'
import { CardComponent } from './additions/card/Card'
import { CardBodyComponent } from './additions/card/CardBody'
import { CardHeaderComponent } from './additions/card/CardHeader'
import { MainPanelComponent } from './additions/layout/mainPanel'
import { PanelContainerComponent } from './additions/layout/panelContainer'
import { PanelContentComponent } from './additions/layout/panelContent'
import { badgeStyles } from './components/badge'
import { buttonStyles } from './components/button'
import { drawerStyles } from './components/drawer'
import { linkStyles } from './components/link'
import { brandFonts, brandGradients } from './brand'
import { breakpoints } from './foundations/breakpoints'
import { globalStyles } from './styles'

const fieldBase = {
  borderRadius: '10px',
  borderColor: 'rgba(13,27,77,0.12)',
  bg: 'rgba(255,255,255,0.86)',
  fontWeight: '600',
  _placeholder: {
    color: 'gray.500',
  },
  _hover: {
    borderColor: 'rgba(13,27,77,0.24)',
  },
  _focusVisible: {
    borderColor: 'accent.500',
    boxShadow: '0 0 0 4px rgba(255, 138, 40, 0.2)',
    bg: 'rgba(255,255,255,0.9)',
  },
}

const dividerStyles = {
  components: {
    Divider: {
      baseStyle: {
        borderColor: 'rgba(13,27,77,0.1)',
        borderWidth: '1px',
      },
      defaultProps: {
        variant: 'subtle',
      },
    },
  },
}

const componentOverrides = {
  components: {
    Input: {
      variants: {
        outline: {
          field: fieldBase,
        },
        filled: {
          field: {
            ...fieldBase,
            bg: 'rgba(255,248,240,0.92)',
          },
        },
      },
      defaultProps: {
        focusBorderColor: 'accent.500',
        variant: 'outline',
      },
    },
    Select: {
      variants: {
        outline: {
          field: fieldBase,
        },
      },
      defaultProps: {
        focusBorderColor: 'accent.500',
        variant: 'outline',
      },
    },
    Textarea: {
      variants: {
        outline: {
          ...fieldBase,
          minH: '120px',
        },
      },
      defaultProps: {
        focusBorderColor: 'accent.500',
        variant: 'outline',
      },
    },
    FormLabel: {
      baseStyle: {
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        fontWeight: '800',
        color: 'gray.600',
        mb: '10px',
      },
    },
    Table: {
      variants: {
        simple: {
          table: {
            borderCollapse: 'separate',
            borderSpacing: '0 10px',
          },
          thead: {
            tr: {
              th: {
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: '800',
                fontSize: '11px',
                color: 'gray.600',
                borderColor: 'rgba(13,27,77,0.12)',
                bg: 'transparent',
                pb: '10px',
              },
            },
          },
          tbody: {
            tr: {
              td: {
                bg: 'rgba(255,255,255,0.78)',
                borderColor: 'rgba(13,27,77,0.08)',
                fontSize: '14px',
                color: 'gray.800',
                py: '16px',
              },
              '& td:first-of-type': {
                borderTopLeftRadius: '10px',
                borderBottomLeftRadius: '10px',
              },
              '& td:last-of-type': {
                borderTopRightRadius: '10px',
                borderBottomRightRadius: '10px',
              },
            },
          },
        },
      },
    },
    Tabs: {
      baseStyle: {
        tab: {
          borderRadius: '10px',
          px: '18px',
          py: '10px',
          fontWeight: '700',
          color: 'gray.600',
          _selected: {
            color: 'gray.900',
            bg: 'rgba(255,255,255,0.78)',
            boxShadow: '0 12px 28px rgba(68,92,138,0.1)',
          },
        },
        tablist: {
          p: '6px',
          borderRadius: '12px',
          bg: 'rgba(255,255,255,0.72)',
          border: '1px solid rgba(13,27,77,0.08)',
          boxShadow: '0 14px 28px rgba(68,92,138,0.06)',
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          borderRadius: '16px',
          borderWidth: '1px',
          borderColor: 'rgba(13,27,77,0.12)',
          boxShadow: '0 34px 72px rgba(13,27,77,0.18)',
          bg: brandGradients.surface,
          overflow: 'hidden',
          backdropFilter: 'blur(16px)',
        },
        header: {
          fontWeight: '800',
          fontFamily: brandFonts.display,
          borderBottom: '1px solid rgba(13,27,77,0.08)',
          pb: '18px',
        },
        body: {
          py: '20px',
        },
        footer: {
          borderTop: '1px solid rgba(13,27,77,0.08)',
          pt: '18px',
        },
        overlay: {
          bg: 'rgba(20, 25, 35, 0.5)',
          backdropFilter: 'blur(10px)',
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: '8px',
        textTransform: 'none',
        px: '2.5',
        py: '1',
        fontWeight: '700',
      },
    },
    Tooltip: {
      baseStyle: {
        borderRadius: '12px',
      },
    },
  },
  fonts: {
    heading: brandFonts.display,
    body: brandFonts.body,
  },
}

export default extendTheme(
  { breakpoints },
  globalStyles,
  buttonStyles,
  badgeStyles,
  linkStyles,
  drawerStyles,
  CardComponent,
  CardBodyComponent,
  CardHeaderComponent,
  MainPanelComponent,
  PanelContentComponent,
  PanelContainerComponent,
  dividerStyles,
  componentOverrides,
)
