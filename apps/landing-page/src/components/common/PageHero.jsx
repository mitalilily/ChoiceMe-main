import { Chip, Stack, Typography } from "@mui/material";
import MotionFade from "./MotionFade";

export default function PageHero({ badge, title, description, caption, artwork }) {
  const hasArtwork = Boolean(artwork?.src);

  return (
    <section className="page-hero">
      <div className="container-shell">
        <div className={`page-hero__grid${hasArtwork ? " page-hero__grid--with-art" : ""}`}>
          <MotionFade className="page-hero__content">
            <Stack direction="row" flexWrap="wrap" gap={1.2}>
              <Chip className="page-hero__chip" label={badge} />
              {caption ? <Chip className="page-hero__chip page-hero__chip--soft" label={caption} /> : null}
            </Stack>
            <Typography className="page-hero__title" variant="h1">
              {title}
            </Typography>
            <Typography className="page-hero__description" variant="body1">
              {description}
            </Typography>
          </MotionFade>

          {hasArtwork ? (
            <MotionFade className="page-hero__media" delay={0.04} y={18}>
              <div className="page-hero__media-card">
                <img
                  alt={artwork.alt}
                  className={`page-hero__image ${artwork.className ?? ""}`.trim()}
                  src={artwork.src}
                />
              </div>
            </MotionFade>
          ) : null}
        </div>
      </div>
    </section>
  );
}
