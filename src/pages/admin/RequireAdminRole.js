import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../../firebase/firebase';

/** Verifies the signed-in user's active admin role before restricted pages mount. */
export default function RequireAdminRole({ allowedRoles, children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, role: null });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) setState({ loading: false, role: null });
        return;
      }
      try {
        const snapshot = await getDocFromServer(doc(db, 'admins', user.uid));
        const data = snapshot.exists() ? snapshot.data() : null;
        if (!cancelled) setState({ loading: false, role: data?.status === 'Active' ? data.role : null });
      } catch (error) {
        console.error('Admin route verification failed:', error);
        if (!cancelled) setState({ loading: false, role: null });
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  if (state.loading) return <div style={{ padding: 32, textAlign: 'center' }}>Verifying admin access…</div>;
  if (!state.role) return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  if (!allowedRoles.includes(state.role)) {
    return <Navigate to={state.role === 'EMB Admin' ? '/admin/monitoring' : '/admin/dashboard'} replace />;
  }
  return children;
}
