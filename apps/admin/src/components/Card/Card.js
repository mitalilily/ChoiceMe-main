import { Box, useStyleConfig } from "@chakra-ui/react";
function Card(props) {
  const { variant, children, className, ...rest } = props;
  const styles = useStyleConfig("Card", { variant });
  // Pass the computed styles into the `__css` prop
  return (
    <Box __css={styles} className={["admin-card", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Box>
  );
}

export default Card;
