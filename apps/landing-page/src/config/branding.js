/**
 * Branding Configuration for ChoiceMee
 */

export const BRAND = {
  name: "ChoiceMee",
  tagline: "Your trust, Our Commitment",
  phone: "9906690088",
  address: "Baramulla, Jammu & Kashmir, 193123",
  email: "info@choicemee.com",
  shortDescription: "Premium logistics platform for reliable and fast shipping across India",
};

export const COLORS = {
  primary: {
    900: "#061c41",
    800: "#082a62",
    700: "#0b357d",
    600: "#0c3a8a",
    500: "#0E3F91",
  },
  secondary: {
    500: "#F67E14",
    400: "#f79134",
    300: "#f8a355",
  },
  accent: {
    500: "#F67E14",
    400: "#f79134",
  },
  neutral: {
    white: "#ffffff",
    light: "#f8fafc",
    gray: "#64748b",
    dark: "#0f1729",
  },
};

export const NAVIGATION = [
  { label: "Home", href: "/" },
  { label: "Track", href: "/track" },
  { label: "Rate", href: "/rate" },
  { label: "Weight Calculator", href: "/weight" },
  { label: "Contact", href: "/contact" },
];

export const SOCIAL_LINKS = [
  { name: "Facebook", url: "#", icon: "facebook" },
  { name: "Twitter", url: "#", icon: "twitter" },
  { name: "LinkedIn", url: "#", icon: "linkedin" },
  { name: "Instagram", url: "#", icon: "instagram" },
];

export const FEATURES = [
  {
    id: 1,
    title: "Fast Delivery",
    description: "Fastest courier services across India with real-time tracking and updates",
    icon: "🚚",
  },
  {
    id: 2,
    title: "Secure Packaging",
    description: "Professional packaging ensures your goods reach safely and on time",
    icon: "📦",
  },
  {
    id: 3,
    title: "Real-time Tracking",
    description: "Track your shipments in real-time with comprehensive delivery updates",
    icon: "📍",
  },
  {
    id: 4,
    title: "Affordable Rates",
    description: "Competitive pricing with transparent billing and no hidden charges",
    icon: "💰",
  },
  {
    id: 5,
    title: "Expert Support",
    description: "24/7 dedicated customer support for all your shipping needs",
    icon: "👥",
  },
  {
    id: 6,
    title: "Wide Coverage",
    description: "Delivery services available to all major cities and pincode areas in India",
    icon: "🗺️",
  },
];

export const TESTIMONIALS = [
  {
    id: 1,
    name: "Rajesh Kumar",
    company: "TechStart India",
    text: "ChoiceMee has been incredibly reliable for our e-commerce operations. Highly recommended!",
    rating: 5,
  },
  {
    id: 2,
    name: "Priya Sharma",
    company: "Fashion Boutique",
    text: "Best shipping partner we've had. Fast, reliable, and customer support is outstanding.",
    rating: 5,
  },
  {
    id: 3,
    name: "Amit Patel",
    company: "Books & Beyond",
    text: "The rate calculator tool is incredibly helpful. Makes pricing transparent and easy.",
    rating: 4,
  },
];

export const COURIER_PARTNERS = [
  { name: "Express Logistics", logo: "EL" },
  { name: "Speed Shipping", logo: "SS" },
  { name: "Prime Delivery", logo: "PD" },
  { name: "FastTrack", logo: "FT" },
  { name: "Swift Courier", logo: "SC" },
  { name: "Global Logistics", logo: "GL" },
];

export const STATS = [
  { label: "Shipments Delivered", value: "500K+", icon: "📦" },
  { label: "Cities Covered", value: "1000+", icon: "🗺️" },
  { label: "Happy Customers", value: "50K+", icon: "😊" },
  { label: "On-time Delivery", value: "99%", icon: "✅" },
];

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Enter Details",
    description: "Provide shipment details such as origin, destination, and package size",
    icon: "📝",
  },
  {
    step: 2,
    title: "Get Quote",
    description: "Instantly receive multiple courier options with transparent pricing",
    icon: "💡",
  },
  {
    step: 3,
    title: "Book Shipment",
    description: "Select your preferred courier and book your shipment in seconds",
    icon: "✅",
  },
  {
    step: 4,
    title: "Track Delivery",
    description: "Monitor your shipment in real-time until it reaches the destination",
    icon: "🚀",
  },
];

export const TRACKING_STATUSES = [
  { step: 1, status: "Order Placed", description: "Your shipment has been registered" },
  { step: 2, status: "Dispatched", description: "Package picked up from origin" },
  { step: 3, status: "In Transit", description: "Package is on its way to destination" },
  { step: 4, status: "Out for Delivery", description: "Package is with delivery partner" },
  { step: 5, status: "Delivered", description: "Package delivered successfully" },
];
