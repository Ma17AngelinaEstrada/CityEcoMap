import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import AdminLayout from "./AdminLayout";
import "./ManageUsers.css";
import { useAdminTour } from "../../context/AdminTourContext";
import { OFFICE_ROLES, roleLabel } from "../../constants/offices";
import { EyeIcon, EyeOffIcon } from "../../components/Icons";

// Secondary Firebase app to create users without signing out current admin
const secondaryApp = initializeApp({
  apiKey: "AIzaSyCrRKehfrM-rocQXJZkCWYSWu9svKHlnoY",
  authDomain: "cityecomap.firebaseapp.com",
  projectId: "cityecomap",
  storageBucket: "cityecomap.firebasestorage.app",
  messagingSenderId: "774663597426",
  appId: "1:774663597426:web:e7ff0cbd018dfbad5041eb"
}, "Secondary");

const secondaryAuth = getAuth(secondaryApp);

const MASTER_TOUR_STEPS = [
  {
    selector: '.mu-table-card',
    title: 'Admin Accounts',
    description: 'View all admin accounts, their role (Master or Regular Admin), and their status.',
  },
  {
    selector: '.mu-create-btn',
    title: 'Add a New Admin',
    description: 'Click here to create a new admin account with a name, email, password, and role.',
  },
  {
    selector: '.mu-modal',
    title: 'Admin Account Form',
    description: 'This is a sample preview of the form used to create or edit an admin account.',
  },
  {
    selector: '.mu-actions',
    title: 'Edit or Deactivate',
    description: 'Use these buttons to edit an admin\u2019s name/role, or deactivate their account. You cannot deactivate your own account.',
  },
];

const REGULAR_TOUR_STEPS = [
  {
    selector: '.mu-table-card',
    title: 'Admin Accounts',
    description: 'View all admin accounts, their role, and their status. Only Master Admins can create, edit, or deactivate accounts.',
  },
];

export default function ManageUsers() {
  const navigate = useNavigate();
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const { registerTour, showTour, currentStepIndex } = useAdminTour();
  const isMasterAdmin = currentAdmin?.role === "Master Admin";

  // isMasterAdmin is resolved asynchronously via fetchAdmins() — re-register
  // whenever it changes, so the tour matches what the current admin can see
  useEffect(() => {
    if (currentAdmin === null) return; // not resolved yet
    registerTour(
      isMasterAdmin ? MASTER_TOUR_STEPS : REGULAR_TOUR_STEPS,
      'cityecomap_admin_tour_seen_users'
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin, isMasterAdmin]);

  // Step index (within MASTER_TOUR_STEPS) where the sample create/edit form
  // should be shown — only relevant for Master Admins
  const SAMPLE_MODAL_STEP_INDEX = 2;

  useEffect(() => {
    if (!isMasterAdmin) return;
    if (showTour && currentStepIndex === SAMPLE_MODAL_STEP_INDEX) {
      setEditingAdmin(null);
      setFormData({ name: "Juan Dela Cruz", email: "juan.delacruz@example.com", password: "", role: "CENRO Admin"});
      setFormError("");
      setShowModal(true);
    } else if (showModal) {
      setShowModal(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTour, currentStepIndex, isMasterAdmin]);

  // Start every form open with hidden, empty password fields.
  useEffect(() => {
    if (!showModal) {
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [showModal]);

  useEffect(() => {
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) { navigate("/admin"); return; }
        fetchAdmins(user.uid);
      });
      return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

  const fetchAdmins = async (currentUid) => {
      try {
        const snapshot = await getDocs(collection(db, "admins"));
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const current = data.find((a) => a.id === currentUid);

        if (!current || current.role !== "Master Admin") {
          navigate("/admin/dashboard");
          return;
        }

        setCurrentAdmin(current);
        setAdmins(data);
      } catch (err) {
        console.error("Error fetching admins:", err);
      } finally {
        setLoading(false);
      }
    };

  const openCreateModal = () => {
    setEditingAdmin(null);
    setFormData({ name: "", email: "", password: "", role: "" });
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (admin) => {
    setEditingAdmin(admin);
    setFormData({ name: admin.name, email: admin.email, password: "", role: admin.role});
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async (confirmed) => {
    setFormError("");
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    if (!editingAdmin && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email)) {
      setFormError("Please enter a valid email address (for example, name@example.com).");
      return;
    }
    if (!editingAdmin && !formData.password.trim()) {
      setFormError("Password is required for new accounts.");
      return;
    }
    if (!editingAdmin && formData.password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (!editingAdmin && formData.password !== confirmPassword) {
      setFormError("Password and Confirm Password do not match.");
      return;
    }
    if (!formData.role) {
      setFormError("Please select a role.");
      return;
    }

    if (confirmed !== true) {
      const isEdit = !!editingAdmin;
      setConfirmAction({
        title: isEdit ? "Save changes?" : "Create this admin account?",
        message: isEdit
          ? `Save the changes to ${formData.name.trim()} (${editingAdmin.email})? Role: ${roleLabel(formData.role)}.`
          : `Create an admin account for ${formData.name.trim()} (${formData.email.trim()}) as ${roleLabel(formData.role)}?`,
        confirmLabel: isEdit ? "Save Changes" : "Create Admin",
        run: () => handleSubmit(true),
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingAdmin) {
        // Edit existing admin
        await updateDoc(doc(db, "admins", editingAdmin.id), {
          name: formData.name,
          role: formData.role,
        });
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === editingAdmin.id
              ? { ...a, name: formData.name, role: formData.role}
              : a
          )
        );
      } else {
        // Create new admin in Firebase Auth using secondary app
        const userCred = await createUserWithEmailAndPassword(
          secondaryAuth, formData.email, formData.password
        );
        await secondaryAuth.signOut();

        // Save to Firestore admins collection
        await setDoc(doc(db, "admins", userCred.user.uid), {
          name: formData.name,
          email: formData.email.toLowerCase(),
          role: formData.role,
          status: "Active",
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.email || "unknown",
        });
        setAdmins((prev) => [
           ...prev,
           {
             id: userCred.user.uid,
             name: formData.name,
             email: formData.email.toLowerCase(),
             role: formData.role,
             status: "Active",
             createdBy: auth.currentUser?.email || "unknown",
           },
         ]);
      }
      setShowModal(false);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setFormError("This email is already in use.");
      } else if (err.code === "auth/invalid-email") {
        setFormError("Please enter a valid email address.");
      } else {
        setFormError("Something went wrong. Please try again.");
        console.error(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const runConfirm = async () => {
    const run = confirmAction?.run;
    setConfirmAction(null);
    if (run) await run();
  };

  const handleToggleStatus = async (admin) => {
    if (admin.id === auth.currentUser?.uid) {
      alert("You cannot deactivate your own account.");
      return;
    }
    const newStatus = admin.status === "Active" ? "Inactive" : "Active";
    try {
      await updateDoc(doc(db, "admins", admin.id), { status: newStatus });
      setAdmins((prev) =>
        prev.map((a) => (a.id === admin.id ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      alert("Failed to update status.");
    }
  };

  const getRoleClass = (role) => {
    if (role === "Master Admin") return "mu-badge mu-badge--master";
    return "mu-badge mu-badge--office";
  };

  const getStatusClass = (status) => {
    if (status === "Active") return "mu-status mu-status--active";
    return "mu-status mu-status--inactive";
  };

  return (
    <AdminLayout>
      <div className="mu-header">
        <div>
          <h2 className="mu-title">Manage Users</h2>
          <p className="mu-subtitle">
            {isMasterAdmin
              ? "Create, edit, and deactivate admin accounts."
              : "You have view-only access. Only Master Admins can manage users."}
          </p>
        </div>
        {isMasterAdmin && (
          <button className="mu-create-btn" onClick={openCreateModal}>
            + Add Admin
          </button>
        )}
      </div>

      {loading ? (
        <p className="mu-loading">Loading users...</p>
      ) : (
        <>
        <div className="mu-table-card">
          <table className="mu-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created By</th>
                {isMasterAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr><td colSpan="5" className="mu-empty">No admin accounts found.</td></tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      {admin.name}
                      {admin.status === "Active" && <span className="mu-focal-badge" title="Focal Person">★ Focal</span>}
                      {admin.id === auth.currentUser?.uid && (
                        <span className="mu-you"> (you)</span>
                      )}
                    </td>
                    <td>{admin.email}</td>
                    <td><span className={getRoleClass(admin.role)}>{roleLabel(admin.role)}</span></td>
                    <td><span className={getStatusClass(admin.status)}>{admin.status}</span></td>
                    <td className="mu-created-by">{admin.createdBy || "—"}</td>
                    {isMasterAdmin && (
                      <td>
                        <div className="mu-actions">
                          <button
                            className="mu-edit-btn"
                            onClick={() => openEditModal(admin)}
                          >
                            Edit
                          </button>
                          <button
                            className={`mu-toggle-btn ${admin.status === "Active" ? "mu-toggle-btn--deactivate" : "mu-toggle-btn--activate"}`}
                            onClick={() =>
                              setConfirmAction({
                                title: admin.status === "Active" ? "Deactivate this account?" : "Activate this account?",
                                message: admin.status === "Active"
                                  ? `${admin.name} will no longer be able to log in to the admin system.`
                                  : `${admin.name} will be able to log in to the admin system again.`,
                                confirmLabel: admin.status === "Active" ? "Deactivate" : "Activate",
                                run: () => handleToggleStatus(admin),
                              })
                            }
                            disabled={admin.id === auth.currentUser?.uid}
                          >
                            {admin.status === "Active" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mu-cards">
      {admins.length === 0 ? (
        <p className="mu-empty">No admin accounts found.</p>
      ) : (
        admins.map((admin) => (
          <div key={admin.id} className="mu-card">
            <div className="mu-card-top">
              <span className="mu-card-name">
                {admin.name}
                {admin.status === "Active" && <span className="mu-focal-badge" title="Focal Person">★ Focal</span>}
                {admin.id === auth.currentUser?.uid && <span className="mu-you"> (you)</span>}
              </span>
              <span className={getRoleClass(admin.role)}>{roleLabel(admin.role)}</span>
            </div>
            <div className="mu-card-row mu-card-sub">{admin.email}</div>
            <div className="mu-card-row">
              <span className={getStatusClass(admin.status)}>{admin.status}</span>
            </div>
            <div className="mu-card-row mu-card-sub">Created by: {admin.createdBy || "—"}</div>
            {isMasterAdmin && (
              <div className="mu-actions mu-card-actions">
                <button className="mu-edit-btn" onClick={() => openEditModal(admin)}>Edit</button>
                <button
                  className={`mu-toggle-btn ${admin.status === "Active" ? "mu-toggle-btn--deactivate" : "mu-toggle-btn--activate"}`}
                  onClick={() =>
                    setConfirmAction({
                      title: admin.status === "Active" ? "Deactivate this account?" : "Activate this account?",
                      message: admin.status === "Active"
                        ? `${admin.name} will no longer be able to log in to the admin system.`
                        : `${admin.name} will be able to log in to the admin system again.`,
                      confirmLabel: admin.status === "Active" ? "Deactivate" : "Activate",
                      run: () => handleToggleStatus(admin),
                    })
                  }
                  disabled={admin.id === auth.currentUser?.uid}
                >
                  {admin.status === "Active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="mu-modal-overlay">
          <div className="mu-modal">
            <div className="mu-modal-header">
              <h3>{editingAdmin ? "Edit Admin" : "Add New Admin"}</h3>
              <button className="mu-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="mu-modal-body">
              {formError && <div className="mu-error">{formError}</div>}

              <div className="mu-field">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Juan dela Cruz"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="mu-field">
                <label>Email {editingAdmin && <span className="mu-note">(cannot be changed)</span>}</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingAdmin}
                />
              </div>

              {!editingAdmin && (
                <>
                  <div className="mu-field">
                    <label>Password</label>
                    <div className="mu-password-wrap">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimum 6 characters"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="mu-eye-btn"
                        onClick={() => setShowPassword((v) => !v)}
                        onMouseDown={(e) => e.preventDefault()}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  <div className="mu-field">
                    <label>Confirm Password</label>
                    <div className="mu-password-wrap">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter the password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="mu-eye-btn"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        onMouseDown={(e) => e.preventDefault()}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        aria-pressed={showConfirmPassword}
                      >
                        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="mu-field">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="" disabled>Select a role...</option>
                  {OFFICE_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                </select>
              </div>
                <div className="mu-field">
                  <span className="mu-note">
                    Every Active administrator is automatically a focal person (eligible office contact).
                    This does not grant any extra access to reports or admin functions.
                  </span>
                </div>
              </div>

            <div className="mu-modal-footer">
              <button className="mu-cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="mu-save-btn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : editingAdmin ? "Save Changes" : "Create Admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="mu-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="mu-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mu-modal-header">
              <h3>{confirmAction.title}</h3>
            </div>
            <div className="mu-modal-body">
              <p className="mu-confirm-text">{confirmAction.message}</p>
            </div>
            <div className="mu-modal-footer">
              <button className="mu-cancel-btn" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className="mu-save-btn" onClick={runConfirm}>{confirmAction.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}