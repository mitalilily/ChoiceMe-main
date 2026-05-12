import { useEffect } from "react";
import { motion } from "framer-motion";
import { Star } from "@mui/icons-material";
import { FEATURES, TESTIMONIALS, STATS, HOW_IT_WORKS, COURIER_PARTNERS } from "../config/branding";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export default function HomePage() {
  useEffect(() => {
    document.title = "ChoiceMe Courier - Fastest Shipping Across India";
  }, []);

  return (
    <div className="site-shell">
      {/* Hero Section */}
      <motion.section
        className="hero-section container-base"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div className="hero-content" variants={itemVariants}>
          <div className="hero-badge">
            <span>🚀 Welcome to Premium Logistics</span>
          </div>

          <h1 className="hero-title">
            Fastest Shipping Across <span className="text-accent-500">India</span>
          </h1>

          <p className="hero-subtitle">
            Ship Smarter. Deliver Faster. Trust ChoiceMe Courier for reliable
            logistics solutions with real-time tracking and transparent pricing.
          </p>

          <div className="hero-buttons">
            <a href="#tracking" className="btn-primary">
              Start Shipping
            </a>
            <a href="#track-section" className="btn-outline">
              Track Order
            </a>
          </div>

          {/* Features Badge Row */}
          <motion.div
            className="mt-8 pt-8 border-t border-gray-200 flex flex-wrap gap-4"
            variants={itemVariants}
          >
            {[
              { label: "99% On-Time", icon: "✓" },
              { label: "24/7 Support", icon: "🤝" },
              { label: "Pan India Coverage", icon: "🗺️" },
            ].map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-accent-500 font-bold text-lg">{badge.icon}</span>
                <span className="text-sm font-medium text-gray-700">{badge.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Hero Visual */}
        <motion.div className="hero-visual" variants={itemVariants}>
          <motion.div
            className="relative w-full h-full flex items-center justify-center"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            {/* Animated 3D Box Illustration */}
            <div className="relative w-64 h-64">
              {/* Main Box */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-accent-500 to-orange-600 rounded-2xl shadow-2xl"
                style={{
                  perspective: "1200px",
                }}
                animate={{
                  rotateX: [0, 10, 0],
                  rotateY: [0, 15, 0],
                }}
                transition={{ duration: 5, repeat: Infinity }}
              >
                {/* Box Interior */}
                <div className="absolute inset-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-6xl">📦</span>
                </div>
              </motion.div>

              {/* Floating Delivery Truck */}
              <motion.div
                className="absolute -right-20 bottom-10"
                animate={{ x: [0, 30, 0], y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <div className="text-6xl">🚚</div>
              </motion.div>

              {/* Map Pin */}
              <motion.div
                className="absolute -top-10 right-10"
                animate={{ scale: [1, 1.2, 1], rotate: [0, 5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="text-5xl">📍</div>
              </motion.div>

              {/* Cursor/Route */}
              <motion.div
                className="absolute top-0 left-0 w-full h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <svg
                  className="w-full h-full"
                  viewBox="0 0 256 256"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <motion.path
                    d="M20 100 Q 120 50, 200 100"
                    className="text-secondary-500"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </svg>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Courier Partners Section */}
      <motion.section
        className="section section-light"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="container-base">
          <p className="text-center text-gray-600 mb-8 font-medium">
            Trusted by leading courier partners across India
          </p>
          <motion.div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6"
            variants={containerVariants}
          >
            {COURIER_PARTNERS.map((partner, idx) => (
              <motion.div
                key={idx}
                className="flex items-center justify-center p-4 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
                variants={itemVariants}
              >
                <div className="font-bold text-accent-500 text-xl">{partner.logo}</div>
                <div className="ml-2 text-sm font-medium text-gray-700">{partner.name}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* How It Works Section */}
      <motion.section
        className="section bg-white"
        id="how-it-works"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="container-base">
          <motion.div className="mb-12" variants={itemVariants}>
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">
              Ship your packages in just 4 simple steps
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-4 gap-6"
            variants={containerVariants}
          >
            {HOW_IT_WORKS.map((item, idx) => (
              <motion.div
                key={idx}
                className="card relative"
                variants={itemVariants}
              >
                <motion.div className="text-4xl mb-4">{item.icon}</motion.div>
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-accent-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="card-title">{item.title}</h3>
                <p className="card-text">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        className="section section-dark"
        id="features"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="container-base">
          <motion.div className="mb-12" variants={itemVariants}>
            <h2 className="section-title text-white">Premium Features</h2>
            <p className="section-subtitle text-gray-300">
              Everything you need for seamless shipping experience
            </p>
          </motion.div>

          <motion.div
            className="section-grid"
            variants={containerVariants}
          >
            {FEATURES.map((feature) => (
              <motion.div
                key={feature.id}
                className="card card-dark"
                variants={itemVariants}
                whileHover={{ y: -5 }}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="card-title">{feature.title}</h3>
                <p className="card-text">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section
        className="section bg-gradient-to-r from-primary-600 to-primary-800"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="container-base">
          <motion.div
            className="grid md:grid-cols-4 gap-8"
            variants={containerVariants}
          >
            {STATS.map((stat, idx) => (
              <motion.div
                key={idx}
                className="text-center"
                variants={itemVariants}
              >
                <div className="text-5xl mb-4">{stat.icon}</div>
                <motion.div
                  className="text-4xl font-bold text-white mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: idx * 0.1 }}
                >
                  {stat.value}
                </motion.div>
                <p className="text-gray-200">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Testimonials Section */}
      <motion.section
        className="section bg-white"
        id="testimonials"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="container-base">
          <motion.div className="mb-12" variants={itemVariants}>
            <h2 className="section-title">What Our Customers Say</h2>
            <p className="section-subtitle">
              Real reviews from businesses using ChoiceMe Courier
            </p>
          </motion.div>

          <motion.div
            className="section-grid"
            variants={containerVariants}
          >
            {TESTIMONIALS.map((testimonial) => (
              <motion.div
                key={testimonial.id}
                className="card"
                variants={itemVariants}
                whileHover={{ y: -8 }}
              >
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5"
                      style={{
                        fill: i < testimonial.rating ? "#ff6b35" : "#e0e0e0",
                        color: i < testimonial.rating ? "#ff6b35" : "#e0e0e0",
                      }}
                    />
                  ))}
                </div>
                <p className="card-text mb-4">"{testimonial.text}"</p>
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.company}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        className="section bg-gradient-to-r from-accent-500 to-orange-600"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="container-base text-center">
          <motion.div variants={itemVariants}>
            <h2 className="section-title text-white">Ready to Ship?</h2>
            <p className="section-subtitle text-white/90 max-w-2xl mx-auto">
              Join thousands of businesses that trust ChoiceMe Courier for their
              shipping needs
            </p>
            <motion.a
              href="/rate"
              className="btn-primary mt-8 bg-white text-accent-500 hover:bg-gray-100"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started Now
            </motion.a>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
