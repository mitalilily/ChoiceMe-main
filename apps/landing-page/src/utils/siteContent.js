export const companyInfo = {
  name: "ChoiceMee",
  tagline: "Your trust, Our Commitment",
  email: "camplar11@gmail.com",
  primaryPhone: "+91 9714079405",
  phones: ["+91 9714079405", "+91 9898907058", "+91 7046014625"],
  address: "C140 SoBo Centre South Bopal Ahmedabad - 380058 Gujarat India",
  getStartedPath: "#rate-calculator",
  trackingUrl:
    "http://app.camplar.in/tracking/Tracking?Token=zjcUwirWIxf1yJGqQLWlv3aid&AwbNo",
  mapEmbed:
    "https://maps.google.com/maps?q=C140%20SOBO%20Center%2C%20South%20Bopal%2C%20Ahmedabad%20380058%2C%20Gujarat%20India.&t=m&z=15&output=embed&iwloc=near",
  mapLink:
    "https://maps.google.com/?q=C140%20SOBO%20Center%2C%20South%20Bopal%2C%20Ahmedabad%20380058%2C%20Gujarat%20India",
  socials: [
    { label: "Facebook", href: "https://www.facebook.com/" },
    { label: "Instagram", href: "https://www.instagram.com/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/" },
    { label: "X", href: "https://twitter.com/" },
  ],
};

export const navItems = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Partners", href: "#partners" },
  { label: "Pricing", href: "#pricing" },
  { label: "Integrations", href: "#integrations" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
];

export const heroContent = {
  eyebrow: "Courier Aggregation Platform",
  headline: "Faster courier decisions for growing brands that need reliable shipping.",
  subtext:
    "ChoiceMee helps you compare courier rates, automate shipment workflows, track every order, and reduce delivery costs from one clean control center.",
  primaryCta: "Start Shipping",
  secondaryCta: "Book Demo",
  stats: [
    { value: "12+", label: "Years of logistics reliability" },
    { value: "32K+", label: "Packages delivered" },
    { value: "6+", label: "Courier partners onboarded" },
  ],
  image: "", // Removed the legacy image so the new Deep Blue background color displays
};

export const trustStats = [
  { value: "98.4%", label: "On-time delivery visibility" },
  { value: "24/7", label: "Shipment monitoring" },
  { value: "18%", label: "Average shipping savings" },
  { value: "1000+", label: "Satisfied clients served" },
];

export const businessSegments = [
  {
    title: "B2B shipping operations",
    badge: "B2B",
    accent: "from-[#0E3F91]/12 via-[#d7edff]/30 to-[#0E3F91]/5",
    description:
      "Built for distributors, wholesalers, and procurement teams handling high-value shipments across recurring business lanes.",
    points: ["Bulk dispatch scheduling", "Invoice & GST-ready records", "SLA-focused courier allocation"],
  },
  {
    title: "B2C fulfilment at scale",
    badge: "B2C",
    accent: "from-[#F67E14]/12 via-[#ffe5d7]/35 to-[#F67E14]/8",
    description:
      "Optimized for D2C brands and ecommerce teams that need fast delivery, predictable costs, and seamless post-order updates.",
    points: ["Fast checkout-to-ship flow", "Real-time tracking updates", "COD + NDR workflow automation"],
  },
];

export const steps = [
  {
    title: "Register",
    description: "Create your ChoiceMee account and set your shipment preferences in minutes.",
  },
  {
    title: "Add order",
    description: "Upload orders manually, sync from your store, or push them through your APIs.",
  },
  {
    title: "Select courier",
    description:
      "Compare courier rates, SLA, and serviceability to choose the best delivery partner.",
  },
  {
    title: "Ship",
    description:
      "Generate labels, manifest shipments, and monitor every parcel from pickup to delivery.",
  },
];

export const features = [
  {
    title: "Rate comparison",
    badge: "Smart pricing",
    description:
      "Review courier quotes side by side to book the most cost-effective lane in seconds.",
  },
  {
    title: "Tracking",
    badge: "Real-time status",
    description:
      "Track all shipments from a single dashboard with milestone visibility and exception alerts.",
  },
  {
    title: "COD",
    badge: "Remittance visibility",
    description:
      "Monitor cash-on-delivery balances, reconciliation cycles, and payout readiness in one place.",
  },
  {
    title: "NDR",
    badge: "Action workflows",
    description:
      "Handle failed attempts with NDR follow-ups, reattempt logic, and customer response tracking.",
  },
  {
    title: "API integration",
    badge: "Connected stack",
    description:
      "Integrate ChoiceMee into your store, OMS, or warehouse flow with lightweight API connections.",
  },
];

export const courierPartners = [
  { name: "Delhivery", coverage: "Pan-India lanes", accent: "bg-red-500/10 text-red-700" },
  { name: "DTDC", coverage: "Metro + regional reach", accent: "bg-slate-900/10 text-slate-700" },
  { name: "Blue Dart", coverage: "Time-sensitive freight", accent: "bg-amber-500/10 text-amber-700" },
  { name: "Xpressbees", coverage: "D2C fulfilment", accent: "bg-orange-500/10 text-orange-700" },
  { name: "Ecom Express", coverage: "High-volume ecommerce", accent: "bg-emerald-500/10 text-emerald-700" },
  { name: "Shadowfax", coverage: "Hyperlocal & same-day", accent: "bg-indigo-500/10 text-indigo-700" },
];

export const pricingRows = [
  { lane: "Local lane", legacyRate: 118, camplarRate: 94, savings: "Save 20%" },
  { lane: "Regional lane", legacyRate: 168, camplarRate: 139, savings: "Save 17%" },
  { lane: "National lane", legacyRate: 224, camplarRate: 186, savings: "Save 16%" },
];

export const integrations = [
  {
    name: "Shopify",
    description: "Sync orders, update tracking, and keep storefront fulfilment statuses aligned.",
  },
  {
    name: "WooCommerce",
    description: "Import new orders and push shipment milestones back into your commerce workflow.",
    comingSoon: true,
  },
  {
    name: "Amazon",
    description: "Bring marketplace orders into one operational view for faster dispatch decisions.",
    comingSoon: true,
  },
];

export const testimonials = [
  {
    quote:
      "ChoiceMee gave us cleaner courier selection, faster shipping decisions, and a more confident customer experience during peak season.",
    name: "Rohan Mehta",
    role: "Operations Head, TrendyStyles Apparel, Mumbai",
  },
  {
    quote:
      "The team helps us handle urgent deliveries without losing visibility. We finally have one dependable command center for shipping.",
    name: "Priya Sharma",
    role: "Supply Chain Director, GlobalTech Enterprises, Bengaluru",
  },
  {
    quote:
      "We cut manual courier comparisons drastically. Tracking, COD, and NDR are now far easier for our operations team to manage.",
    name: "Arjun Patel",
    role: "Logistics Manager, Tech Innovators, Ahmedabad",
  },
];

export const faqs = [
  {
    question: "What does ChoiceMee help my team do?",
    answer:
      "ChoiceMee combines rate comparison, order processing, tracking, COD visibility, NDR workflows, and integrations into one courier aggregation workflow.",
  },
  {
    question: "Can I calculate shipping costs before I book?",
    answer:
      "Yes. The landing page calculator compares dead weight and volumetric weight with pickup and delivery pincodes so teams can forecast billable shipping costs early.",
  },
  {
    question: "Do you support multiple courier partners?",
    answer:
      "Yes. ChoiceMee is designed to help businesses compare and manage multiple courier partners from one platform.",
  },
  {
    question: "Can ChoiceMee connect with my store?",
    answer:
      "Yes. We position ChoiceMee as a connected platform with integrations for commerce stacks and lightweight API workflows.",
  },
  {
    question: "How do I get started?",
    answer:
      "You can begin by exploring the rate calculator, then book a demo from the contact page to discuss operational requirements with the team.",
  },
];

export const footerGroups = [
  {
    title: "Company",
    links: [
      { label: "Home", href: "#hero", kind: "anchor" },
      { label: "How It Works", href: "#how-it-works", kind: "anchor" },
      { label: "Features", href: "#features", kind: "anchor" },
      { label: "Partners", href: "#partners", kind: "anchor" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "", kind: "coming-soon" },
      { label: "Terms of Service", href: "", kind: "coming-soon" },
      { label: "Refund Policy", href: "", kind: "coming-soon" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: companyInfo.email, href: `mailto:${companyInfo.email}`, kind: "external" },
      {
        label: companyInfo.primaryPhone,
        href: `tel:${companyInfo.primaryPhone.replace(/\s+/g, "")}`,
        kind: "external",
      },
      { label: "Book Demo", href: "/contact", kind: "route" },
      { label: "Track Order", href: companyInfo.trackingUrl, kind: "external" },
    ],
  },
  {
    title: "Socials",
    links: companyInfo.socials.map((item) => ({
      label: item.label,
      href: item.href,
      kind: "external",
    })),
  },
];
