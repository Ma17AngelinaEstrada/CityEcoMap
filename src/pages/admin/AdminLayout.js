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
  const [collapsed, setCollapsed] = useState(false);

  const icons = {
    dashboard: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
    reports: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </svg>
    ),
    export: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
      </svg>
    ),
    users: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="7" r="4" />
        <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
        <path d="M16 3.5a4 4 0 0 1 0 7" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
    logout: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    ),
  };

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
    { label: "Dashboard", path: "/admin/dashboard", icon: icons.dashboard },
    { label: "Manage & Resolve Reports", path: "/admin/reports", icon: icons.reports },
    { label: "Generate & Export Reports", path: "/admin/export", icon: icons.export },
    { label: "Manage Users", path: "/admin/users", icon: icons.users, masterOnly: true },
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
        <aside className={`al2-sidebar ${collapsed ? "al2-sidebar--collapsed" : ""}`}>
          <button
            className="al2-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "»" : "«"}
          </button>

          {currentAdmin && (
            <div className="al2-profile">
              <div className="al2-avatar">{getInitials(currentAdmin.name)}</div>
              {!collapsed && (
                <div className="al2-profile-info">
                  <span className="al2-profile-name">{currentAdmin.name}</span>
                  <span className="al2-profile-role">{currentAdmin.role}</span>
                </div>
              )}
            </div>
          )}

          <nav className="al2-nav">
            {visibleNavItems.map((item) => (
              <button
                key={item.path}
                className={`al2-nav-item ${location.pathname === item.path ? "al2-nav-item--active" : ""}`}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
              >
                <span className="al2-nav-icon">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
          <button className="al2-logout" onClick={handleLogout} title={collapsed ? "Logout" : undefined}>
            <span className="al2-nav-icon">{icons.logout}</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </aside>

        {/* Page content */}
        <main className="al2-main">
          {children}
        </main>
      </div>
    </div>
  );
}