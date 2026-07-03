import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import AdminLayout from "./AdminLayout";
import "./ManageUsers.css";

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

export default function ManageUsers() {
  const navigate = useNavigate();
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "Regular Admin" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const isMasterAdmin = currentAdmin?.role === "Master Admin";

  const openCreateModal = () => {
    setEditingAdmin(null);
    setFormData({ name: "", email: "", password: "", role: "Regular Admin" });
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (admin) => {
    setEditingAdmin(admin);
    setFormData({ name: admin.name, email: admin.email, password: "", role: admin.role });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError("Name and email are required.");
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
            a.id === editingAdmin.id ? { ...a, name: formData.name, role: formData.role } : a
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
        });
        setAdmins((prev) => [...prev, {
          id: userCred.user.uid,
          name: formData.name,
          email: formData.email.toLowerCase(),
          role: formData.role,
          status: "Active",
        }]);
      }
      setShowModal(false);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setFormError("This email is already in use.");
      } else {
        setFormError("Something went wrong. Please try again.");
        console.error(err);
      }
    } finally {
      setSubmitting(false);
    }
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
    return "mu-badge mu-badge--regular";
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
        <div className="mu-table-card">
          <table className="mu-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
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
                      {admin.id === auth.currentUser?.uid && (
                        <span className="mu-you"> (you)</span>
                      )}
                    </td>
                    <td>{admin.email}</td>
                    <td><span className={getRoleClass(admin.role)}>{admin.role}</span></td>
                    <td><span className={getStatusClass(admin.status)}>{admin.status}</span></td>
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
                            onClick={() => handleToggleStatus(admin)}
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
                  placeholder="admin@emb.gov.ph"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingAdmin}
                />
              </div>

              {!editingAdmin && (
                <div className="mu-field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              )}

              <div className="mu-field">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option>Regular Admin</option>
                  <option>Master Admin</option>
                </select>
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
    </AdminLayout>
  );
}