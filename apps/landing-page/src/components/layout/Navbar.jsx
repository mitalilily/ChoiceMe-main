import { Button, Drawer, IconButton, Stack } from "@mui/material";
import { CloseRounded, MenuRounded, NorthEastRounded } from "@mui/icons-material";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import LogoMark from "../brand/LogoMark";
import { navLinks } from "../../data/siteData";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const isHomePage = pathname === "/";

  return (
    <>
      <header className={`site-header ${isHomePage ? "site-header--overlay" : ""}`.trim()}>
        <div className={`container-shell site-header__inner ${isHomePage ? "site-header__inner--overlay" : ""}`.trim()}>
          <Link className="brand-link" to="/">
            <LogoMark compact />
          </Link>

          <nav className="site-nav" aria-label="Primary">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) => `site-nav__link ${isActive ? "site-nav__link--active" : ""}`}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Stack alignItems="center" direction="row" gap={1.2}>
            <Button
              className="button-primary"
              component={Link}
              endIcon={<NorthEastRounded />}
              to="/rate-calculator"
              variant="contained"
            >
              Start Shipping
            </Button>
            <IconButton
              className="site-header__menu"
              color="primary"
              onClick={() => setMobileOpen(true)}
            >
              <MenuRounded />
            </IconButton>
          </Stack>
        </div>
      </header>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ className: "mobile-drawer" }}
      >
        <div className="mobile-drawer__header">
          <LogoMark compact />
          <IconButton onClick={() => setMobileOpen(false)}>
            <CloseRounded />
          </IconButton>
        </div>
        <div className="mobile-drawer__content">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                `mobile-drawer__link ${isActive ? "mobile-drawer__link--active" : ""}`
              }
              onClick={() => setMobileOpen(false)}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
          <Button
            className="button-primary mobile-drawer__cta"
            component={Link}
            onClick={() => setMobileOpen(false)}
            to="/login"
            variant="contained"
          >
            Open Portal
          </Button>
        </div>
      </Drawer>
    </>
  );
}
