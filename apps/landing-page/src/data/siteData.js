export const brand = {
  name: "ChoiceMee Logistics",
  logoSrc: "/brand/choicemee-logistics-logo.png",
  logoAlt: "ChoiceMee Logistics logo",
  phone: "9906690088",
  address: "Baramulla, Jammu & Kashmir, 193123",
  email: "ops@choicemee.com",
  headline: "Fastest Shipping Across India",
  subheadline: "Your Trust, Our Commitment",
  heroBadge: "ChoiceMee Logistics for modern shipping teams",
};

export const navLinks = [
  { label: "Home", to: "/" },
  { label: "Tracking", to: "/tracking" },
  { label: "Rate Calculator", to: "/rate-calculator" },
  { label: "Weight Calculator", to: "/weight-calculator" },
];

export const heroHighlights = [
  { value: "27+", label: "Courier networks orchestrated" },
  { value: "98.7%", label: "On-time delivery visibility" },
  { value: "4.2M", label: "Annual shipment capacity" },
];

export const partnerLogos = [
  {
    name: "Delhivery",
    src: "/partner-logos/delhivery.png",
    className: "h-8 md:h-12 w-auto object-contain",
  },
  {
    name: "Blue Dart",
    src: "/partner-logos/blue-dart.png",
    className: "h-8 md:h-12 w-auto object-contain",
  },
  {
    name: "Shadowfax",
    src: "/partner-logos/shadowfax.png",
    className: "h-8 md:h-12 w-auto object-contain",
  },
  {
    name: "Xpressbees",
    src: "/partner-logos/xpressbees.png",
    className: "h-8 md:h-12 w-auto object-contain",
  },
  {
    name: "Ekart",
    src: "/partner-logos/ekart.webp",
    className: "h-8 md:h-12 w-auto object-contain",
  },
  {
    name: "India Post",
    src: "/partner-logos/india-post-mark.svg",
    className: "h-8 md:h-12 w-auto object-contain",
  },
];

export const howItWorks = [
  {
    title: "Connect your orders",
    description:
      "Bring store, marketplace, and offline orders into one premium operations layer with clean validations.",
  },
  {
    title: "Compare live-ready rates",
    description:
      "Evaluate courier options by lane, SLA, payment mode, and volumetric weight before you commit.",
  },
  {
    title: "Dispatch with confidence",
    description:
      "Generate labels, assign pickups, and move parcels with real-time milestone updates and exception flags.",
  },
  {
    title: "Track every promise",
    description:
      "Keep customers and teams aligned with a motion-rich timeline from order creation to doorstep delivery.",
  },
];

export const featureCards = [
  {
    title: "Smart Courier Routing",
    description:
      "We pick the best courier for each package based on delivery speed, cost, and what's available. Your shipments always take the smartest route.",
    badge: "Intelligent Routing",
  },
  {
    title: "One Place to Track Everything",
    description:
      "See all your shipments in one beautiful timeline. Know exactly where every package is, every step of the way. No more searching multiple apps.",
    badge: "Complete Visibility",
  },
  {
    title: "Payment Made Simple",
    description:
      "Whether you're collecting cash on delivery or paying upfront, we handle it all smoothly. See your money and shipments in one dashboard.",
    badge: "Simple Payments",
  },
  {
    title: "Plug Into Your System",
    description:
      "Use our simple APIs to connect with your store, app, warehouse system, or anything else. Works with your existing setup.",
    badge: "Easy Integration",
  },
];

export const statsGrid = [
  { label: "Shipments delivered every month", value: 182000, suffix: "+" },
  { label: "Time to print a shipping label", value: 11, suffix: " min" },
  { label: "Cities we cover", value: 19000, suffix: "+" },
  { label: "Customer support response time", value: 15, suffix: " min" },
];

export const dashboardPoints = [
  "See live shipments and what's happening right now across your network",
  "Different team members see only what they need - drivers see pickups, managers see reports",
  "Build your own tools with our APIs - add tracking to your store or connect to your ERP",
];

export const testimonials = [
  {
    quote:
      "ChoiceMee gave us a premium control tower feel without operational complexity. Our shipping team now books faster and escalates less.",
    name: "Aaliya Khan",
    role: "Head of Operations, NorthGrid Commerce",
  },
  {
    quote:
      "The tracking experience feels enterprise-grade. Customers see polished delivery milestones while our team gets the data depth we need.",
    name: "Rohit Sharma",
    role: "Logistics Lead, UrbanCart India",
  },
  {
    quote:
      "Rate comparison and volumetric handling are finally clear. That alone reduced misquotes and dispatch confusion for us.",
    name: "Meera Kaul",
    role: "Founder, Valley Home Studio",
  },
];

export const trackingSamples = [
  {
    trackingId: "CMC78254019",
    orderId: "ORD-11892",
    customer: "Sana Mir",
    courier: "Delhivery Surface",
    destination: "Srinagar, Jammu & Kashmir",
    eta: "Today, 6:30 PM",
    status: "Out for delivery",
    paymentType: "COD",
    timeline: [
      {
        key: "placed",
        title: "Order placed",
        note: "Shipment booked on the ChoiceMee dashboard",
        location: "Baramulla Hub",
        time: "09 Apr 2026, 09:12 AM",
      },
      {
        key: "dispatched",
        title: "Dispatched",
        note: "Parcel transferred to primary linehaul network",
        location: "Baramulla Dispatch Center",
        time: "09 Apr 2026, 12:20 PM",
      },
      {
        key: "transit",
        title: "In transit",
        note: "Shipment is moving through the north region route",
        location: "Srinagar Gateway",
        time: "09 Apr 2026, 09:45 PM",
      },
      {
        key: "ofd",
        title: "Out for delivery",
        note: "Driver assigned and final doorstep attempt is in progress",
        location: "Srinagar Local Delivery Center",
        time: "10 Apr 2026, 08:10 AM",
      },
      {
        key: "delivered",
        title: "Delivered",
        note: "Awaiting final scan",
        location: "Destination",
        time: "Pending",
      },
    ],
  },
  {
    trackingId: "CMC11984027",
    orderId: "ORD-10478",
    customer: "Aman Gupta",
    courier: "Blue Dart Express",
    destination: "Noida, Uttar Pradesh",
    eta: "Delivered on 08 Apr 2026",
    status: "Delivered",
    paymentType: "Prepaid",
    timeline: [
      {
        key: "placed",
        title: "Order placed",
        note: "Shipment registered through the seller control panel",
        location: "Delhi NCR Fulfillment",
        time: "07 Apr 2026, 08:02 AM",
      },
      {
        key: "dispatched",
        title: "Dispatched",
        note: "Picked and manifested for express movement",
        location: "Delhi Sorting Hub",
        time: "07 Apr 2026, 11:40 AM",
      },
      {
        key: "transit",
        title: "In transit",
        note: "Reached destination gateway without exception",
        location: "Noida Gateway",
        time: "07 Apr 2026, 09:50 PM",
      },
      {
        key: "ofd",
        title: "Out for delivery",
        note: "Delivery route was allocated successfully",
        location: "Noida Local Center",
        time: "08 Apr 2026, 08:11 AM",
      },
      {
        key: "delivered",
        title: "Delivered",
        note: "Customer accepted the parcel",
        location: "Noida Sector 62",
        time: "08 Apr 2026, 02:36 PM",
      },
    ],
  },
];

export const pageArtwork = {
  weightHero: {
    src: "/page-art/weight1-clean.png",
    alt: "Courier measuring a parcel for volumetric weight.",
  },
  weightGuide: {
    src: "/page-art/weight2-clean.png",
    alt: "Parcel dimension guide showing length, breadth, and height.",
  },
  trackingHero: {
    src: "/page-art/track1-hd.png",
    alt: "Logistics tracking illustration with a route map and delivery truck.",
  },
  trackingAside: {
    src: "/page-art/track1-hd-flip.png",
    alt: "Shipment visibility illustration with route tracking and delivery activity.",
  },
  rateHero: {
    src: "/page-art/shipping-calculator.webp",
    alt: "Shipping calculator illustration with invoices and mobile calculator.",
    className: "page-art--blend",
  },
  rateGuide: {
    src: "/page-art/calc2-clean.png",
    alt: "Delivery truck carrying a parcel with a destination pin.",
  },
};

export const defaultRateForm = {
  originPincode: "193123",
  destinationPincode: "190001",
  weight: "1.2",
  length: "28",
  breadth: "22",
  height: "16",
  paymentType: "Prepaid",
};

export const paymentModes = ["Prepaid", "COD"];

export const defaultWeightForm = {
  length: 32,
  breadth: 24,
  height: 18,
  actualWeight: 1.8,
};

export const rateGuideSteps = [
  {
    label: "Step 1",
    title: "Enter the origin and destination pincodes",
    description:
      "Start with the pickup and delivery pincodes so the calculator can detect the lane and estimate the service zone.",
  },
  {
    label: "Step 2",
    title: "Add parcel weight and dimensions",
    description:
      "Fill in the actual weight along with the parcel length, breadth, and height to calculate the correct billable weight.",
  },
  {
    label: "Step 3",
    title: "Choose the payment type",
    description:
      "Switch between Prepaid and COD to see how payment mode can affect the final courier quote.",
  },
  {
    label: "Step 4",
    title: "Compare the courier options",
    description:
      "Submit the form to review the available courier partners, their pricing, and the most suitable option for that shipment.",
  },
];

export const weightGuideSteps = [
  {
    label: "Step 1",
    title: "Measure the parcel carefully",
    description:
      "Enter the parcel length, breadth, and height in centimeters using either the sliders or the input fields.",
  },
  {
    label: "Step 2",
    title: "Add the actual scale weight",
    description:
      "Provide the real package weight in kilograms so the calculator can compare physical weight with volumetric weight.",
  },
  {
    label: "Step 3",
    title: "Review the billable result",
    description:
      "The system calculates volumetric weight automatically and shows which value will be used for billing.",
  },
  {
    label: "Step 4",
    title: "Optimize the packaging if needed",
    description:
      "If the volumetric number is higher, reducing empty space in the packaging can lower the billable weight.",
  },
];

export const footerGroups = [
  {
    title: "Platform",
    links: [
      { label: "Home", to: "/" },
      { label: "Tracking", to: "/tracking" },
      { label: "Rate Calculator", to: "/rate-calculator" },
      { label: "Weight Calculator", to: "/weight-calculator" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Portal Login", to: "/login" },
      { label: "Contact", to: "/contact" },
      { label: "API-ready stack", to: "/rate-calculator" },
    ],
  },
];

export const socialLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/" },
  { label: "Instagram", href: "https://www.instagram.com/" },
  { label: "Facebook", href: "https://www.facebook.com/" },
];
