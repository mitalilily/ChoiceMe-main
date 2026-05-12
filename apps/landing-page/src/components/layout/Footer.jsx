import {
  CallRounded,
  EmailRounded,
  FacebookRounded,
  Instagram,
  LinkedIn,
  LocationOnRounded,
} from "@mui/icons-material";
import { IconButton, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import LogoMark from "../brand/LogoMark";
import { brand, footerGroups, socialLinks } from "../../data/siteData";

const socialIconMap = {
  LinkedIn: <LinkedIn fontSize="small" />,
  Instagram: <Instagram fontSize="small" />,
  Facebook: <FacebookRounded fontSize="small" />,
};

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container-shell site-footer__grid">
        <div className="site-footer__brand">
          <LogoMark />
          <Typography className="site-footer__copy" variant="body2">
            {brand.subheadline}. Premium shipping infrastructure for teams that want better courier
            visibility, cleaner rates, and modern customer delivery experiences.
          </Typography>
          <div className="site-footer__socials">
            {socialLinks.map((item) => (
              <IconButton
                key={item.label}
                className="site-footer__social"
                component="a"
                href={item.href}
                rel="noreferrer"
                target="_blank"
              >
                {socialIconMap[item.label]}
              </IconButton>
            ))}
          </div>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title} className="site-footer__column">
            <Typography className="site-footer__title" variant="subtitle1">
              {group.title}
            </Typography>
            <div className="site-footer__links">
              {group.links.map((linkItem) => (
                <Link key={linkItem.label} className="site-footer__link" to={linkItem.to}>
                  {linkItem.label}
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="site-footer__column">
          <Typography className="site-footer__title" variant="subtitle1">
            Contact
          </Typography>
          <a className="site-footer__info" href={`tel:${brand.phone}`}>
            <CallRounded fontSize="small" />
            {brand.phone}
          </a>
          <a className="site-footer__info" href={`mailto:${brand.email}`}>
            <EmailRounded fontSize="small" />
            {brand.email}
          </a>
          <div className="site-footer__info site-footer__info--address">
            <LocationOnRounded fontSize="small" />
            <span>{brand.address}</span>
          </div>
        </div>
      </div>

      <div className="container-shell site-footer__bottom">
        <Typography variant="body2">
          © {new Date().getFullYear()} {brand.name}. Built for dependable logistics operations
          across India.
        </Typography>
      </div>
    </footer>
  );
}
