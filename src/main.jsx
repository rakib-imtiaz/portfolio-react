import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Nav, ScrollToTop, ThemeCtx } from "./components";
import { THEMES, applyTheme, loadThemeIndex } from "./themes";
import Home from "./pages/Home";
import Work from "./pages/Work";
import Shopify from "./pages/Shopify";
import Systems from "./pages/Systems";
import Contact from "./pages/Contact";
import "./styles.css";

function App() {
  const [themeIndex, setThemeIndex] = useState(loadThemeIndex);

  useEffect(() => { applyTheme(themeIndex); }, [themeIndex]);

  const cycleTheme = useCallback(() => {
    setThemeIndex((i) => (i + 1) % THEMES.length);
  }, []);

  return (
    <ThemeCtx.Provider value={{ themeIndex, cycleTheme }}>
      <BrowserRouter>
        <ScrollToTop />
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<Work />} />
          <Route path="/shopify" element={<Shopify />} />
          <Route path="/systems" element={<Systems />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </ThemeCtx.Provider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
