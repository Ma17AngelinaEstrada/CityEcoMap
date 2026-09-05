import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import "./AdminLogin.css";
import embLogo from '../../emb-logo.png';

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetMessage("");
    if (!resetEmail.trim()) {
      setResetError("Please enter your email address.");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMessage("Password reset link sent. Please check your email.");
    } catch (err) {
      setResetError("Unable to send reset link. Please check the email address and try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="al-wrapper">
      {/* Left Panel */}
      <div className="al-left">
        <div className="al-left-content">
          <div className="al-illustration-wrap">
            <img
              src="/admin-illustration.svg"
              alt=""
              className="al-illustration-img"
            />
          </div>
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
            <img src="/logowhite2.png" alt="CityEcoMap logo" className="al-logo-img" />
            <span className="al-logo-divider" />
            <img src={embLogo} alt="EMB logo" className="al-partner-logo" />
          </div>
          <p className="al-auth-note">Authorized Access Only</p>

          {!showForgot ? (
            <>
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

              <button
                type="button"
                className="al-forgot-link"
                onClick={() => {
                  setShowForgot(true);
                  setResetEmail(username);
                  setResetError("");
                  setResetMessage("");
                }}
              >
                Forgot Password?
              </button>
            </>
          ) : (
            <>
              <p className="al-reset-instructions">
                Enter your admin email address and we'll send you a link to reset your password.
              </p>

              {resetError && <div className="al-error">{resetError}</div>}
              {resetMessage && <div className="al-success">{resetMessage}</div>}

              <form onSubmit={handleResetPassword}>
                <div className="al-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <button type="submit" className="al-btn" disabled={resetLoading}>
                  {resetLoading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>

              <button
                type="button"
                className="al-forgot-link"
                onClick={() => {
                  setShowForgot(false);
                  setResetError("");
                  setResetMessage("");
                }}
              >
                Back to Login
              </button>
            </>
          )}

          <p className="al-footer">
            Environmental Management Bureau (EMB) and Local Government Unit of Lucena City — Official Access Only
          </p>
        </div>
      </div>
    </div>
  );
}