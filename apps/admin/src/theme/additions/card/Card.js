const Card = {
  baseStyle: {
    p: '22px',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    position: 'relative',
    minWidth: '0px',
    wordWrap: 'break-word',
    backgroundClip: 'border-box',
  },
  variants: {
    panel: (props) => ({
      bg:
        props.colorMode === 'dark'
          ? 'rgba(13, 27, 77, 0.96)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,254,0.98) 100%)',
      width: '100%',
      border:
        props.colorMode === 'dark'
          ? '1px solid rgba(148, 163, 184, 0.18)'
          : '1px solid rgba(214, 224, 239, 0.92)',
      boxShadow:
        props.colorMode === 'dark'
          ? '0 12px 30px rgba(2, 8, 23, 0.5)'
          : '0 18px 38px rgba(15, 44, 67, 0.06)',
      borderRadius: '14px',
      overflow: 'hidden',
      backdropFilter: 'blur(10px)',
    }),
  },
  defaultProps: {
    variant: 'panel',
  },
}

export const CardComponent = {
  components: {
    Card,
  },
}
