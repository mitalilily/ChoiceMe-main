import { Link } from "react-router-dom";
import { Facebook, Twitter, LinkedIn, Instagram } from "@mui/icons-material";
import { BRAND, NAVIGATION, SOCIAL_LINKS } from "../config/branding";
import { motion } from "framer-motion";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const getSocialIcon = (iconType) => {
    const iconProps = { className: "w-5 h-5" };
    switch (iconType) {
      case "facebook":
        return <Facebook {...iconProps} />;
      case "twitter":
        return <Twitter {...iconProps} />;
      case "linkedin":
        return <LinkedIn {...iconProps} />;
      case "instagram":
        return <Instagram {...iconProps} />;
      default:
        return null;
    }
  };

  return (
    <motion.footer
      className="footer"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={containerVariants}
    >
      <motion.div className="footer-grid" variants={itemVariants}>
        {/* Company Info */}
        <div className="footer-section">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-lg flex items-center justify-center text-primary-900 font-bold">
              CM
            </div>
            <h3 className="text-lg font-bold">{BRAND.name}</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">{BRAND.shortDescription}</p>
          <div className="flex gap-3">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-accent-500 transition-colors"
                title={link.name}
              >
                {getSocialIcon(link.icon)}
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-section">
          <h4>Quick Links</h4>
          <ul>
            {NAVIGATION.map((item) => (
              <li key={item.href}>
                <Link to={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Services */}
        <div className="footer-section">
          <h4>Services</h4>
          <ul>
            <li>
              <a href="#features">Shipping Solutions</a>
            </li>
            <li>
              <a href="#tracking">Track Shipment</a>
            </li>
            <li>
              <a href="#rate">Rate Calculator</a>
            </li>
            <li>
              <a href="#weight">Weight Calculator</a>
            </li>
            <li>
              <a href="#contact">Contact Us</a>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="footer-section">
          <h4>Contact</h4>
          <ul>
            <li>
              <a href={`tel:${BRAND.phone}`}>{BRAND.phone}</a>
            </li>
            <li>
              <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
            </li>
            <li className="text-sm mt-4">
              <strong>Address:</strong> <br /> {BRAND.address}
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Footer Bottom */}
      <motion.div className="footer-bottom" variants={itemVariants}>
        <p>
          &copy; {currentYear} {BRAND.name}. All rights reserved. | Designed
          & Built with care for premium logistics.
        </p>
      </motion.div>
    </motion.footer>
  );
}
