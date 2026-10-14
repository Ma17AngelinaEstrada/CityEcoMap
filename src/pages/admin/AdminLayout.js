import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { collection, collectionGroup, getDocs, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import { officeForRole } from "../../constants/offices";
import "./AdminLayout.css";
import { BellIcon } from "../../components/Icons";
import { useAdminTour } from "../../context/AdminTourContext";
import OnboardingTour from "../../components/OnboardingTour";

// Sections of the existing Dashboard page (ids are set in AdminDashboard.js)
const DASHBOARD_SECTIONS = [
  { id: "dash-overview", label: "Report Overview",
    icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6" },
  { id: "dash-coordination", label: "Coordination Overview",
    icon: "M17 3l4 4-4 4 M21 7H9a4 4 0 0 0-4 4 M7 21l-4-4 4-4 M3 17h12a4 4 0 0 0 4-4" },
  { id: "dash-statistics", label: "Report Statistics",
    icon: "M18 20V10 M12 20V4 M6 20v-6" },
  { id: "dash-map", label: "Report Map",
    icon: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" },
  { id: "dash-recent", label: "Recent Reports",
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2" },
];

// Avatar color class per existing admin role (colors are defined in AdminLayout.css).
// Unknown roles get no modifier and keep the original green avatar.
const AVATAR_ROLE_CLASS = {
  "Master Admin": "al2-avatar--master",
  "CENRO Admin": "al2-avatar--cenro",
  "EMB Admin": "al2-avatar--emb",
  "City Engineering Admin": "al2-avatar--engineering",
};

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [currentOffice, setCurrentOffice] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("al2-sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
    const isDashboard = location.pathname === "/admin/dashboard";
  const [dashOpen, setDashOpen] = useState(() => {
    try { return localStorage.getItem("al2-dash-submenu-open") !== "false"; } catch { return true; }
  });
  const toggleDash = () => {
    setDashOpen((o) => {
      const next = !o;
      try { localStorage.setItem("al2-dash-submenu-open", String(next)); } catch {}
      return next;
    });
  };
  const [activeSection, setActiveSection] = useState(DASHBOARD_SECTIONS[0].id);
  const scrollLockRef = useRef(0);

  // Highlight the section currently in view while scrolling the dashboard
  useEffect(() => {
    if (!isDashboard) return;
    const main = document.querySelector(".al2-main");
    if (!main) return;
    const onScroll = () => {
      // ignore scroll events right after a submenu click (smooth scroll in progress)
      if (Date.now() - scrollLockRef.current < 900) return;
      const atBottom = main.scrollTop + main.clientHeight >= main.scrollHeight - 2;
      if (atBottom) {
        setActiveSection(DASHBOARD_SECTIONS[DASHBOARD_SECTIONS.length - 1].id);
        return;
      }
      const line = main.getBoundingClientRect().top + 90;
      let current = DASHBOARD_SECTIONS[0].id;
      for (const s of DASHBOARD_SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActiveSection(current);
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [isDashboard]);

  const handleSectionClick = (id) => {
    // From another page: go to the dashboard first, then scroll once it has loaded
    if (!isDashboard) {
      try { sessionStorage.setItem("al2-pending-section", id); } catch {}
      navigate("/admin/dashboard");
      setMobileOpen(false);
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    scrollLockRef.current = Date.now();
    setActiveSection(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  // After arriving from another page, scroll to the requested section when it appears
  useEffect(() => {
    if (!isDashboard) return;
    let id = null;
    try { id = sessionStorage.getItem("al2-pending-section"); } catch {}
    if (!id) return;
    let tries = 0;
    let raf;
    const attempt = () => {
      const el = document.getElementById(id);
      if (el) {
        try { sessionStorage.removeItem("al2-pending-section"); } catch {}
        scrollLockRef.current = Date.now();
        setActiveSection(id);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (tries++ < 600) raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [isDashboard]);

  const [pendingReports, setPendingReports] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifTab, setNotifTab] = useState('new');

  useEffect(() => {
    if (isMasterAdmin) setNotifTab('activity');
  }, [isMasterAdmin]);
  const [activityItems, setActivityItems] = useState([]);
  const { tourSteps, tourKey, showTour, setShowTour, setCurrentStepIndex } = useAdminTour();

  useEffect(() => {
    let unsubSnapshot = () => {};

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubSnapshot();
      if (!user) {
        setPendingReports([]);
        return;
      }
      const q = query(
        collection(db, "reports"),
        where("status", "==", "Pending"),
        orderBy("createdAt", "desc")
      );
      unsubSnapshot = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setPendingReports(data);
        },
        (err) => {
          console.error("Notification listener error:", err);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubSnapshot();
    };
  }, []);

  useEffect(() => {
    if (currentAdmin === null) return; // hindi pa resolved ang role
    const notifyTarget = isMasterAdmin ? 'MASTER' : currentOffice;
    if (!notifyTarget) return;

    const q = query(
      collectionGroup(db, "statusHistory"),
      where("notifyOffice", "==", notifyTarget),
      orderBy("timestamp", "desc"),
      limit(15)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        reportId: d.ref.parent.parent.id,
        ...d.data(),
      }));
      setActivityItems(items);
    }, (err) => {
      console.error("Activity listener error:", err);
    });

    return () => unsub();
  }, [currentAdmin, isMasterAdmin, currentOffice]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".al2-notif-wrapper")) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const formatNotifDate = (ts) => {
    const date = ts?.toDate?.();
    if (!date) return "";
    return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

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
      if (!user) {
        navigate("/admin");
        return;
      }
      try {
        const snapshot = await getDocs(collection(db, "admins"));
        const current = snapshot.docs.find((d) => d.id === user.uid);
        const data = current?.data();
        setIsMasterAdmin(data?.role === "Master Admin");
        setCurrentAdmin(data || null);
        setCurrentOffice(officeForRole(data?.role));
      } catch (err) {
        console.error("Error checking admin role:", err);
      }
    });
    return () => unsub();
  }, [navigate]);

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

  const visiblePendingReports = isMasterAdmin
    ? pendingReports.filter((r) => r.needsReview === true)
    : pendingReports.filter((r) =>
        r.primaryOffice === currentOffice ||
        (r.jurisdictionCandidates || []).includes(currentOffice)
      );

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
        <button
          className="al2-hamburger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="al2-logo-group">
          <img src="/logowhite2.png" alt="CityEcoMap" className="al2-logo" />
    
        </div>

        <div className="al2-topbar-right">
          {tourSteps.length > 0 && (
            <button
              className="al2-help-btn"
              onClick={() => setShowTour(true)}
              title="Show guide for this page"
            >
              ?
            </button>
          )}

          <div className="al2-notif-wrapper">
            <button className="al2-notif-btn" onClick={(e) => { e.stopPropagation(); setShowNotifs(!showNotifs); }}>
              <BellIcon />
              {(visiblePendingReports.length + activityItems.length) > 0 && (
                <span className="al2-notif-count">{visiblePendingReports.length + activityItems.length}</span>
              )}
            </button>

            {showNotifs && (
              <div className="al2-notif-dropdown">
                <div className="al2-notif-tabs">
                  {!isMasterAdmin && (
                    <button
                      className={`al2-notif-tab ${notifTab === 'new' ? 'al2-notif-tab--active' : ''}`}
                      onClick={() => setNotifTab('new')}
                    >
                      New Reports{visiblePendingReports.length > 0 ? ` (${visiblePendingReports.length})` : ''}
                    </button>
                  )}
                  <button
                    className={`al2-notif-tab ${notifTab === 'activity' ? 'al2-notif-tab--active' : ''}`}
                    onClick={() => setNotifTab('activity')}
                  >
                    Coordination{activityItems.length > 0 ? ` (${activityItems.length})` : ''}
                  </button>
                </div>

                {notifTab === 'new' ? (
                  visiblePendingReports.length === 0 ? (
                    <p className="al2-notif-empty">No new reports.</p>
                  ) : (
                    <>
                      {visiblePendingReports.slice(0, 10).map((r) => (
                        <button
                          key={r.id}
                          className="al2-notif-item"
                          onClick={() => {
                            setShowNotifs(false);
                            navigate(`/admin/reports?report=${r.id}`);
                          }}
                        >
                          <span className="al2-notif-id">#{r.reportId || r.id.slice(0, 6).toUpperCase()}</span>
                          <span className="al2-notif-desc">{r.category}</span>
                          <span className="al2-notif-time">{formatNotifDate(r.createdAt)}</span>
                        </button>
                      ))}
                      {visiblePendingReports.length > 10 && (
                        <button
                          className="al2-notif-viewall"
                          onClick={() => {
                            setShowNotifs(false);
                            navigate("/admin/reports?status=Pending");
                          }}
                        >
                          View all {visiblePendingReports.length} pending reports →
                        </button>
                      )}
                    </>
                  )
                ) : (
                  activityItems.length === 0 ? (
                    <p className="al2-notif-empty">No coordination activity.</p>
                  ) : (
                    activityItems.map((item) => (
                      <button
                        key={item.id}
                        className="al2-notif-item"
                        onClick={() => {
                          setShowNotifs(false);
                          navigate(`/admin/reports?report=${item.reportId}`);
                        }}
                      >
                        <span className="al2-notif-desc">{item.notes || item.action}</span>
                        <span className="al2-notif-time">{formatNotifDate(item.timestamp)}</span>
                      </button>
                    ))
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="al2-body">
        {mobileOpen && (
          <div className="al2-backdrop" onClick={() => setMobileOpen(false)} />
        )}
        {/* Sidebar */}
        <div className={`al2-sidebar-outer ${collapsed ? "al2-sidebar-outer--collapsed" : ""} ${mobileOpen ? "al2-sidebar-outer--mobile-open" : ""}`}>
          <aside
            className={`al2-sidebar ${collapsed ? "al2-sidebar--collapsed" : ""}`}
            style={{
              backgroundImage: `linear-gradient(rgba(26,74,26,0.9), rgba(26,74,26,0.9)), url(${process.env.PUBLIC_URL}/sidebar-bg.jpg)`,
            }}
          >
            {currentAdmin && (
              <div className="al2-profile">
                <div className={`al2-avatar ${AVATAR_ROLE_CLASS[currentAdmin.role] || ""}`}>{getInitials(currentAdmin.name)}</div>
                {(!collapsed || mobileOpen) && (
                  <div className="al2-profile-info">
                    <span className="al2-profile-name">{currentAdmin.name}</span>
                    <span className="al2-profile-role">{currentAdmin.role}</span>
                  </div>
                )}
              </div>
            )}

            <nav className="al2-nav">
              {visibleNavItems.map((item) => {
                const isDashItem = item.path === "/admin/dashboard";
                const showLabels = !collapsed || mobileOpen;
                const itemButton = (
                  <button
                    className={`al2-nav-item ${location.pathname === item.path ? "al2-nav-item--active" : ""}`}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="al2-nav-icon">{item.icon}</span>
                    {showLabels && <span>{item.label}</span>}
                    {item.path === "/admin/reports" && visiblePendingReports.length > 0 && (
                      <span className="al2-nav-badge">{visiblePendingReports.length}</span>
                    )}
                  </button>
                );

                if (!isDashItem) return <Fragment key={item.path}>{itemButton}</Fragment>;

                // Icon-only (collapsed) sidebar always shows the compact submenu
                const showSubmenu = !showLabels || dashOpen;
                return (
                  <Fragment key={item.path}>
                    <div className="al2-nav-row">
                      {itemButton}
                      {showLabels && (
                        <button
                          className="al2-nav-chevron-btn"
                          onClick={toggleDash}
                          aria-expanded={dashOpen}
                          aria-label={dashOpen ? "Collapse dashboard sections" : "Expand dashboard sections"}
                          title={dashOpen ? "Collapse sections" : "Expand sections"}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {showSubmenu && (
                      <div className={`al2-submenu ${showLabels ? "" : "al2-submenu--compact"}`}>
                        {DASHBOARD_SECTIONS.map((s) => (
                          <button
                            key={s.id}
                            className={`al2-submenu-item ${isDashboard && activeSection === s.id ? "al2-submenu-item--active" : ""}`}
                            onClick={() => handleSectionClick(s.id)}
                            title={s.label}
                          >
                            <svg className="al2-submenu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d={s.icon} />
                            </svg>
                            {showLabels && <span>{s.label}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </nav>
            <button className="al2-logout" onClick={handleLogout} title={collapsed ? "Logout" : undefined}>
              <span className="al2-nav-icon">{icons.logout}</span>
              {(!collapsed || mobileOpen) && <span>Logout</span>}
            </button>
          </aside>

          <button
            className="al2-collapse-btn"
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              localStorage.setItem("al2-sidebar-collapsed", next);
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
            </svg>
          </button>
        </div>

        {/* Page content */}
        <main className="al2-main">
          {children}
        </main>
      </div>

      {showTour && tourSteps.length > 0 && (
        <OnboardingTour
          steps={tourSteps}
          onFinish={() => { setShowTour(false); setCurrentStepIndex(0); }}
          storageKey={tourKey}
          onStepChange={setCurrentStepIndex}
        />
      )}
    </div>
  );
}