import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "@mui/icons-material";
import { BRAND, NAVIGATION } from "../config/branding";
import { motion } from "framer-motion";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <motion.nav
      className="navbar-wrapper"
      initial="hidden"
      animate="visible"
      variants={navVariants}
    >
      <div className="navbar">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          {/* Logo Icon */}
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white font-bold">
            CM
          </div>
          <span className="hidden sm:inline">{BRAND.name}</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex navbar-nav">
          {NAVIGATION.map((item) => (
            <Link key={item.href} to={item.href} className="font-medium">
              {item.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex gap-4">
          <Link to="/track" className="navbar-cta">
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div
          className="md:hidden bg-white border-t border-gray-200 py-4 px-4"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          {NAVIGATION.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="block py-2 text-gray-700 hover:text-blue-600"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/track"
            className="btn-primary mt-4 block w-full text-center"
            onClick={() => setMobileOpen(false)}
          >
            Get Started
          </Link>
        </motion.div>
      )}
    </motion.nav>
  );
}
