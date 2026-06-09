import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import "./AdminLayout.css";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/admin");
  };

  const navItems = [
    { label: "Dashboard", path: "/admin/dashboard" },
    { label: "Manage & Resolve Reports", path: "/admin/reports" },
    { label: "Generate & Export Reports", path: "/admin/export" },
    { label: "Manage Users", path: "/admin/users" },
  ];

  return (
    <div className="al2-wrapper">
      {/* Top navbar */}
      <header className="al2-topbar">
        <img src="/logogreen2.png" alt="CityEcoMap" className="al2-logo" />
        <div className="al2-hamburger">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </header>

      <div className="al2-body">
        {/* Sidebar */}
        <aside className="al2-sidebar">
          <nav className="al2-nav">
            {navItems.map((item) => (
              <button
                key={item.path}
                className={`al2-nav-item ${location.pathname === item.path ? "al2-nav-item--active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button className="al2-logout" onClick={handleLogout}>Logout</button>
        </aside>

        {/* Page content */}
        <main className="al2-main">
          {children}
        </main>
      </div>
    </div>
  );
}