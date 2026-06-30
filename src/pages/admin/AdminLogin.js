import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import "./AdminLogin.css";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, username, password);
      navigate("/admin/dashboard");
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="al-wrapper">
      {/* Left Panel */}
      <div className="al-left">
        <div className="al-left-content">
          <h1>CityEcoMap Administrative Access</h1>
          <p>
            Manage environmental reports and monitor city-wide drainage issues
            from your dashboard.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="al-right">
        <div className="al-form-container">
          <div className="al-logo-row">
            <img src="/logogreen2.png" alt="CityEcoMap logo" className="al-logo-img" />
            
          </div>
          <p className="al-auth-note">Authorized Access Only</p>

          {error && <div className="al-error">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="al-field">
              <label>Email</label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="al-field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="al-btn" disabled={loading}>
              {loading ? "Logging in…" : "Login"}
            </button>
          </form>

          <p className="al-footer">
            Environmental Management Bureau (EMB) Official Access
          </p>
        </div>
      </div>
    </div>
  );
}