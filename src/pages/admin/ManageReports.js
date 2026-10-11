import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, updateDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot, runTransaction, arrayUnion } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import AdminLayout from "./AdminLayout";
import "./ManageReports.css";
import { reverseGeocode, isCached } from '../../utils/geocode';
import { useAdminTour } from "../../context/AdminTourContext";
import { ACTIVE_OFFICE_LIST, isMasterRole, officeForRole, officeLabel } from "../../constants/offices";

const sendEmailNotification = async (to, subject, body) => {
  if (!to) return;
  try {
    await fetch('https://cityecomap-email.onrender.com/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    });
  } catch (err) {
    console.error('Email notification failed:', err);
  }
};

const SAMPLE_REPORT = {
  id: 'SAMPLE_REPORT',
  reportId: 'WI99999',
  fullName: 'Juan Dela Cruz',
  email: 'juan.delacruz@example.com',
  category: 'Waste Issue',
  subCategory: 'Illegal Dumping',
  areaType: 'Vacant Lot',
  createdAt: { toDate: () => new Date() },
  description: 'Sample report for preview — pile of garbage dumped near the vacant lot.',
  locationDescription: 'Beside the basketball court',
  addressInput: 'Brgy. 5, Lucena City',
  location: null,
  primaryOffice: 'CENRO',
  jurisdictionCandidates: null,
  needsReview: false,
  status: 'Pending',
  rejectionReason: null,
  photo: null,
};

const SAMPLE_HISTORY = [
  {
    id: 'sample-history-1',
    status: 'Pending',
    adminEmail: 'system',
    timestamp: { toDate: () => new Date() },
    notes: null,
  },
];

const MANAGE_REPORTS_TOUR_STEPS = [
  {
    selector: '.mr-filters',
    title: 'Filter Reports',
    description: 'Narrow down the report list by status, category, sub-category, Primary Office (Master Admin), Supporting Office, date range, or a keyword/Report ID search.',
  },
  {
    selector: '.mr-table-card',
    title: 'Reports Table',
    description: 'All matching reports appear here. Click any row to open its full details.',
  },
  {
    selector: '.mr-detail--modal',
    title: 'Report Details',
    description: 'This is a sample preview of what you\u2019ll see when you click a report — full details, photo, and current status.',
  },
  {
    selector: '.mr-workflow-group',   // dating '.mr-status-actions'
    title: 'Take Action',
    description: 'Available actions depend on your role, office, and the report\u2019s current status. ...',
  },
  {
    selector: '.mr-history-section',
    title: 'Status History',
    description: 'Every status change is logged here, along with who made the change and when.',
  },
];

const generateSupportId = () =>
  (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

const MAX_REROUTES = 3;

const supportingOfficesLabel = (r) => {
  const offices = [...new Set((r.supportingOffices || []).map((so) => so.officeId))];
  return offices.length ? offices.join(", ") : "—";
};

export default function ManageReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("All");
  const [filterSupporting, setFilterSupporting] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedReport, setSelectedReport] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectConfirming, setRejectConfirming] = useState(false);
  const [currentOffice, setCurrentOffice] = useState(null);
  const [isMaster, setIsMaster] = useState(false);
  const [jurisdictionBusy, setJurisdictionBusy] = useState(false);
  const [reviewAssignOffice, setReviewAssignOffice] = useState("");
  const [supportModal, setSupportModal] = useState(false);
  const [supportTargetOffice, setSupportTargetOffice] = useState("");
  const [supportReason, setSupportReason] = useState("");
  const [supportRemarks, setSupportRemarks] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportDecisionModal, setSupportDecisionModal] = useState(null); // { entry, action: 'accept' | 'decline' }
  const [supportDeclineReason, setSupportDeclineReason] = useState("");
  const [supportDecisionConfirming, setSupportDecisionConfirming] = useState(false);
  const [rerouteModal, setRerouteModal] = useState(false);
  const [rerouteTargetOffice, setRerouteTargetOffice] = useState("");
  const [rerouteReason, setRerouteReason] = useState("");
  const [rerouteBusy, setRerouteBusy] = useState(false);
  const [rerouteDecisionModal, setRerouteDecisionModal] = useState(null); // { action: 'accept' | 'decline' }
  const [rerouteDeclineReason, setRerouteDeclineReason] = useState("");
  const [rerouteDecisionConfirming, setRerouteDecisionConfirming] = useState(false);
  const [escalateModal, setEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [escalateBusy, setEscalateBusy] = useState(false);
  const [escalateResolveOffice, setEscalateResolveOffice] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [addresses, setAddresses] = useState({});
  const [statusHistory, setStatusHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [reportContactNumber, setReportContactNumber] = useState(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [adminNameMap, setAdminNameMap] = useState({});
  const [toast, setToast] = useState(null);
  const isFirstLoad = useRef(true);
  const prevIdsRef = useRef(new Set());
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterSubCategory, setFilterSubCategory] = useState("All");
  const [quickRange, setQuickRange] = useState("custom");
  const [specificMonth, setSpecificMonth] = useState("");
  const { registerTour, showTour, currentStepIndex } = useAdminTour();

  useEffect(() => {
    registerTour(MANAGE_REPORTS_TOUR_STEPS, 'cityecomap_admin_tour_seen_reports');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SAMPLE_MODAL_STEP_INDEX = 2;

  useEffect(() => {
    if (showTour && currentStepIndex >= SAMPLE_MODAL_STEP_INDEX) {
      setSelectedReport({ ...SAMPLE_REPORT, primaryOffice: currentOffice || SAMPLE_REPORT.primaryOffice });
      setStatusHistory(SAMPLE_HISTORY);
    } else if (selectedReport?.id === 'SAMPLE_REPORT') {
      setSelectedReport(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTour, currentStepIndex]);

  const WASTE_SUBCATEGORIES = ["Illegal Dumping", "Uncollected Garbage", "Waste Affecting Rivers, Waterways, and Natural Water Bodies", "Other"];
  const DRAINAGE_SUBCATEGORIES = ["Clogged Drainage", "Blocked Drainage", "Damaged Drainage", "Flooding", "Other"];
  const KNOWN_SUBCATEGORIES = new Set([
    ...WASTE_SUBCATEGORIES.filter((s) => s !== "Other"),
    ...DRAINAGE_SUBCATEGORIES.filter((s) => s !== "Other"),
  ]);
  const isOtherSubCategory = (subCategory) =>
    Boolean(subCategory) && !KNOWN_SUBCATEGORIES.has(subCategory);

  const applyQuickRange = (value) => {
    setQuickRange(value);
    const today = new Date();

    if (value === "all") {
      setDateFrom("");
      setDateTo("");
      setSpecificMonth("");
      return;
    }
    if (value === "last1") {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 1);
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(today.toISOString().slice(0, 10));
      setSpecificMonth("");
      return;
    }
    if (value === "last3") {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 3);
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(today.toISOString().slice(0, 10));
      setSpecificMonth("");
      return;
    }
    if (value === "quarter") {
      const q = Math.floor(today.getMonth() / 3);
      const from = new Date(today.getFullYear(), q * 3, 1);
      const to = new Date(today.getFullYear(), q * 3 + 3, 0);
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(to.toISOString().slice(0, 10));
      setSpecificMonth("");
      return;
    }
    if (value === "month") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const applySpecificMonth = (monthValue) => {
    setSpecificMonth(monthValue);
    if (!monthValue) return;
    const [year, month] = monthValue.split("-").map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { navigate("/admin"); return; }
      (async () => {
        try {
          const snap = await getDoc(doc(db, "admins", user.uid));
          if (snap.exists()) {
            const role = snap.data().role;
            setIsMaster(isMasterRole(role));
            setCurrentOffice(officeForRole(role));
          }
        } catch (err) {
          console.error("Error resolving admin role:", err);
        }
      })();
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reports"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

      if (!isFirstLoad.current) {
        const newOnes = data.filter((r) => {
          if (prevIdsRef.current.has(r.id) || r.status !== "Pending") return false;
          if (isMaster) return r.needsReview === true;
          if (!currentOffice) return false;
          return r.primaryOffice === currentOffice || (r.jurisdictionCandidates || []).includes(currentOffice);
        });
        if (newOnes.length > 0) {
          setToast(`🔔 ${newOnes.length} new report${newOnes.length > 1 ? "s" : ""} received`);
          setTimeout(() => setToast(null), 5000);
        }
      }

      prevIdsRef.current = new Set(data.map((r) => r.id));
      isFirstLoad.current = false;
      setReports(data);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching reports:", err);
      setLoading(false);
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, currentOffice]);

  useEffect(() => {
    const targetId = location.state?.openReportId;
    if (targetId && reports.length > 0) {
      const target = reports.find((r) => r.id === targetId);
      if (target) {
        setSelectedReport(target);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, reports]);

  useEffect(() => {
    const targetId = searchParams.get("report");
    const statusParam = searchParams.get("status");

    if (statusParam) {
      setFilterStatus(statusParam);
    }

    if (targetId && reports.length > 0) {
      const target = reports.find((r) => r.id === targetId);
      if (target) {
        setSelectedReport(target);
      }
    }

    if (targetId || statusParam) {
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, reports]);

  useEffect(() => {
    const resolveAddresses = async () => {
      const newAddresses = {};
      for (const r of reports) {
        if (r.location?.lat && r.location?.lng) {
          const key = r.id;
          if (!addresses[key]) {
            const wasCached = isCached(r.location.lat, r.location.lng);
            const addr = await reverseGeocode(r.location.lat, r.location.lng);
            newAddresses[key] = addr;
            if (!wasCached) {
              await new Promise((res) => setTimeout(res, 1100));
            }
          }
        }
      }
      if (Object.keys(newAddresses).length > 0) {
        setAddresses((prev) => ({ ...prev, ...newAddresses }));
      }
    };
    if (reports.length > 0) resolveAddresses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const snapshot = await getDocs(collection(db, "admins"));
        const map = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data.email) {
            const office = officeForRole(data.role);
            const label = data.name || data.username || data.email;
            map[data.email] = office ? `${label} (${office})` : label;
          }
        });
        setAdminNameMap(map);
      } catch (err) {
        console.error("Error fetching admins for name lookup:", err);
      }
    };
    fetchAdmins();
  }, []);

  const updateStatus = async (reportId, newStatus, extraFields = {}) => {
    setUpdatingId(reportId);
    try {
      await updateDoc(doc(db, "reports", reportId), {
        status: newStatus,
        ...extraFields,
      });

      await addDoc(collection(db, "reports", reportId, "statusHistory"), {
        status: newStatus,
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: extraFields.rejectionReason
          ? `Reason: ${extraFields.rejectionReason}`
          : null,
      });

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, status: newStatus, ...extraFields } : r
        )
      );
      if (selectedReport?.id === reportId) {
        setSelectedReport((prev) => ({ ...prev, status: newStatus, ...extraFields }));
        fetchStatusHistory(reportId);
      }
    } catch (err) {
      alert("Failed to update. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApprove = async () => {
    await updateStatus(selectedReport.id, "Approved");
    await sendEmailNotification(
      selectedReport.email,
      "Your CityEcoMap Report Has Been Approved",
      `<p>Dear Citizen,</p>
       <p>Your report <strong>#${selectedReport.reportId}</strong> has been reviewed and approved.</p>
       <p>It is being handled by <strong>${selectedReport.primaryOffice}</strong>.</p>
       <p>Thank you for helping keep Lucena City clean!</p>
       <p>You can also check your report's progress anytime using your Report ID <strong>#${selectedReport.reportId}</strong> on our Track Report page.</p>
       <br/>
       <p>— CityEcoMap Team<br/>Environmental Management Bureau, Lucena City</p>`
    );
  };

  const handleManualAssign = async () => {
    if (!reviewAssignOffice || !selectedReport) return;
    setUpdatingId(selectedReport.id);
    try {
      await updateDoc(doc(db, "reports", selectedReport.id), {
        primaryOffice: reviewAssignOffice,
        needsReview: false,
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "PRIMARY_OFFICE_CHANGED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `Manually assigned to ${reviewAssignOffice} (needs-review case)`,
      });
      setReports((prev) => prev.map((r) =>
        r.id === selectedReport.id ? { ...r, primaryOffice: reviewAssignOffice, needsReview: false } : r
      ));
      setSelectedReport((prev) => ({ ...prev, primaryOffice: reviewAssignOffice, needsReview: false }));
      setReviewAssignOffice("");
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      console.error(err);
      alert("Failed to assign office. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const openSupportModal = () => {
    setSupportTargetOffice("");
    setSupportReason("");
    setSupportRemarks("");
    setSupportModal(true);
  };

  const handleSubmitSupportRequest = async () => {
    if (!selectedReport) return;
    if (!supportTargetOffice) {
      alert("Please select an office.");
      return;
    }
    if (!supportReason.trim()) {
      alert("Please provide a reason for requesting support.");
      return;
    }
    setSupportBusy(true);
    try {
      const newEntry = {
        id: generateSupportId(),
        officeId: supportTargetOffice,
        status: "pending",
        reason: supportReason.trim(),
        remarks: supportRemarks.trim() || null,
        requestedBy: auth.currentUser?.email || "unknown",
        requestedAt: new Date(),
      };
      await updateDoc(doc(db, "reports", selectedReport.id), {
        supportingOffices: arrayUnion(newEntry),
        supportingOfficeIds: arrayUnion(supportTargetOffice),
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "SUPPORT_REQUESTED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `Requested support from ${supportTargetOffice}: ${supportReason.trim()}`,
        notifyOffice: supportTargetOffice,
      });
      const updatedList = [...(selectedReport.supportingOffices || []), newEntry];
      const updatedIds = Array.from(new Set([...(selectedReport.supportingOfficeIds || []), supportTargetOffice]));
      setReports((prev) => prev.map((r) =>
        r.id === selectedReport.id ? { ...r, supportingOffices: updatedList, supportingOfficeIds: updatedIds } : r
      ));
      setSelectedReport((prev) => ({ ...prev, supportingOffices: updatedList, supportingOfficeIds: updatedIds }));
      setSupportModal(false);
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      console.error(err);
      alert("Failed to send support request. Please try again.");
    } finally {
      setSupportBusy(false);
    }
  };

  const handleAcceptSupport = async (entry) => {
    if (!selectedReport) return;
    setSupportBusy(true);
    const reportRef = doc(db, "reports", selectedReport.id);
    try {
      let updatedList = [];
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(reportRef);
        const data = snap.data();
        updatedList = (data.supportingOffices || []).map((so) =>
          so.id === entry.id
            ? { ...so, status: "accepted", respondedBy: auth.currentUser?.email || "unknown", respondedAt: new Date() }
            : so
        );
        tx.update(reportRef, { supportingOffices: updatedList });
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "SUPPORT_ACCEPTED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `${entry.officeId} accepted the support request`,
        notifyOffice: selectedReport.primaryOffice,
      });
      setReports((prev) => prev.map((r) => r.id === selectedReport.id ? { ...r, supportingOffices: updatedList } : r));
      setSelectedReport((prev) => ({ ...prev, supportingOffices: updatedList }));
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      console.error(err);
      alert("Failed to accept support request. Please try again.");
    } finally {
      setSupportBusy(false);
    }
  };

  const handleDeclineSupport = async (entry, declineReason) => {
    if (!selectedReport) return;
    setSupportBusy(true);
    const reportRef = doc(db, "reports", selectedReport.id);
    try {
      let updatedList = [];
      let updatedIds = [];
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(reportRef);
        const data = snap.data();
        updatedList = (data.supportingOffices || []).map((so) =>
          so.id === entry.id
            ? { ...so, status: "declined", declineReason, respondedBy: auth.currentUser?.email || "unknown", respondedAt: new Date() }
            : so
        );
        updatedIds = (data.supportingOfficeIds || []).filter((id) => id !== entry.officeId);
        tx.update(reportRef, { supportingOffices: updatedList, supportingOfficeIds: updatedIds });
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "SUPPORT_DECLINED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `${entry.officeId} declined the support request${declineReason ? `: ${declineReason}` : ""}`,
        notifyOffice: selectedReport.primaryOffice,
      });
      setReports((prev) => prev.map((r) => r.id === selectedReport.id ? { ...r, supportingOffices: updatedList, supportingOfficeIds: updatedIds } : r));
      setSelectedReport((prev) => ({ ...prev, supportingOffices: updatedList, supportingOfficeIds: updatedIds }));
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      console.error(err);
      alert("Failed to decline support request. Please try again.");
    } finally {
      setSupportBusy(false);
    }
  };

  const handleUpdateSupportProgress = async (entry, newStatus) => {
    if (!selectedReport) return;
    if (!["Approved", "Ongoing"].includes(selectedReport.status)) {
      alert("The Primary Office must approve this report before supporting offices can start their part.");
      return;
    }
    setSupportBusy(true);
    const reportRef = doc(db, "reports", selectedReport.id);
    try {
      let updatedList = [];
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(reportRef);
        const data = snap.data();
        updatedList = (data.supportingOffices || []).map((so) =>
          so.id === entry.id ? { ...so, status: newStatus } : so
        );
        tx.update(reportRef, { supportingOffices: updatedList });
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "SUPPORT_PROGRESS_UPDATED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `${entry.officeId} marked their support as "${newStatus}"`,
        notifyOffice: selectedReport.primaryOffice,
      });
      setReports((prev) => prev.map((r) => r.id === selectedReport.id ? { ...r, supportingOffices: updatedList } : r));
      setSelectedReport((prev) => ({ ...prev, supportingOffices: updatedList }));
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      console.error(err);
      alert("Failed to update support status. Please try again.");
    } finally {
      setSupportBusy(false);
    }
  };

  const openAcceptConfirm = (entry) => {
    setSupportDecisionModal({ entry, action: "accept" });
    setSupportDecisionConfirming(true);
  };

  const openDeclineModal = (entry) => {
    setSupportDecisionModal({ entry, action: "decline" });
    setSupportDeclineReason("");
    setSupportDecisionConfirming(false);
  };

  const handleDeclineReasonNext = () => {
    if (!supportDeclineReason.trim()) {
      alert("Please provide a reason for declining.");
      return;
    }
    setSupportDecisionConfirming(true);
  };

  const handleConfirmSupportDecision = async () => {
    if (!supportDecisionModal) return;
    const { entry, action } = supportDecisionModal;
    if (action === "accept") {
      await handleAcceptSupport(entry);
    } else {
      await handleDeclineSupport(entry, supportDeclineReason.trim());
    }
    setSupportDecisionModal(null);
    setSupportDecisionConfirming(false);
    setSupportDeclineReason("");
  };

  const handleCancelSupportDecision = () => {
    setSupportDecisionModal(null);
    setSupportDecisionConfirming(false);
    setSupportDeclineReason("");
  };

  const openRerouteModal = () => {
    setRerouteTargetOffice("");
    setRerouteReason("");
    setRerouteModal(true);
  };

  const handleSubmitRerouteRequest = async () => {
    if (!selectedReport) return;
    if (!rerouteTargetOffice) {
      alert("Please select a destination office.");
      return;
    }
    if (!rerouteReason.trim()) {
      alert("Please provide a reason for the re-route request.");
      return;
    }
    setRerouteBusy(true);
    try {
      const newRequest = {
        targetOffice: rerouteTargetOffice,
        reason: rerouteReason.trim(),
        status: "pending",
        requestedBy: auth.currentUser?.email || "unknown",
        requestedAt: new Date(),
      };
      await updateDoc(doc(db, "reports", selectedReport.id), {
        rerouteRequest: newRequest,
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "REROUTE_REQUESTED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `Requested re-route to ${rerouteTargetOffice}: ${rerouteReason.trim()}`,
        notifyOffice: rerouteTargetOffice,
      });
      setReports((prev) => prev.map((r) => r.id === selectedReport.id ? { ...r, rerouteRequest: newRequest } : r));
      setSelectedReport((prev) => ({ ...prev, rerouteRequest: newRequest }));
      setRerouteModal(false);
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      console.error(err);
      alert("Failed to send re-route request. Please try again.");
    } finally {
      setRerouteBusy(false);
    }
  };

  const handleAcceptReroute = async () => {
    if (!selectedReport?.rerouteRequest) return;
    setRerouteBusy(true);
    const reportRef = doc(db, "reports", selectedReport.id);
    const oldPrimary = selectedReport.primaryOffice;
    const newPrimary = selectedReport.rerouteRequest.targetOffice;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(reportRef);
        const data = snap.data();
        if (!data.rerouteRequest || data.rerouteRequest.status !== "pending") {
          throw new Error("STALE_REQUEST");
        }
        tx.update(reportRef, {
          primaryOffice: newPrimary,
          status: "Pending",
          rerouteRequest: null,
          primaryOfficeHistory: arrayUnion(oldPrimary),
          rerouteCount: (data.rerouteCount || 0) + 1,
        });
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: "Pending",
        action: "REROUTE_ACCEPTED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `${newPrimary} accepted the re-route — Primary Office changed from ${oldPrimary} to ${newPrimary}. Report reset to Pending for re-validation.`,
        notifyOffice: oldPrimary,
      });
      const updated = {
        primaryOffice: newPrimary,
        status: "Pending",
        rerouteRequest: null,
        primaryOfficeHistory: [...(selectedReport.primaryOfficeHistory || []), oldPrimary],
        rerouteCount: (selectedReport.rerouteCount || 0) + 1,
      };
      setReports((prev) => prev.map((r) => r.id === selectedReport.id ? { ...r, ...updated } : r));
      setSelectedReport((prev) => ({ ...prev, ...updated }));
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      if (String(err.message) === "STALE_REQUEST") {
        alert("This re-route request is no longer valid.");
        setSelectedReport(null);
      } else {
        console.error(err);
        alert("Failed to accept re-route. Please try again.");
      }
    } finally {
      setRerouteBusy(false);
    }
  };

  const handleDeclineReroute = async (declineReason) => {
    if (!selectedReport?.rerouteRequest) return;
    setRerouteBusy(true);
    const reportRef = doc(db, "reports", selectedReport.id);
    const targetOffice = selectedReport.rerouteRequest.targetOffice;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(reportRef);
        const data = snap.data();
        if (!data.rerouteRequest || data.rerouteRequest.status !== "pending") {
          throw new Error("STALE_REQUEST");
        }
        tx.update(reportRef, { rerouteRequest: null });
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "REROUTE_DECLINED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `${targetOffice} declined the re-route request: ${declineReason}`,
        notifyOffice: selectedReport.primaryOffice,
      });
      setReports((prev) => prev.map((r) => r.id === selectedReport.id ? { ...r, rerouteRequest: null } : r));
      setSelectedReport((prev) => ({ ...prev, rerouteRequest: null }));
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      if (String(err.message) === "STALE_REQUEST") {
        alert("This re-route request is no longer valid.");
        setSelectedReport(null);
      } else {
        console.error(err);
        alert("Failed to decline re-route. Please try again.");
      }
    } finally {
      setRerouteBusy(false);
    }
  };

  const openRerouteAcceptConfirm = () => {
    setRerouteDecisionModal({ action: "accept" });
    setRerouteDecisionConfirming(true);
  };

  const openRerouteDeclineModal = () => {
    setRerouteDecisionModal({ action: "decline" });
    setRerouteDeclineReason("");
    setRerouteDecisionConfirming(false);
  };

  const handleRerouteDeclineReasonNext = () => {
    if (!rerouteDeclineReason.trim()) {
      alert("Please provide a reason for declining.");
      return;
    }
    setRerouteDecisionConfirming(true);
  };

  const handleConfirmRerouteDecision = async () => {
    if (!rerouteDecisionModal) return;
    if (rerouteDecisionModal.action === "accept") {
      await handleAcceptReroute();
    } else {
      await handleDeclineReroute(rerouteDeclineReason.trim());
    }
    setRerouteDecisionModal(null);
    setRerouteDecisionConfirming(false);
    setRerouteDeclineReason("");
  };

  const handleCancelRerouteDecision = () => {
    setRerouteDecisionModal(null);
    setRerouteDecisionConfirming(false);
    setRerouteDeclineReason("");
  };

  const openEscalateModal = () => {
    setEscalateReason("");
    setEscalateModal(true);
  };

  const handleSubmitEscalation = async () => {
    if (!selectedReport) return;
    if (!escalateReason.trim()) {
      alert("Please provide a reason for escalating this report.");
      return;
    }
    setEscalateBusy(true);
    try {
      const escalation = {
        status: "open",
        reason: escalateReason.trim(),
        raisedBy: auth.currentUser?.email || "unknown",
        raisedByOffice: currentOffice,
        raisedAt: new Date(),
      };
      await updateDoc(doc(db, "reports", selectedReport.id), { escalation });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "ROUTING_ESCALATED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `${currentOffice} escalated this report to the Master Admin: ${escalateReason.trim()}`,
        notifyOffice: 'MASTER',
      });
      setReports((prev) => prev.map((r) => r.id === selectedReport.id ? { ...r, escalation } : r));
      setSelectedReport((prev) => ({ ...prev, escalation }));
      setEscalateModal(false);
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      console.error(err);
      alert("Failed to escalate. Please try again.");
    } finally {
      setEscalateBusy(false);
    }
  };

  const handleResolveEscalation = async (reassignTo) => {
    if (!selectedReport) return;
    setEscalateBusy(true);
    const reportRef = doc(db, "reports", selectedReport.id);
    const oldPrimary = selectedReport.primaryOffice;
    const raisedByOffice = selectedReport.escalation?.raisedByOffice || null;
    try {
      const updates = { escalation: null };
      let noteAction = "kept the report with the current office";
      if (reassignTo && reassignTo !== oldPrimary) {
        updates.primaryOffice = reassignTo;
        updates.status = "Pending";
        updates.primaryOfficeHistory = arrayUnion(oldPrimary);
        noteAction = `reassigned Primary Office from ${oldPrimary} to ${reassignTo}. Report reset to Pending for re-validation`;
      }
      await updateDoc(reportRef, updates);
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: updates.status || selectedReport.status,
        action: "ROUTING_ESCALATION_RESOLVED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `Master Admin resolved the escalation — ${noteAction}.`,
        notifyOffice: raisedByOffice,
      });
      const merged = {
        ...selectedReport,
        ...updates,
        primaryOfficeHistory: updates.primaryOfficeHistory
          ? [...(selectedReport.primaryOfficeHistory || []), oldPrimary]
          : selectedReport.primaryOfficeHistory,
      };
      setReports((prev) => prev.map((r) => r.id === selectedReport.id ? merged : r));
      setSelectedReport(merged);
      setEscalateResolveOffice("");
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      console.error(err);
      alert("Failed to resolve escalation. Please try again.");
    } finally {
      setEscalateBusy(false);
    }
  };

  const handleConfirmJurisdiction = async () => {
    if (!currentOffice || !selectedReport) return;
    setJurisdictionBusy(true);
    const reportRef = doc(db, "reports", selectedReport.id);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(reportRef);
        const data = snap.data();
        if (data.primaryOffice) throw new Error(`ALREADY_CLAIMED:${data.primaryOffice}`);
        tx.update(reportRef, { primaryOffice: currentOffice, jurisdictionCandidates: [] });
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "JURISDICTION_CONFIRMED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `${currentOffice} confirmed jurisdiction and took ownership`,
      });
      setSelectedReport((prev) => ({ ...prev, primaryOffice: currentOffice, jurisdictionCandidates: [] }));
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      if (String(err.message).startsWith("ALREADY_CLAIMED")) {
        alert(`This report was already claimed by ${err.message.split(":")[1]}.`);
        setSelectedReport(null);
      } else {
        console.error(err);
        alert("Failed to confirm jurisdiction. Please try again.");
      }
    } finally {
      setJurisdictionBusy(false);
    }
  };

  const handleDeclineJurisdiction = async () => {
    if (!currentOffice || !selectedReport) return;
    const reason = window.prompt(`Reason "${currentOffice}" is declining jurisdiction (optional):`) || "";
    setJurisdictionBusy(true);
    const reportRef = doc(db, "reports", selectedReport.id);
    try {
      let remaining = [];
      let escalated = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(reportRef);
        const data = snap.data();
        if (data.primaryOffice) throw new Error(`ALREADY_CLAIMED:${data.primaryOffice}`);
        remaining = (data.jurisdictionCandidates || []).filter((o) => o !== currentOffice);
        if (remaining.length === 0) {
          escalated = true;
          tx.update(reportRef, { jurisdictionCandidates: [], needsReview: true });
        } else {
          tx.update(reportRef, { jurisdictionCandidates: remaining });
        }
      });
      await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
        status: selectedReport.status,
        action: "JURISDICTION_DECLINED",
        timestamp: serverTimestamp(),
        adminEmail: auth.currentUser?.email || "unknown",
        notes: `${currentOffice} declined jurisdiction${reason ? `: ${reason}` : ""}`
          + (escalated ? " — all candidates declined, escalated for EMB review" : ""),
      });
      if (escalated) {
        await addDoc(collection(db, "reports", selectedReport.id, "statusHistory"), {
          status: selectedReport.status,
          action: "ROUTING_ESCALATED",
          timestamp: serverTimestamp(),
          adminEmail: "system",
          notes: "All jurisdiction candidates declined — routed to EMB for manual review",
        });
      }
      setSelectedReport((prev) => ({
        ...prev,
        jurisdictionCandidates: remaining,
        needsReview: escalated ? true : prev.needsReview,
      }));
      fetchStatusHistory(selectedReport.id);
    } catch (err) {
      if (String(err.message).startsWith("ALREADY_CLAIMED")) {
        alert("This report was already claimed by another office.");
        setSelectedReport(null);
      } else {
        console.error(err);
        alert("Failed to record decline. Please try again.");
      }
    } finally {
      setJurisdictionBusy(false);
    }
  };

  const handleRejectReasonNext = () => {
    if (!rejectReason.trim()) {
      alert("Please enter a reason for rejection.");
      return;
    }
    setRejectConfirming(true);
  };

  const handleRejectConfirm = async () => {
    setRejectModal(false);
    setRejectConfirming(false);
    await updateStatus(selectedReport.id, "Rejected", { rejectionReason: rejectReason });
    await sendEmailNotification(
      selectedReport.email,
      "Update on Your CityEcoMap Report",
      `<p>Dear Citizen,</p>
       <p>Your report <strong>#${selectedReport.reportId}</strong> has been reviewed but could not be approved.</p>
       <p><strong>Reason:</strong> ${rejectReason}</p>
       <p>If you believe this is an error, please submit a new report with clearer details.</p>
       <p>You can also check your report's status anytime using your Report ID <strong>#${selectedReport.reportId}</strong> on our Track Report page.</p>
       <br/>
       <p>— CityEcoMap Team<br/>Environmental Management Bureau, Lucena City</p>`
    );
  };

  const handleRejectClick = () => {
    setRejectReason("");
    setRejectConfirming(false);
    setRejectModal(true);
  };

  const handleRejectCancel = () => {
    setRejectModal(false);
    setRejectConfirming(false);
  };

  const handleSetOngoing = async () => {
    await updateStatus(selectedReport.id, "Ongoing");
    await sendEmailNotification(
      selectedReport.email,
      "Cleanup in Progress — CityEcoMap Report Update",
      `<p>Dear Citizen,</p>
       <p>Good news! Cleanup is now in progress for your report <strong>#${selectedReport.reportId}</strong>.</p>
       <p>Our team is actively working on resolving the issue. Thank you for your patience.</p>
       <p>You can also check your report's progress anytime using your Report ID <strong>#${selectedReport.reportId}</strong> on our Track Report page.</p>
       <br/>
       <p>— CityEcoMap Team<br/>Environmental Management Bureau, Lucena City</p>`
    );
  };

  const handleSetResolved = async () => {
    await updateStatus(selectedReport.id, "Resolved");
    await sendEmailNotification(
      selectedReport.email,
      "Your Report Has Been Resolved — CityEcoMap",
      `<p>Dear Citizen,</p>
       <p>Your report <strong>#${selectedReport.reportId}</strong> has been successfully resolved.</p>
       <p>Thank you for helping us build a cleaner, greener Lucena City!</p>
       <p>You can view the full details of your resolved report anytime using your Report ID <strong>#${selectedReport.reportId}</strong> on our Track Report page.</p>
       <br/>
       <p>— CityEcoMap Team<br/>Environmental Management Bureau, Lucena City</p>`
    );
  };

  const fetchStatusHistory = async (reportId) => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "reports", reportId, "statusHistory"),
        orderBy("timestamp", "asc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStatusHistory(data);
    } catch (err) {
      console.error("Error fetching status history:", err);
      setStatusHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedReport?.id === 'SAMPLE_REPORT') {
      return;
    }
    if (selectedReport?.id) {
      fetchStatusHistory(selectedReport.id);
    } else {
      setStatusHistory([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport?.id]);

  useEffect(() => {
    if (!selectedReport?.id || selectedReport.id === 'SAMPLE_REPORT') {
      setReportContactNumber(null);
      return;
    }
    setLoadingContact(true);
    getDoc(doc(db, "reports", selectedReport.id, "private", "contact"))
      .then((snap) => setReportContactNumber(snap.exists() ? snap.data().contactNumber : null))
      .catch((err) => {
        console.error("Error fetching contact number:", err);
        setReportContactNumber(null);
      })
      .finally(() => setLoadingContact(false));
  }, [selectedReport?.id]);

  const hasSupportInvolvement = (r) =>
    (r.supportingOffices || []).some((so) => so.officeId === currentOffice);

  const hasRerouteInvolvement = (r) => r.rerouteRequest?.targetOffice === currentOffice;
  const actingOffice = isMaster ? null : currentOffice;

  const visibleReports = isMaster
    ? reports
    : reports.filter((r) =>
        r.primaryOffice === currentOffice ||
        (r.supportingOfficeIds || []).includes(currentOffice) ||
        (r.jurisdictionCandidates || []).includes(currentOffice) ||
              hasSupportInvolvement(r) ||
              hasRerouteInvolvement(r)
      );

  const filtered = visibleReports.filter((r) => {
    const matchStatus = filterStatus === "All" || r.status === filterStatus;
    const matchCategory = filterCategory === "All" || r.category === filterCategory;
    const matchSubCategory = (() => {
      if (filterSubCategory === "All") return true;
      if (filterSubCategory === "Other::Waste") return r.category === "Waste Issue" && isOtherSubCategory(r.subCategory);
      if (filterSubCategory === "Other::Drainage") return r.category === "Drainage Issue" && isOtherSubCategory(r.subCategory);
      return r.subCategory === filterSubCategory;
    })();
    const matchAssigned = !isMaster || filterAssigned === "All" || r.primaryOffice === filterAssigned;
    const matchSupporting = filterSupporting === "All" ||
      (r.supportingOffices || []).some((so) => so.officeId === filterSupporting);
    const cleanedSearch = searchQuery.replace(/#/g, "").trim().toLowerCase();
    const matchSearch = cleanedSearch === "" ||
        (r.reportId && r.reportId.toLowerCase().includes(cleanedSearch)) ||
        (r.description && r.description.toLowerCase().includes(cleanedSearch));

    let matchDate = true;
    if (dateFrom || dateTo) {
      const reportDate = r.createdAt?.toDate?.();
      if (reportDate) {
        if (dateFrom && reportDate < new Date(dateFrom)) matchDate = false;
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59);
          if (reportDate > toDate) matchDate = false;
        }
      }
    }

    return matchStatus && matchCategory && matchSubCategory && matchAssigned && matchSupporting && matchSearch && matchDate;
  });

  const getStatusClass = (status) => {
    if (status === "Pending") return "mr-badge mr-badge--pending";
    if (status === "Approved") return "mr-badge mr-badge--approved";
    if (status === "Ongoing" || status === "In Progress") return "mr-badge mr-badge--ongoing";
    if (status === "Resolved") return "mr-badge mr-badge--resolved";
    if (status === "Rejected") return "mr-badge mr-badge--rejected";
    return "mr-badge";
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const date = ts.toDate?.();
    if (!date) return "—";
    return date.toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const showPrevPhoto = (e) => {
    e?.stopPropagation();
    setLightbox((lb) => lb && { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length });
  };

  const showNextPhoto = (e) => {
    e?.stopPropagation();
    setLightbox((lb) => lb && { ...lb, index: (lb.index + 1) % lb.photos.length });
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') showPrevPhoto();
      else if (e.key === 'ArrowRight') showNextPhoto();
      else if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

  const selectedPhotos = selectedReport?.photos?.length
    ? selectedReport.photos
    : (selectedReport?.photo ? [selectedReport.photo] : []);

  const renderActions = () => {
    const r = selectedReport;
    if (!r) return null;
    const s = r.status;
    const busy = updatingId === r.id;
    const isSample = r.id === 'SAMPLE_REPORT';

    if (!r.primaryOffice && r.jurisdictionCandidates?.length > 0) {
      if (!actingOffice || !r.jurisdictionCandidates.includes(actingOffice)) {
        return <p className="mr-no-action">Awaiting jurisdiction confirmation from {r.jurisdictionCandidates.join(" or ")}.</p>;
      }
      return (
        <div className="mr-status-btns">
          <button className="mr-action-btn mr-action-btn--approve" onClick={handleConfirmJurisdiction} disabled={jurisdictionBusy || isSample}>
            ✔ Confirm Jurisdiction & Take Ownership
          </button>
          <button className="mr-action-btn mr-action-btn--reject" onClick={handleDeclineJurisdiction} disabled={jurisdictionBusy || isSample}>
            Not Our Jurisdiction
          </button>
        </div>
      );
    }

    if (!r.primaryOffice && r.needsReview) {
      if (!isMaster) return <p className="mr-no-action">Awaiting office assignment by EMB.</p>;
      return (
        <div className="mr-needs-review-form">
          <select value={reviewAssignOffice} onChange={(e) => setReviewAssignOffice(e.target.value)}>
            <option value="">Select office to assign...</option>
            {ACTIVE_OFFICE_LIST.map((o) => <option key={o}>{o}</option>)}
          </select>
          <button className="mr-action-btn mr-action-btn--approve" onClick={handleManualAssign} disabled={!reviewAssignOffice || busy || isSample}>
            Assign Office
          </button>
        </div>
      );
    }

    if (r.escalation?.status === "open") {
      if (!isMaster) {
        return <p className="mr-no-action">Escalated to Master Admin — awaiting resolution.</p>;
      }
      return (
        <div className="mr-needs-review-form">
          <select value={escalateResolveOffice} onChange={(e) => setEscalateResolveOffice(e.target.value)}>
            <option value="">Reassign to office (optional)...</option>
            {ACTIVE_OFFICE_LIST.filter((o) => o !== r.primaryOffice).map((o) => <option key={o}>{o}</option>)}
          </select>
          <button
            className="mr-action-btn mr-action-btn--approve"
            onClick={() => handleResolveEscalation(escalateResolveOffice)}
            disabled={!escalateResolveOffice || escalateBusy || isSample}
          >
            Reassign & Resolve
          </button>
          <button
            className="mr-action-btn mr-action-btn--ongoing"
            onClick={() => handleResolveEscalation(null)}
            disabled={escalateBusy || isSample}
          >
            Keep with {r.primaryOffice}
          </button>
        </div>
      );
    }

    if (!isMaster && currentOffice !== r.primaryOffice) {
      return <p className="mr-no-action">Only {r.primaryOffice} can act on this report.</p>;
    }
    if (isMaster && r.primaryOffice) {
      return <p className="mr-no-action">Handled by {r.primaryOffice}. EMB does not validate routine reports.</p>;
    }

    if (s === "Pending") return (
      <div className="mr-status-btns">
        <button className="mr-action-btn mr-action-btn--approve" onClick={handleApprove} disabled={busy || isSample}>
          ✔ Approve
        </button>
        <button className="mr-action-btn mr-action-btn--reject" onClick={handleRejectClick} disabled={busy || isSample}>
          ✕ Reject
        </button>
      </div>
    );

    if (s === "Approved") return (
      <div className="mr-status-btns">
        <button className="mr-action-btn mr-action-btn--ongoing" onClick={handleSetOngoing} disabled={busy || isSample}>
          ▶ Mark as Ongoing
        </button>
      </div>
    );

    if (s === "Ongoing" || s === "In Progress") return (
      <div className="mr-status-btns">
        <button className="mr-action-btn mr-action-btn--resolved" onClick={handleSetResolved} disabled={busy || isSample}>
          ✔ Mark as Resolved
        </button>
      </div>
    );

    if (s === "Resolved" || s === "Rejected") return (
      <p className="mr-no-action">No further actions available.</p>
    );
  };

  return (
    <AdminLayout>
      {toast && (
        <div className="mr-toast">
          {toast}
        </div>
      )}
      <div className="mr-header">
        <h2 className="mr-title">Manage & Resolve Reports</h2>
        <p className="mr-subtitle">Review, approve, reject, and resolve citizen-submitted reports.</p>
      </div>

      {/* Filters */}
      <div className="mr-filters">
        <div className="mr-filter-group">
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option>All</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Ongoing</option>
            <option>Resolved</option>
            <option>Rejected</option>
          </select>
        </div>
        <div className="mr-filter-group">
          <label>Category</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option>All</option>
            <option>Waste Issue</option>
            <option>Drainage Issue</option>
          </select>
        </div>
        <div className="mr-filter-group">
          <label>Sub-Category</label>
          <select
            className="mr-subcat-select"
            value={filterSubCategory}
            onChange={(e) => {
              const raw = e.target.value;
              setFilterSubCategory(raw);
              if (raw === "All") return;
              if (raw === "Other::Waste") { setFilterCategory("Waste Issue"); return; }
              if (raw === "Other::Drainage") { setFilterCategory("Drainage Issue"); return; }
              if (WASTE_SUBCATEGORIES.includes(raw)) setFilterCategory("Waste Issue");
              else if (DRAINAGE_SUBCATEGORIES.includes(raw)) setFilterCategory("Drainage Issue");
            }}
          >
            <option value="All">All</option>
            <optgroup label="Waste Issue">
              {WASTE_SUBCATEGORIES.map((s) =>
                s === "Other"
                  ? <option key="w-other" value="Other::Waste">Other</option>
                  : <option key={s} value={s}>{s}</option>
              )}
            </optgroup>
            <optgroup label="Drainage Issue">
              {DRAINAGE_SUBCATEGORIES.map((s) =>
                s === "Other"
                  ? <option key="d-other" value="Other::Drainage">Other</option>
                  : <option key={`d-${s}`} value={s}>{s}</option>
              )}
            </optgroup>
          </select>
        </div>
        {isMaster && (
          <div className="mr-filter-group">
            <label>Primary Office</label>
            <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
              <option>All</option>
              {ACTIVE_OFFICE_LIST.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        )}
        <div className="mr-filter-group">
          <label>Supporting Office</label>
          <select value={filterSupporting} onChange={(e) => setFilterSupporting(e.target.value)}>
            <option>All</option>
            {ACTIVE_OFFICE_LIST.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="mr-filter-group">
          <label>Search</label>
          <input
            type="text"
            className="mr-search"
            placeholder="Report ID or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mr-filters-tail">
          <div className="mr-filter-group">
            <label>Time Range</label>
            <select value={quickRange} onChange={(e) => applyQuickRange(e.target.value)}>
              <option value="custom">Custom Range</option>
              <option value="all">All Time</option>
              <option value="last1">Last 1 Month</option>
              <option value="last3">Last 3 Months</option>
              <option value="quarter">This Quarter</option>
              <option value="month">Specific Month</option>
            </select>
          </div>
          {quickRange === "month" && (
            <div className="mr-filter-group">
              <label>Month</label>
              <input type="month" className="mr-search" value={specificMonth} onChange={(e) => applySpecificMonth(e.target.value)} />
            </div>
          )}
          <div className="mr-daterange-group">
            <div className="mr-filter-group">
              <label>From</label>
              <input
                type="date"
                className="mr-search"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setQuickRange("custom"); }}
              />
            </div>
            <div className="mr-filter-group">
              <label>To</label>
              <input
                type="date"
                className="mr-search"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setQuickRange("custom"); }}
              />
            </div>
          </div>
          <button
            className="mr-clear-btn"
            onClick={() => {
              setFilterStatus("All");
              setFilterCategory("All");
              setFilterSubCategory("All");
              setFilterAssigned("All");
              setFilterSupporting("All");
              setSearchQuery("");
              setDateFrom("");
              setDateTo("");
              setQuickRange("custom");
              setSpecificMonth("");
            }}
          >
            Clear Filters
          </button>
        </div>
        <span className="mr-count">{filtered.length} report{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <p className="mr-loading">Loading reports...</p>
      ) : (
        <div className="mr-layout">
          <div className="mr-table-card">
            <table className="mr-table">
              <colgroup>
                <col style={{ width: "8%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "9%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Submitted By</th>
                  <th>Email</th>
                  <th>Category</th>
                  <th>Type of Area</th>
                  <th>Date Submitted</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Primary Office</th>
                  <th>Supporting Office</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="11" className="mr-empty">No reports found.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={selectedReport?.id === r.id ? "mr-row--selected" : ""}
                      onClick={() => setSelectedReport(r)}
                    >
                      <td>#{r.reportId || r.id.slice(0, 6).toUpperCase()}</td>
                      <td>{r.fullName || "—"}</td>
                      <td>{r.email || "—"}</td>
                      <td>
                        <div>{r.category}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                          {r.subCategory === "Other"
                            ? (r.subCategoryOther || "Other")
                            : (r.subCategory || "—")}
                        </div>
                      </td>
                      <td>{r.areaType || "—"}</td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td>{r.description || "—"}</td>
                      <td>
                        {r.locationDescription && <div>{r.locationDescription}</div>}
                        {r.addressInput ? (
                          <div style={{ fontSize: '0.78rem', color: '#888' }}>{r.addressInput}</div>
                        ) : r.location ? (
                          <div style={{ fontSize: '0.78rem', color: '#888' }}>
                            {addresses[r.id] || 'Resolving...'}
                          </div>
                        ) : null}
                        {!r.locationDescription && !r.addressInput && !r.location && '—'}
                      </td>
                      <td>{officeLabel(r)}</td>
                      <td>{supportingOfficesLabel(r)}</td>
                      <td><span className={getStatusClass(r.status)}>{r.status || "Pending"}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mr-cards">
            {filtered.length === 0 ? (
              <p className="mr-empty">No reports found.</p>
            ) : (
              filtered.map((r) => (
                <div
                  key={r.id}
                  className="mr-card"
                  onClick={() => setSelectedReport(r)}
                >
                  <div className="mr-card-top">
                    <span className="mr-card-id">#{r.reportId || r.id.slice(0, 6).toUpperCase()}</span>
                    <span className={getStatusClass(r.status)}>{r.status || "Pending"}</span>
                  </div>
                  <div className="mr-card-row"><strong>{r.fullName || "—"}</strong></div>
                  <div className="mr-card-row mr-card-sub">{r.email || "—"}</div>
                  <div className="mr-card-row">
                    {r.category}
                    {r.subCategory && (
                      <span className="mr-card-sub"> — {r.subCategory === "Other" ? (r.subCategoryOther || "Other") : r.subCategory}</span>
                    )}
                  </div>
                  <div className="mr-card-row mr-card-sub">{r.areaType || "—"} · {formatDate(r.createdAt)}</div>
                  {r.description && <div className="mr-card-row mr-card-desc">{r.description}</div>}
                  <div className="mr-card-row mr-card-sub">
                    {r.locationDescription || r.addressInput || (r.location ? (addresses[r.id] || 'Resolving...') : '—')}
                  </div>
                  <div className="mr-card-row mr-card-sub">Office: {officeLabel(r)}</div>
                  <div className="mr-card-row mr-card-sub">Supporting: {supportingOfficesLabel(r)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedReport && (
      <div className="mr-modal-overlay" onClick={() => setSelectedReport(null)}>
        <div className="mr-detail mr-detail--modal" onClick={(e) => e.stopPropagation()}>
          <div className="mr-detail-header">
            <div className="mr-detail-header-left">
              <h3>#{selectedReport.reportId || selectedReport.id.slice(0, 6).toUpperCase()}</h3>
              <span className={getStatusClass(selectedReport.status)}>
                {selectedReport.status || "Pending"}
              </span>
            </div>
            <button className="mr-close" onClick={() => setSelectedReport(null)}>✕</button>
          </div>

          <div className="mr-detail-columns">
            {/* LEFT COLUMN — Report Information */}
            <div className="mr-detail-col-left">
              <div className="mr-detail-row">
                <span className="mr-detail-label">Submitted By</span>
                <span className="mr-detail-value">{selectedReport.fullName || "—"}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Email</span>
                <span className="mr-detail-value">{selectedReport.email || "Not provided"}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Contact Number</span>
                <span className="mr-detail-value">
                  {loadingContact ? "Loading..." : (reportContactNumber || "Not provided")}
                </span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Category</span>
                <span className="mr-detail-value">{selectedReport.category}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Sub-Category</span>
                <span className="mr-detail-value">
                  {selectedReport.subCategory === "Other"
                    ? (selectedReport.subCategoryOther || "Other")
                    : (selectedReport.subCategory || "—")}
                </span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Type of Area</span>
                <span className="mr-detail-value">{selectedReport.areaType || "—"}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Date Submitted</span>
                <span className="mr-detail-value">{formatDate(selectedReport.createdAt)}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Description</span>
                <span className="mr-detail-value">{selectedReport.description || "—"}</span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Location Description</span>
                <span className="mr-detail-value">
                  {selectedReport.locationDescription || 'Not provided by citizen'}
                </span>
              </div>
              <div className="mr-detail-row">
                <span className="mr-detail-label">Address</span>
                <span className="mr-detail-value">
                  {selectedReport.addressInput
                    ? selectedReport.addressInput
                    : selectedReport.location
                      ? (addresses[selectedReport.id] || 'Resolving...')
                      : '—'}
                </span>
              </div>
              {selectedPhotos.length > 0 && (
                <div className="mr-detail-photo">
                  <span className="mr-detail-label">Photos</span>
                  <div className="mr-photo-gallery">
                    {selectedPhotos.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Report ${i + 1}`}
                        className="mr-photo mr-photo--gallery"
                        onClick={() => setLightbox({ photos: selectedPhotos, index: i })}
                      />
                    ))}
                  </div>
                  <span className="mr-photo-hint">Click a photo to enlarge</span>
                </div>
              )}
              <div className="mr-detail-row">
                <span className="mr-detail-label">Primary Office</span>
                <span className="mr-detail-value">{officeLabel(selectedReport)}</span>
              </div>
            </div>
            <div className="mr-detail-row">
               <span className="mr-detail-label">Supporting Office</span>
               <span className="mr-detail-value">{supportingOfficesLabel(selectedReport)}</span>
            </div>

            {/* RIGHT COLUMN — Actions / Coordination / History */}
            <div className="mr-detail-col-right">
              {selectedReport.status === "Rejected" && (
                <div className="mr-detail-row">
                  <span className="mr-detail-label">Rejection Reason</span>
                  <span className="mr-detail-value mr-detail-value--rejected">
                    {selectedReport.rejectionReason || "—"}
                  </span>
                </div>
              )}

            <div className="mr-workflow-group">
              <div className="mr-status-actions">
                <p className="mr-detail-label">Actions</p>
                {selectedReport.escalation?.status === "open" && (
                  <div className="mr-escalation-banner">
                    <strong>Escalated by {selectedReport.escalation.raisedByOffice}</strong>
                    <span>{selectedReport.escalation.reason}</span>
                  </div>
                )}
                {renderActions()}
              </div>

              <div className="mr-support-section">
                <p className="mr-detail-label">Supporting Offices</p>
                {(selectedReport.supportingOffices || []).length === 0 ? (
                  <p className="mr-no-action">No supporting offices requested.</p>
                ) : (
                  <div className="mr-support-list">
                    {selectedReport.supportingOffices.map((so) => (
                      <div key={so.id} className="mr-support-item">
                        <span className="mr-support-office">{so.officeId}</span>
                        <span className={`mr-support-status mr-support-status--${so.status}`}>{so.status}</span>
                        <span className="mr-support-reason">{so.reason}</span>
                        {so.remarks && (
                          <span className="mr-support-remarks">Remarks: {so.remarks}</span>
                        )}
                        {so.status === "pending" && currentOffice === so.officeId && (
                          <div className="mr-support-actions">
                            <button className="mr-action-btn mr-action-btn--approve" onClick={() => openAcceptConfirm(so)} disabled={supportBusy}>
                              Accept
                            </button>
                            <button className="mr-action-btn mr-action-btn--reject" onClick={() => openDeclineModal(so)} disabled={supportBusy}>
                              Decline
                            </button>
                          </div>
                        )}
                        {so.status === "accepted" && currentOffice === so.officeId && (
                          <>
                            {["Approved", "Ongoing"].includes(selectedReport.status) ? (
                              <div className="mr-support-actions">
                                <button className="mr-action-btn mr-action-btn--ongoing" onClick={() => handleUpdateSupportProgress(so, "ongoing")} disabled={supportBusy}>
                                  ▶ Mark Our Part as Ongoing
                                </button>
                              </div>
                            ) : (
                              <span className="mr-support-waiting">Waiting for Primary Office to approve the report first.</span>
                            )}
                          </>
                        )}
                        {so.status === "ongoing" && currentOffice === so.officeId && (
                          <>
                            {["Approved", "Ongoing"].includes(selectedReport.status) ? (
                              <div className="mr-support-actions">
                                <button className="mr-action-btn mr-action-btn--resolved" onClick={() => handleUpdateSupportProgress(so, "completed")} disabled={supportBusy}>
                                  ✔ Mark Our Part as Completed
                                </button>
                              </div>
                            ) : (
                              <span className="mr-support-waiting">Waiting for Primary Office to approve the report first.</span>
                            )}
                          </>
                        )}
                        {so.status === "declined" && so.declineReason && (
                          <span className="mr-support-decline-reason">Reason: {so.declineReason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {currentOffice === selectedReport.primaryOffice &&
                  selectedReport.status !== "Resolved" &&
                  selectedReport.status !== "Rejected" && (
                  <button
                    className="mr-action-btn mr-action-btn--ongoing"
                    onClick={openSupportModal}
                    disabled={selectedReport.id === 'SAMPLE_REPORT'}
                  >
                    + Request Supporting Office
                  </button>
                )}
              </div>

              <div className="mr-reroute-section">
                <p className="mr-detail-label">Re-route</p>
                {selectedReport.rerouteRequest ? (
                  <div className="mr-reroute-pending">
                    <span className="mr-reroute-target">→ {selectedReport.rerouteRequest.targetOffice}</span>
                    <span className="mr-support-status mr-support-status--pending">pending</span>
                    <span className="mr-support-reason">{selectedReport.rerouteRequest.reason}</span>
                    {currentOffice === selectedReport.rerouteRequest.targetOffice && (
                      <div className="mr-support-actions">
                        <button className="mr-action-btn mr-action-btn--approve" onClick={openRerouteAcceptConfirm} disabled={rerouteBusy}>
                          Accept
                        </button>
                        <button className="mr-action-btn mr-action-btn--reject" onClick={openRerouteDeclineModal} disabled={rerouteBusy}>
                          Decline
                        </button>
                      </div>
                    )}
                    {currentOffice === selectedReport.primaryOffice && currentOffice !== selectedReport.rerouteRequest.targetOffice && (
                      <span className="mr-no-action">Awaiting response from {selectedReport.rerouteRequest.targetOffice}.</span>
                    )}
                  </div>
                ) : (
                  <p className="mr-no-action">No active re-route request.</p>
                )}
                {currentOffice === selectedReport.primaryOffice &&
                  !selectedReport.rerouteRequest &&
                  selectedReport.status !== "Resolved" &&
                  selectedReport.status !== "Rejected" && (
                    (selectedReport.rerouteCount || 0) >= MAX_REROUTES ? (
                      <p className="mr-no-action">Maximum re-routes reached for this report. Use Escalate instead.</p>
                    ) : (
                      <button
                        className="mr-action-btn mr-action-btn--ongoing"
                        onClick={openRerouteModal}
                        disabled={selectedReport.id === 'SAMPLE_REPORT'}
                      >
                        ⇄ Request Re-route
                      </button>
                    )
                  )}
              </div>

              <div className="mr-escalation-section">
                {currentOffice === selectedReport.primaryOffice &&
                  selectedReport.escalation?.status !== "open" &&
                  selectedReport.status !== "Resolved" &&
                  selectedReport.status !== "Rejected" && (
                  <button
                    className="mr-action-btn mr-action-btn--reject"
                    onClick={openEscalateModal}
                    disabled={selectedReport.id === 'SAMPLE_REPORT'}
                  >
                    ⚠ Escalate to Master Admin
                  </button>
                )}
              </div>
            </div>

              <div className="mr-history-section">
                <p className="mr-detail-label">Status History</p>
                {loadingHistory ? (
                  <p className="mr-history-loading">Loading history...</p>
                ) : statusHistory.length === 0 ? (
                  <p className="mr-history-empty">No history recorded yet.</p>
                ) : (
                  <div className="mr-history-list">
                    {statusHistory.map((h) => (
                      <div key={h.id} className="mr-history-item">
                        <span className={getStatusClass(h.status)}>{h.status}</span>
                        <span className="mr-history-admin">
                          <span className="mr-history-admin-label">Updated by:</span> {adminNameMap[h.adminEmail] || h.adminEmail}
                        </span>
                        <span className="mr-history-date">{formatDate(h.timestamp)}</span>
                        {h.notes && <p className="mr-history-notes">{h.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="mr-modal-overlay">
          <div className="mr-modal">
            {!rejectConfirming ? (
              <>
                <h3>Reason for Rejection</h3>
                <p>Please provide a reason why this report is being rejected.</p>
                <textarea
                  className="mr-reject-textarea"
                  placeholder="Enter reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                />
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleRejectReasonNext}>
                    Next
                  </button>
                  <button className="mr-modal-cancel" onClick={handleRejectCancel}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h3>Confirm Rejection</h3>
                <p>
                  Reject report <strong>#{selectedReport?.reportId || selectedReport?.id?.slice(0, 6).toUpperCase()}</strong> with this reason?
                </p>
                <p className="mr-modal-suggestion">{rejectReason}</p>
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleRejectConfirm}>
                    ✔ Confirm Reject
                  </button>
                </div>
                <button className="mr-modal-cancel" onClick={() => setRejectConfirming(false)}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {supportModal && (
        <div className="mr-modal-overlay" onClick={() => setSupportModal(false)}>
          <div className="mr-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Request Supporting Office</h3>
            <p>Select an office and explain why their support is needed.</p>
            <select
              value={supportTargetOffice}
              onChange={(e) => setSupportTargetOffice(e.target.value)}
              style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
            >
              <option value="">Select office...</option>
              {ACTIVE_OFFICE_LIST.filter((o) => {
                if (o === currentOffice) return false;
                const active = (selectedReport?.supportingOffices || []).some(
                  (so) => so.officeId === o && ["pending", "accepted", "ongoing"].includes(so.status)
                );
                return !active;
              }).map((o) => <option key={o}>{o}</option>)}
            </select>
            <textarea
              className="mr-reject-textarea"
              placeholder="Reason for requesting support..."
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
              rows={3}
            />
            <textarea
              className="mr-reject-textarea"
              placeholder="Additional remarks (optional)..."
              value={supportRemarks}
              onChange={(e) => setSupportRemarks(e.target.value)}
              rows={2}
            />
            <div className="mr-modal-btns">
              <button
                className="mr-modal-btn mr-modal-btn--emb"
                onClick={handleSubmitSupportRequest}
                disabled={supportBusy}
              >
                Send Request
              </button>
            </div>
            <button className="mr-modal-cancel" onClick={() => setSupportModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {rerouteModal && (
        <div className="mr-modal-overlay" onClick={() => setRerouteModal(false)}>
          <div className="mr-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Request Re-route</h3>
            <p>Select the office you believe should be responsible, and explain why.</p>
            <select
              value={rerouteTargetOffice}
              onChange={(e) => setRerouteTargetOffice(e.target.value)}
              style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
            >
              <option value="">Select office...</option>
              {ACTIVE_OFFICE_LIST.filter((o) =>
                o !== currentOffice && !(selectedReport?.primaryOfficeHistory || []).includes(o)
              ).map((o) => <option key={o}>{o}</option>)}
            </select>
            <textarea
              className="mr-reject-textarea"
              placeholder="Reason for requesting re-route..."
              value={rerouteReason}
              onChange={(e) => setRerouteReason(e.target.value)}
              rows={3}
            />
            <div className="mr-modal-btns">
              <button
                className="mr-modal-btn mr-modal-btn--emb"
                onClick={handleSubmitRerouteRequest}
                disabled={rerouteBusy}
              >
                Send Request
              </button>
            </div>
            <button className="mr-modal-cancel" onClick={() => setRerouteModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {rerouteDecisionModal && (
        <div className="mr-modal-overlay" onClick={handleCancelRerouteDecision}>
          <div className="mr-modal" onClick={(e) => e.stopPropagation()}>
            {rerouteDecisionModal.action === "accept" ? (
              <>
                <h3>Confirm Acceptance</h3>
                <p>
                  Accept this re-route? <strong>{currentOffice}</strong> will become the new Primary Office, and the report will reset to <strong>Pending</strong> for your validation.
                </p>
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleConfirmRerouteDecision} disabled={rerouteBusy}>
                    ✔ Confirm Accept
                  </button>
                </div>
                <button className="mr-modal-cancel" onClick={handleCancelRerouteDecision}>Cancel</button>
              </>
            ) : !rerouteDecisionConfirming ? (
              <>
                <h3>Reason for Declining</h3>
                <p>Please provide a reason for declining this re-route request.</p>
                <textarea
                  className="mr-reject-textarea"
                  placeholder="Enter reason for declining..."
                  value={rerouteDeclineReason}
                  onChange={(e) => setRerouteDeclineReason(e.target.value)}
                  rows={4}
                />
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleRerouteDeclineReasonNext}>
                    Next
                  </button>
                  <button className="mr-modal-cancel" onClick={handleCancelRerouteDecision}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h3>Confirm Decline</h3>
                <p>Decline this re-route request with this reason?</p>
                <p className="mr-modal-suggestion">{rerouteDeclineReason}</p>
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleConfirmRerouteDecision} disabled={rerouteBusy}>
                    ✔ Confirm Decline
                  </button>
                </div>
                <button className="mr-modal-cancel" onClick={() => setRerouteDecisionConfirming(false)}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {escalateModal && (
        <div className="mr-modal-overlay" onClick={() => setEscalateModal(false)}>
          <div className="mr-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Escalate to Master Admin</h3>
            <p>Explain why this report's routing needs Master Admin's oversight (e.g. offices cannot agree on responsibility).</p>
            <textarea
              className="mr-reject-textarea"
              placeholder="Reason for escalating..."
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              rows={4}
            />
            <div className="mr-modal-btns">
              <button
                className="mr-modal-btn mr-modal-btn--emb"
                onClick={handleSubmitEscalation}
                disabled={escalateBusy}
              >
                Escalate
              </button>
            </div>
            <button className="mr-modal-cancel" onClick={() => setEscalateModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {supportDecisionModal && (
        <div className="mr-modal-overlay" onClick={handleCancelSupportDecision}>
          <div className="mr-modal" onClick={(e) => e.stopPropagation()}>
            {supportDecisionModal.action === "accept" ? (
              <>
                <h3>Confirm Acceptance</h3>
                <p>
                  Accept the support request from <strong>{currentOffice}</strong>'s side for this report?
                </p>
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleConfirmSupportDecision} disabled={supportBusy}>
                    ✔ Confirm Accept
                  </button>
                </div>
                <button className="mr-modal-cancel" onClick={handleCancelSupportDecision}>Cancel</button>
              </>
            ) : !supportDecisionConfirming ? (
              <>
                <h3>Reason for Declining</h3>
                <p>Please provide a reason for declining this support request.</p>
                <textarea
                  className="mr-reject-textarea"
                  placeholder="Enter reason for declining..."
                  value={supportDeclineReason}
                  onChange={(e) => setSupportDeclineReason(e.target.value)}
                  rows={4}
                />
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleDeclineReasonNext}>
                    Next
                  </button>
                  <button className="mr-modal-cancel" onClick={handleCancelSupportDecision}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h3>Confirm Decline</h3>
                <p>Decline this support request with this reason?</p>
                <p className="mr-modal-suggestion">{supportDeclineReason}</p>
                <div className="mr-modal-btns">
                  <button className="mr-modal-btn mr-modal-btn--emb" onClick={handleConfirmSupportDecision} disabled={supportBusy}>
                    ✔ Confirm Decline
                  </button>
                </div>
                <button className="mr-modal-cancel" onClick={() => setSupportDecisionConfirming(false)}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div className="mr-lightbox-overlay" onClick={() => setLightbox(null)}>
          <div className="mr-lightbox">
            <button className="mr-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
            {lightbox.photos.length > 1 && (
              <button className="mr-lightbox-nav mr-lightbox-nav--prev" onClick={showPrevPhoto} aria-label="Previous photo">‹</button>
            )}
            <img
              src={lightbox.photos[lightbox.index]}
              alt={`Report enlarged ${lightbox.index + 1}`}
              className="mr-lightbox-img"
            />
            {lightbox.photos.length > 1 && (
              <button className="mr-lightbox-nav mr-lightbox-nav--next" onClick={showNextPhoto} aria-label="Next photo">›</button>
            )}
            {lightbox.photos.length > 1 && (
              <div className="mr-lightbox-counter">{lightbox.index + 1} / {lightbox.photos.length}</div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}