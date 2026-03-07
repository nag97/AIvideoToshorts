import React, { useState } from "react";
import "../styles/navbar.css";

const Navbar = () => {
  const [hoveredItem, setHoveredItem] = useState(null);

  const navItems = [
    "Features",
    "Solutions",
    "Resources",
    "Pricing",
    "For Business",
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-brand">
          <h1 className="logo">
            <span className="logo-gradient">Nagify AI</span>
          </h1>
        </div>

        {/* Navigation Items */}
        <div className="navbar-nav">
          {navItems.map((item) => (
            <div
              key={item}
              className="nav-item-wrapper"
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <button className="nav-item">{item}</button>
              {hoveredItem === item && (
                <div className="tooltip">Coming Soon</div>
              )}
            </div>
          ))}
        </div>

        {/* Auth Buttons */}
        <div className="navbar-auth">
          <button className="btn-signin">Sign In</button>
          <button className="btn-signup">Sign Up – It's Free</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
