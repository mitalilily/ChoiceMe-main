export const buttonStyles = {
  components: {
    Button: {
      variants: {
        'no-hover': {
          _hover: {
            boxShadow: 'none',
          },
        },
        'transparent-with-icon': {
          bg: 'transparent',
          fontWeight: '600',
          borderRadius: '10px',
          cursor: 'pointer',
          _active: {
            bg: 'transparent',
            transform: 'none',
            borderColor: 'transparent',
          },
          _focus: {
            boxShadow: 'none',
          },
          _hover: {
            bg: 'rgba(255, 138, 40, 0.1)',
          },
        },
      },
      baseStyle: {
        borderRadius: '10px',
        fontWeight: '700',
        letterSpacing: '0',
        _focus: {
          boxShadow: 'none',
        },
      },
    },
  },
}
