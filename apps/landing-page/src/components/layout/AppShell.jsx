import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import Navbar from "./Navbar";

export default function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-background">
        <span className="app-background__orb app-background__orb--one" />
        <span className="app-background__orb app-background__orb--two" />
        <span className="app-background__orb app-background__orb--three" />
      </div>
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
