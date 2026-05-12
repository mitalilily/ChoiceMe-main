import { Link } from "react-router-dom";
import { companyInfo, footerGroups } from "../../utils/siteContent";

function FooterLink({ link }) {
  if (link.kind === "external") {
    return (
      <a className="footer-link" href={link.href} rel="noreferrer" target="_blank">
        {link.label}
      </a>
    );
  }

  if (link.kind === "route") {
    return (
      <Link className="footer-link" to={link.href}>
        {link.label}
      </Link>
    );
  }

  if (link.kind === "anchor") {
    return (
      <a className="footer-link" href={link.href}>
        {link.label}
      </a>
    );
  }

  return (
    <span aria-disabled="true" className="footer-link footer-link--muted">
      {link.label}
      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-white/55">
        Soon
      </span>
    </span>
  );
}

export default function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-12 xl:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8">
            <img alt="CAMPLAR" className="h-16 w-auto" src="/camplar-logo.png" />
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/72">
              CAMPLAR brings rate comparison, tracking, COD visibility, NDR workflows, and
              connected integrations into one dependable shipping workflow for fast-growing teams.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-300">
                  Contact
                </p>
                <a className="mt-3 block text-lg font-semibold text-white" href={`mailto:${companyInfo.email}`}>
                  {companyInfo.email}
                </a>
                <a
                  className="mt-1 block text-white/72 transition hover:text-white"
                  href={`tel:${companyInfo.primaryPhone.replace(/\s+/g, "")}`}
                >
                  {companyInfo.primaryPhone}
                </a>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-300">
                  Address
                </p>
                <p className="mt-3 text-white/72">{companyInfo.address}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {footerGroups.map((group) => (
              <div key={group.title} className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <h2 className="font-heading text-lg tracking-[0.18em] text-white">{group.title}</h2>
                <div className="mt-4 grid gap-4">
                  {group.links.map((link) => (
                    <FooterLink key={link.label} link={link} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {companyInfo.name} &copy; {currentYear}. All rights reserved.
          </p>
          <p>Built for shipping teams that need clarity, speed, and reliable courier operations.</p>
        </div>
      </div>
    </footer>
  );
}
