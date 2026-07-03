import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import "./AdminLayout.css";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const snapshot = await getDocs(collection(db, "admins"));
        const current = snapshot.docs.find((d) => d.id === user.uid);
        const data = current?.data();
        setIsMasterAdmin(data?.role === "Master Admin");
        setCurrentAdmin(data || null);
      } catch (err) {
        console.error("Error checking admin role:", err);
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/admin");
  };

  const navItems = [
    { label: "Dashboard", path: "/admin/dashboard" },
    { label: "Manage & Resolve Reports", path: "/admin/reports" },
    { label: "Generate & Export Reports", path: "/admin/export" },
    { label: "Manage Users", path: "/admin/users", masterOnly: true },
  ];

  const visibleNavItems = navItems.filter((item) => !item.masterOnly || isMasterAdmin);

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="al2-wrapper">
      {/* Top navbar */}
      <header className="al2-topbar">
        <img src="/logogreen2.png" alt="CityEcoMap" className="al2-logo" />
      </header>

      <div className="al2-body">
        {/* Sidebar */}
        <aside className="al2-sidebar">
          {currentAdmin && (
            <div className="al2-profile">
              <div className="al2-avatar">{getInitials(currentAdmin.name)}</div>
              <div className="al2-profile-info">
                <span className="al2-profile-name">{currentAdmin.name}</span>
                <span className="al2-profile-role">{currentAdmin.role}</span>
              </div>
            </div>
          )}

          <nav className="al2-nav">
            {visibleNavItems.map((item) => (
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