import {
  AnalyticsRounded,
  ApiRounded,
  ArrowForwardRounded,
  BoltRounded,
  FlashOnRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  ShieldRounded,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import MotionFade from "../components/common/MotionFade";
import AnimatedNumber from "../components/common/AnimatedNumber";
import {
  brand,
  dashboardPoints,
  featureCards,
  heroHighlights,
  howItWorks,
  partnerLogos,
  statsGrid,
  testimonials,
} from "../data/siteData";

const featureIcons = [<LocalShippingRounded />, <AnalyticsRounded />, <ShieldRounded />, <ApiRounded />];

export default function HomePage() {
  return (
    <div className="page-shell home-theme">
      <section className="home-theme__hero">
        <div className="container-shell home-theme__hero-grid">
          <MotionFade className="home-theme__hero-copy">
            <span className="home-theme__badge">
              <BoltRounded fontSize="small" />
              {brand.heroBadge}
            </span>

            <h1 className="home-theme__headline">
              {brand.headline.split(" Across ")[0]} <br />
              <span>Across India</span>
            </h1>

            <p className="home-theme__copy">
              {brand.subheadline}. Launch premium shipping experiences with rate intelligence,
              unified tracking, and beautiful operational clarity.
            </p>

            <div className="home-theme__actions">
              <Link className="home-theme__button home-theme__button--primary" to="/rate-calculator">
                Start Shipping
              </Link>
              <Link className="home-theme__button home-theme__button--soft" to="/tracking">
                Track Order
                <ArrowForwardRounded fontSize="small" />
              </Link>
            </div>

            <div className="home-theme__highlights">
              {heroHighlights.map((item, index) => (
                <MotionFade
                  key={item.label}
                  className="home-theme__highlight"
                  delay={0.12 + index * 0.08}
                >
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </MotionFade>
              ))}
            </div>
          </MotionFade>
        </div>
      </section>

      <section className="home-theme__partner-band pattern-diagonal-stripes">
        <div className="container-shell">
          <MotionFade className="home-theme__brand-intro">
            <span className="home-theme__eyebrow">Brand integration</span>
            <img alt={brand.logoAlt} className="home-theme__brand-logo" src={brand.logoSrc} />
            <p className="home-theme__brand-copy">
              {brand.subheadline}. Connected with leading courier brands in one trusted shipping workflow.
            </p>
          </MotionFade>

          <div className="home-theme__partners">
            {partnerLogos.map((partner) => (
              <div key={partner.name} className="home-theme__partner-card">
                <img
                  alt={`${partner.name} logo`}
                  className="home-theme__partner-logo"
                  decoding="async"
                  loading="lazy"
                  src={partner.src}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-theme__section pattern-chevrons">
        <div className="container-shell">
          <MotionFade className="home-theme__section-intro">
            <span className="home-theme__eyebrow">How it works</span>
            <h2 className="home-theme__title">
              A frictionless dispatch workflow from order sync to doorstep delivery
            </h2>
            <p className="home-theme__description">
              Each step is built to feel fast, polished, and operationally reliable for logistics
              teams.
            </p>
          </MotionFade>

          <div className="home-theme__process">
            {howItWorks.map((step, index) => (
              <MotionFade key={step.title} className="home-theme__process-step" delay={index * 0.08}>
                <div className={`home-theme__step-circle ${index < 3 ? "home-theme__step-circle--active" : ""}`}>
                  0{index + 1}
                </div>
                <h3 className="home-theme__card-title">{step.title}</h3>
                <p className="home-theme__card-copy">{step.description}</p>
              </MotionFade>
            ))}
          </div>
        </div>
      </section>

      <section className="home-theme__section home-theme__section--alt pattern-dots">
        <div className="container-shell">
          <MotionFade className="home-theme__section-intro">
            <span className="home-theme__eyebrow">Platform features</span>
            <h2 className="home-theme__title">
              Everything you need to ship smart, track easy, and grow fast
            </h2>
            <p className="home-theme__description">
              Smart routing picks the best courier for every parcel. Real-time tracking keeps everyone
              in the loop. And one simple dashboard controls it all - from rates to payments.
            </p>
          </MotionFade>

          <div className="home-theme__feature-grid">
            {featureCards.map((feature, index) => (
              <MotionFade key={feature.title} delay={index * 0.06}>
                <article className="home-theme__feature-card">
                  <div className="home-theme__feature-icon">{featureIcons[index]}</div>
                  <span className="home-theme__feature-badge">{feature.badge}</span>
                  <h3 className="home-theme__card-title">{feature.title}</h3>
                  <p className="home-theme__card-copy">{feature.description}</p>
                </article>
              </MotionFade>
            ))}
          </div>
        </div>
      </section>

      <section className="home-theme__section pattern-gradient-mesh">
        <div className="container-shell home-theme__showcase">
          <MotionFade className="home-theme__showcase-copy">
            <span className="home-theme__eyebrow">Operations dashboard</span>
            <h2 className="home-theme__title">
              Your shipping command center - beautiful, simple, and powerful
            </h2>
            <p className="home-theme__description">
              One place to see everything. Watch live pickups happening now, see all your shipments,
              check your metrics, and run your entire shipping operation. No complexity, just clarity.
            </p>
          </MotionFade>

          <MotionFade delay={0.1}>
            <div className="home-theme__dashboard-card">
              <div className="home-theme__dashboard-header">
                <div>
                  <span className="home-theme__dashboard-label">Dispatch overview</span>
                  <h3 className="home-theme__dashboard-title">Today&apos;s network pulse</h3>
                </div>
                <div className="home-theme__dashboard-chip">
                  <Inventory2Rounded fontSize="small" />
                  184 live pickups
                </div>
              </div>

              <div className="home-theme__dashboard-metrics">
                {statsGrid.slice(0, 2).map((item) => (
                  <div key={item.label} className="home-theme__dashboard-metric">
                    <span>{item.label}</span>
                    <strong>
                      {item.value.toLocaleString("en-IN")}
                      {item.suffix}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="home-theme__dashboard-list">
                {dashboardPoints.map((point) => (
                  <div key={point} className="home-theme__dashboard-item">
                    <span className="home-theme__dashboard-dot" />
                    <p>{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </MotionFade>
        </div>
      </section>

      <section className="home-theme__section home-theme__section--soft pattern-grid">
        <div className="container-shell">
          <MotionFade className="home-theme__section-intro home-theme__section-intro--center">
            <span className="home-theme__eyebrow">Proof points</span>
            <h2 className="home-theme__title">Trusted by thousands of shipping businesses</h2>
            <p className="home-theme__description">
              These numbers show just how powerful our platform really is. More orders shipped,
              faster processing, and happier customers.
            </p>
          </MotionFade>

          <div className="home-theme__stats-grid">
            {statsGrid.map((stat, index) => (
              <MotionFade key={stat.label} delay={index * 0.06}>
                <div className="home-theme__stat-card">
                  <AnimatedNumber suffix={stat.suffix} value={stat.value} />
                  <p className="home-theme__stat-label">{stat.label}</p>
                </div>
              </MotionFade>
            ))}
          </div>
        </div>
      </section>

      <section className="home-theme__section pattern-waves">
        <div className="container-shell">
          <div className="home-theme__testimonial-layout">
            <MotionFade className="home-theme__testimonial-copy">
              <span className="home-theme__eyebrow">Testimonials</span>
              <h2 className="home-theme__title">
                What customers love about ChoiceMee Logistics
              </h2>
              <p className="home-theme__description">
                Shipping teams, store owners, and logistics managers all choose us because we make
                their lives easier and their businesses better.
              </p>
              <div className="home-theme__testimonial-metrics">
                <div>
                  <strong>99.8%</strong>
                  <span>Shipment Success Rate</span>
                </div>
                <div>
                  <strong>24/7</strong>
                  <span>Always Monitoring</span>
                </div>
              </div>
            </MotionFade>

            <div className="home-theme__testimonial-cards">
              {testimonials.map((item, index) => (
                <MotionFade key={item.name} delay={0.06 * index}>
                  <article className="home-theme__testimonial-card">
                    <FlashOnRounded className="home-theme__testimonial-quote" />
                    <p className="home-theme__testimonial-text">"{item.quote}"</p>
                    <div className="home-theme__testimonial-meta">
                      <div className="home-theme__testimonial-avatar">
                        {item.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </div>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.role}</span>
                      </div>
                    </div>
                  </article>
                </MotionFade>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-theme__section home-theme__section--cta pattern-marble">
        <div className="container-shell">
          <div className="home-theme__cta-panel">
            <div>
              <span className="home-theme__cta-eyebrow">Get started today</span>
              <h2 className="home-theme__cta-title">
                Start shipping smarter with ChoiceMee Logistics
              </h2>
              <p className="home-theme__cta-copy">
                Try our free rate calculator to see instant shipping prices. Compare couriers, track shipments live,
                or explore our full dashboard. No credit card needed.
              </p>
            </div>
            <div className="home-theme__actions">
              <Link className="home-theme__button home-theme__button--white" to="/rate-calculator">
                Explore Rates
              </Link>
              <Link className="home-theme__button home-theme__button--ghost" to="/contact">
                Contact Team
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
