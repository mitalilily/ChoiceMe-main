import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { companyInfo, navItems } from "../../utils/siteContent";

function resolveNavHref(href, pathname) {
  if (pathname === "/") {
    return href;
  }

  return `/${href}`;
}

export default function SiteHeader({ onPrimaryAction }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const isContactPage = pathname === "/contact";
  const getStartedHref =
    pathname === "/" ? companyInfo.getStartedPath : `/${companyInfo.getStartedPath}`;

  return (
    <header className="sticky top-0 z-50 shadow-[0_10px_30px_rgba(0,29,103,0.08)]">
      <div className="border-b border-white/15 bg-[#001d67] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 text-xs font-medium sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-white">
            <a className="transition hover:text-[#34ccff]" href={`mailto:${companyInfo.email}`}>
              {companyInfo.email}
            </a>
            <a
              className="transition hover:text-[#34ccff]"
              href={`tel:${companyInfo.primaryPhone.replace(/\s+/g, "")}`}
            >
              {companyInfo.primaryPhone}
            </a>
            <span className="hidden text-white/90 lg:inline">{companyInfo.address}</span>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-none sm:grid-flow-col sm:items-center">
            <a
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-2 text-white transition hover:border-[#34ccff] hover:text-[#34ccff]"
              href={getStartedHref}
            >
              Get Started
            </a>
            <a
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-2 text-white transition hover:border-[#34ccff] hover:text-[#34ccff]"
              href={companyInfo.trackingUrl}
              rel="noreferrer"
              target="_blank"
            >
              Track Order
            </a>
          </div>
        </div>
      </div>

      <div className="border-b border-[#d7edff] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex min-w-0 flex-1 items-center lg:flex-none" to="/">
            <img
              alt="CAMPLAR"
              className="h-14 w-auto shrink-0 sm:h-16"
              src="/camplar-logo-sticky.png"
            />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                className="px-4 py-2 text-sm font-semibold text-[#5b7d9a] transition hover:text-[#ff5e14]"
                href={resolveNavHref(item.href, pathname)}
              >
                {item.label}
              </a>
            ))}
            <Link
              className={`px-4 py-2 text-sm font-semibold transition ${
                isContactPage
                  ? "text-[#ff5e14]"
                  : "text-[#5b7d9a] hover:text-[#ff5e14]"
              }`}
              to="/contact"
            >
              Contact
            </Link>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {onPrimaryAction ? (
              <button className="outline-button" onClick={onPrimaryAction} type="button">
                Start Shipping
              </button>
            ) : (
              <a className="outline-button" href="/#rate-calculator">
                Start Shipping
              </a>
            )}
            <Link className="cta-button" to="/contact">
              Book Demo
            </Link>
          </div>

          <button
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d7edff] bg-white text-[#001d67] lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span className="space-y-1.5">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
            </span>
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-[#d7edff] bg-white px-4 py-4 sm:px-6 lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  className="rounded-2xl px-4 py-3 font-semibold text-[#5b7d9a] transition hover:bg-[#f5f8fd] hover:text-[#ff5e14]"
                  href={resolveNavHref(item.href, pathname)}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link
                className="rounded-2xl px-4 py-3 font-semibold text-[#5b7d9a] transition hover:bg-[#f5f8fd] hover:text-[#ff5e14]"
                onClick={() => setMenuOpen(false)}
                to="/contact"
              >
                Contact
              </Link>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {onPrimaryAction ? (
                  <button
                    className="outline-button"
                    onClick={() => {
                      setMenuOpen(false);
                      onPrimaryAction();
                    }}
                    type="button"
                  >
                    Start Shipping
                  </button>
                ) : (
                  <a className="outline-button" href="/#rate-calculator" onClick={() => setMenuOpen(false)}>
                    Start Shipping
                  </a>
                )}
                <Link className="cta-button" onClick={() => setMenuOpen(false)} to="/contact">
                  Book Demo
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
