import React, { useEffect, useState } from "react";

const USER_KEY = "healthUsers";
const readUsers = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(USER_KEY) || "[]");
    if (Array.isArray(saved) && saved.length) return saved;
    const old = JSON.parse(localStorage.getItem("healthUser") || "null");
    if (!old) return [];
    const contact = old.emailOrPhone || "";
    const migrated = [{
      id: "HRS-" + Date.now(), role: "patient", name: old.name || "",
      dob: "", gender: "", phone: contact.includes("@") ? "" : contact,
      email: contact.includes("@") ? contact.toLowerCase() : "",
      emailOrPhone: contact, password: old.password || "",
      healthRecords: old.healthRecords || [], prescriptions: []
    }];
    localStorage.setItem(USER_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
};
const saveUsers = users => localStorage.setItem(USER_KEY, JSON.stringify(users));
const readFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function App() {
  const [users, setUsers] = useState(readUsers);
  const [page, setPage] = useState(() => {
    if (!sessionStorage.getItem("currentUserId")) return "login";
    const savedRole = sessionStorage.getItem("currentUserRole");
    return savedRole === "doctor" ? "doctor" : savedRole === "admin" || savedRole === "provider" ? "admin" : "dashboard";
  });
  const [userId, setUserId] = useState(() => sessionStorage.getItem("currentUserId") || "");
  const [role, setRole] = useState("user");
  const [active, setActive] = useState("overview");
  const [message, setMessage] = useState("");
  const [recordModal, setRecordModal] = useState(false);
  const [prescriptionModal, setPrescriptionModal] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [editingRecord, setEditingRecord] = useState("");
  const [recordForm, setRecordForm] = useState(emptyRecord());
  const [prescriptionMessage, setPrescriptionMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  const currentUser = users.find(item => String(item.id) === String(userId));

  useEffect(() => {
    let next = users.map(item => item.role === "provider" ? {
      ...item,
      role: "admin",
      name: "Project Admin",
      email: "admin@hrs.com",
      emailOrPhone: "admin@hrs.com",
      password: "admin123"
    } : item);
    if (!next.some(item => item.role === "admin")) {
      next = [...next, {
        id: "ADMIN-001",
        role: "admin",
        name: "Project Admin",
        email: "admin@hrs.com",
        emailOrPhone: "admin@hrs.com",
        password: "admin123"
      }];
    }
    if (!next.some(item => item.role === "doctor")) {
      next = [...next, {
        id: "DOC-001",
        role: "doctor",
        name: "Dr. Sana (Demo)",
        email: "doctor@hrs.com",
        emailOrPhone: "doctor@hrs.com",
        password: "doctor123",
        status: "approved",
        specialty: "General Medicine",
        clinic: "Demo Health Clinic",
        licenseId: "DEMO-LICENSE-001"
      }];
    }
    if (JSON.stringify(next) !== JSON.stringify(users)) {
      setUsers(next);
      saveUsers(next);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem("currentUserId", currentUser.id);
      sessionStorage.setItem("currentUserRole", currentUser.role);
    }
  }, [currentUser]);

  useEffect(() => {
    const syncAccounts = event => {
      if (!event.key || event.key === USER_KEY) setUsers(readUsers());
    };
    window.addEventListener("storage", syncAccounts);
    return () => window.removeEventListener("storage", syncAccounts);
  }, []);

  function updateCurrentUser(changes) {
    if (!currentUser) return;
    const updated = { ...currentUser, ...changes };
    const next = users.map(item => String(item.id) === String(currentUser.id) ? updated : item);
    setUsers(next);
    saveUsers(next);
  }

  function login(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") || "").trim();
    const password = String(data.get("password") || "").trim();
    const found = users.find(item => {
      const accountIsAdmin = item.role === "admin" || item.role === "provider";
      const accountIsDoctor = item.role === "doctor";
      const accountIsUser = item.role === "user" || item.role === "patient";
      if ((role === "admin" && !accountIsAdmin) || (role === "doctor" && !accountIsDoctor) || (role === "user" && !accountIsUser) || item.password !== password) return false;
      const entered = identifier.toLowerCase();
      return String(item.id || "").toLowerCase() === entered ||
        String(item.email || "").toLowerCase() === entered ||
        String(item.emailOrPhone || "").toLowerCase() === entered ||
        String(item.phone || "") === identifier;
    });
    if (!found) {
      setMessage("Invalid email/phone or password.");
      return;
    }
    setUserId(String(found.id));
    setPage(found.role === "doctor" ? "doctor" : found.role === "provider" || found.role === "admin" ? "admin" : "dashboard");
    setMessage("");
  }

  function doctorLogin(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") || "").trim().toLowerCase();
    const password = String(data.get("password") || "").trim();
    const identifierWithoutPrefix = identifier.replace(/^doc[-\s]*/, "");
    const doctor = users.find(item => {
      if (item.role !== "doctor") return false;
      const doctorId = String(item.id || "").trim().toLowerCase();
      const doctorIdWithoutPrefix = doctorId.replace(/^doc[-\s]*/, "");
      return doctorId === identifier || doctorIdWithoutPrefix === identifierWithoutPrefix ||
        String(item.email || "").trim().toLowerCase() === identifier ||
        String(item.emailOrPhone || "").trim().toLowerCase() === identifier;
    });
    if (!doctor) {
      setMessage("Doctor account not found in this browser. Use the same site where you signed up and got approved.");
      return;
    }
    if (doctor.status === "pending") {
      setMessage("Your doctor account is waiting for Admin approval.");
      return;
    }
    if (doctor.status === "rejected") {
      setMessage("This doctor account was not approved. Contact the Admin.");
      return;
    }
    if (String(doctor.password || "").trim() !== password) {
      setMessage("The password does not match this Doctor account. Check the password set during signup.");
      return;
    }
    setUserId(String(doctor.id));
    setPage("doctor");
    setMessage("");
  }

  function signup(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const contact = String(data.get("contact") || "").trim();
    const password = String(data.get("password") || "");
    if (password !== data.get("confirmPassword")) {
      setMessage("Passwords do not match.");
      return;
    }
    if (users.some(item => (item.role === "patient" || item.role === "user") && String(item.emailOrPhone || "").toLowerCase() === contact.toLowerCase())) {
      setMessage("An account already exists with this email or phone.");
      return;
    }
    const nextUser = {
      id: "HRS-" + Date.now(),
      role: "user",
      name: String(data.get("name") || "").trim(),
      dob: String(data.get("dob") || ""),
      gender: String(data.get("gender") || ""),
      phone: contact.includes("@") ? "" : contact,
      email: contact.includes("@") ? contact.toLowerCase() : "",
      emailOrPhone: contact,
      password,
      healthRecords: [],
      prescriptions: [],
      doctorNotes: [],
      followUps: []
    };
    const next = [...users, nextUser];
    setUsers(next);
    saveUsers(next);
    setRole("user");
    setMessage("Account created. You can now log in.");
    setPage("login");
  }

  function doctorSignup(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim().toLowerCase();
    const licenseId = String(data.get("licenseId") || "").trim();
    const password = String(data.get("password") || "").trim();
    if (password !== String(data.get("confirmPassword") || "").trim()) {
      setMessage("Passwords do not match.");
      return;
    }
    const existingDoctor = users.find(item => item.role === "doctor" && String(item.email || "").trim().toLowerCase() === email);
    const licenseOwner = users.find(item => item.role === "doctor" && String(item.licenseId || "").trim().toLowerCase() === licenseId.toLowerCase());
    if (licenseOwner && String(licenseOwner.id) !== String(existingDoctor?.id || "")) {
      setMessage("This registration ID is already linked to a different Doctor account. Check the ID or use the account's existing email.");
      return;
    }
    const doctorId = existingDoctor?.id || "DOC-" + Date.now().toString().slice(-7);
    const doctor = {
      ...(existingDoctor || {}),
      id: doctorId,
      role: "doctor",
      status: "pending",
      name: String(data.get("name") || "").trim(),
      specialty: String(data.get("specialty") || "").trim(),
      clinic: String(data.get("clinic") || "").trim(),
      licenseId,
      email,
      emailOrPhone: email,
      password
    };
    const next = existingDoctor
      ? users.map(item => String(item.id) === String(existingDoctor.id) ? doctor : item)
      : [...users, doctor];
    setUsers(next);
    saveUsers(next);
    setMessage(`${existingDoctor ? "Doctor details updated and resubmitted." : "Request submitted."} Doctor ID: ${doctorId}. Wait for Admin approval.`);
    setPage("doctorLogin");
  }

  function logout() {
    sessionStorage.removeItem("currentUserId");
    sessionStorage.removeItem("currentUserRole");
    setUserId("");
    setPage("login");
    setRole("user");
    setActive("overview");
  }

  function openNewRecord() {
    setEditingRecord("");
    setRecordForm(emptyRecord());
    setPrescriptionMessage("");
    setRecordModal(true);
  }

  function openPrescriptionUpload() {
    setPrescriptionMessage("");
    setPrescriptionModal(true);
  }

  function openEditRecord(record) {
    setEditingRecord(String(record.id));
    setRecordForm({
      category: record.category || "",
      reportName: record.reportName || "",
      reportDate: record.reportDate || "",
      problemStatement: record.problemStatement || "",
      fileData: record.fileData || "",
      fileName: record.fileName || "",
      fileType: record.fileType || "",
      attachments: getRecordAttachments(record).filter(item => item.kind !== "prescription"),
      prescriptionAttachments: getRecordAttachments(record).filter(item => item.kind === "prescription")
    });
    setPrescriptionMessage("");
    setRecordModal(true);
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!currentUser) return;
    const reportFiles = Array.from(event.currentTarget.reportFiles.files || []);
    const prescriptionFiles = Array.from(event.currentTarget.prescriptionFiles.files || []);
    if (!editingRecord && !reportFiles.length) {
      alert("Please upload at least one medical report or lab result.");
      return;
    }
    if ([...reportFiles, ...prescriptionFiles].some(file => !["application/pdf", "image/jpeg", "image/png"].includes(file.type))) {
      alert("Only PDF, JPG, JPEG and PNG files are allowed.");
      return;
    }
    const existing = currentUser.healthRecords || [];
    const old = existing.find(item => String(item.id) === editingRecord);
    const existingAttachments = old ? getRecordAttachments(old) : [];
    const addedReportAttachments = await Promise.all(reportFiles.map(async (file, index) => ({
      id: `FILE-${Date.now()}-${index}`,
      kind: "report",
      fileData: await readFile(file),
      fileName: file.name,
      fileType: file.type
    })));
    const addedPrescriptionAttachments = await Promise.all(prescriptionFiles.map(async (file, index) => ({
      id: `RX-${Date.now()}-${index}`,
      kind: "prescription",
      fileData: await readFile(file),
      fileName: file.name,
      fileType: file.type,
      date: new Date().toLocaleDateString()
    })));
    const attachments = [...existingAttachments, ...addedReportAttachments, ...addedPrescriptionAttachments];
    const firstReport = attachments.find(item => item.kind !== "prescription");
    const recordId = old ? old.id : String(Date.now());
    const nextRecord = {
      ...(old || {}),
      id: recordId,
      category: recordForm.category,
      reportName: recordForm.reportName.trim(),
      reportDate: recordForm.reportDate,
      problemStatement: recordForm.problemStatement.trim(),
      attachments,
      fileData: firstReport?.fileData || "",
      fileName: firstReport?.fileName || "",
      fileType: firstReport?.fileType || ""
    };
    const nextRecords = old
      ? existing.map(item => String(item.id) === editingRecord ? nextRecord : item)
      : [nextRecord, ...existing];
    const newPrescriptionItems = addedPrescriptionAttachments.map(item => ({ ...item, recordId }));
    updateCurrentUser({ healthRecords: nextRecords, prescriptions: [...newPrescriptionItems, ...(currentUser.prescriptions || [])] });
    setRecordModal(false);
  }

  async function savePrescriptionPaper(file) {
    if (!currentUser) return;
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPrescriptionMessage("Please choose a JPG or PNG image.");
      const input = document.getElementById("prescriptionPaperFile");
      if (input) input.value = "";
      return;
    }
    setPrescriptionMessage("Saving prescription picture…");
    try {
      const item = {
        id: "RX-" + Date.now(),
        fileName: file.name,
        fileType: file.type,
        fileData: await readFile(file),
        date: new Date().toLocaleDateString()
      };
      const updatedUser = { ...currentUser, prescriptions: [item, ...(currentUser.prescriptions || [])] };
      const nextUsers = users.map(user => String(user.id) === String(currentUser.id) ? updatedUser : user);
      saveUsers(nextUsers);
      setUsers(nextUsers);
      setPrescriptionMessage("Prescription picture saved.");
      const input = document.getElementById("prescriptionPaperFile");
      if (input) input.value = "";
      setPrescriptionModal(false);
    } catch {
      setPrescriptionMessage("Could not save this image. Try a smaller picture.");
    }
  }

  function deleteRecord(id) {
    if (!confirm("Delete this health record?")) return;
    updateCurrentUser({
      healthRecords: (currentUser.healthRecords || []).filter(item => String(item.id) !== String(id)),
      prescriptions: (currentUser.prescriptions || []).filter(item => String(item.recordId || "") !== String(id))
    });
  }

  function deletePrescription(id) {
    if (!confirm("Delete this prescription picture?")) return;
    updateCurrentUser({
      prescriptions: (currentUser.prescriptions || []).filter(item => String(item.id) !== String(id)),
      healthRecords: (currentUser.healthRecords || []).map(record => ({
        ...record,
        attachments: getRecordAttachments(record).filter(item => String(item.id) !== String(id))
      }))
    });
  }

  function viewFile(fileData, fileName = "Medical file", fileType = "") {
    if (!fileData) return;
    setViewingFile({ fileData, fileName, fileType });
  }

  function saveProfile(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateCurrentUser({
      name: String(data.get("name") || "").trim(),
      dob: String(data.get("dob") || ""),
      gender: String(data.get("gender") || ""),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim()
    });
    setProfileMessage("Profile updated successfully!");
  }

  function generateDoctorAccess() {
    if (!currentUser) return;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    updateCurrentUser({ doctorAccess: { code, expiresAt: Date.now() + 15 * 60 * 1000, doctorId: "" } });
  }

  function revokeDoctorAccess() {
    if (!currentUser) return;
    updateCurrentUser({ doctorAccess: null });
  }

  if (page === "signup") {
    return <Signup onSubmit={signup} onLogin={() => { setMessage(""); setPage("login"); }} message={message} />;
  }
  if (page === "doctorLogin") {
    return <DoctorLogin onSubmit={doctorLogin} onSignup={() => { setMessage(""); setPage("doctorSignup"); }} onBack={() => { setMessage(""); setPage("login"); }} message={message} />;
  }
  if (page === "doctorSignup") {
    return <DoctorSignup onSubmit={doctorSignup} onLogin={() => { setMessage(""); setPage("doctorLogin"); }} message={message} />;
  }
  if (page === "login") {
    return <Login role={role} setRole={setRole} onSubmit={login} onSignup={() => { setMessage(""); setPage("signup"); }} onDoctorLogin={() => { setMessage(""); setPage("doctorLogin"); }} message={message} />;
  }
  if (!currentUser) {
    setPage("login");
    return null;
  }
  if (page === "admin") {
    return <AdminPage user={currentUser} users={users} setUsers={setUsers} onLogout={logout} onViewFile={viewFile} viewingFile={viewingFile} onCloseFile={() => setViewingFile(null)} />;
  }
  if (page === "doctor") {
    return <DoctorPage user={currentUser} users={users} setUsers={setUsers} onLogout={logout} onViewFile={viewFile} viewingFile={viewingFile} onCloseFile={() => setViewingFile(null)} />;
  }

  const records = currentUser.healthRecords || [];
  const reports = records.filter(item => getRecordAttachments(item).some(file => file.kind !== "prescription"));
  const prescriptions = currentUser.prescriptions || [];

  return (
    <div className="dashboard-body">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-brand-icon">♥</div>
          <div><h2>Health Record System</h2><p>Personal Health Dashboard</p></div>
        </div>
        <div className="dashboard-user">
          <div className="user-avatar">👤</div>
          <div className="user-info"><strong>{currentUser.name || "Patient"}</strong><span>User</span></div>
          <button className="dashboard-logout" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <nav>
            <NavButton icon="🏠" label="Dashboard" id="overview" active={active} onClick={setActive} />
            <NavButton icon="❤️" label="My Health Records" id="records" active={active} onClick={setActive} />
            <NavButton icon="📄" label="Reports" id="reports" active={active} onClick={setActive} />
            <NavButton icon="💊" label="Prescriptions" id="prescriptions" active={active} onClick={setActive} />
            <NavButton icon="📋" label="Health History" id="history" active={active} onClick={setActive} />
            <NavButton icon="🔑" label="Share with Doctor" id="share" active={active} onClick={setActive} />
          </nav>
          <div className="sidebar-bottom">
            <NavButton icon="👤" label="Profile" id="profile" active={active} onClick={setActive} />
            <button className="sidebar-item sidebar-logout" onClick={logout}><span>🚪</span><span>Logout</span></button>
          </div>
        </aside>

        <main className="dashboard-content">
          {active === "overview" && (
            <section className="dashboard-section">
              <div className="dashboard-welcome">
                <div><span className="section-label">YOUR HEALTH, ORGANIZED</span><h1>Welcome back, {currentUser.name || "Patient"}!</h1><p>Here is an overview of your health records.</p></div>
                <button className="primary-modal-btn" onClick={openNewRecord}>+ Add Health Record</button>
              </div>
              <div className="stats-grid">
                <Stat title="Health Records" value={records.length} icon="❤️" />
                <Stat title="Reports" value={reports.length} icon="📄" />
                <Stat title="Prescriptions" value={prescriptions.length} icon="💊" />
                <Stat title="Categories" value={new Set(records.map(item => item.category)).size} icon="📊" />
              </div>
              <div className="page-heading"><span className="section-label">HEALTH CATEGORIES</span><h2>Your Records</h2></div>
              <div className="category-grid">
                {Array.from(new Set(records.map(item => item.category))).length
                  ? Array.from(new Set(records.map(item => item.category))).map(category =>
                    <div className="category-card" key={category}><h3>{category}</h3><p>{records.filter(item => item.category === category).length} Records</p></div>)
                  : <p>No health categories available yet.</p>}
              </div>
            </section>
          )}

          {active === "records" && (
            <section className="dashboard-section">
              <PageHeading label="YOUR MEDICAL FILES" title="My Health Records" subtitle="Your medical records in one place." action={<button className="primary-modal-btn" onClick={openNewRecord}>+ Add Health Record</button>} />
              <RecordList records={records} onView={viewFile} onEdit={openEditRecord} onDelete={deleteRecord} />
            </section>
          )}

          {active === "reports" && (
            <section className="dashboard-section">
              <PageHeading label="UPLOADED FILES" title="Reports" subtitle="View your uploaded medical reports." action={<button className="primary-modal-btn" onClick={openNewRecord}>+ Add Health Record</button>} />
              <RecordList records={reports} onView={viewFile} onEdit={openEditRecord} onDelete={deleteRecord} />
            </section>
          )}

          {active === "prescriptions" && (
            <section className="dashboard-section">
              <PageHeading label="PRESCRIPTION PAPERS" title="Prescriptions" subtitle="Uploaded pictures of your prescription papers." action={<button className="primary-modal-btn" onClick={openPrescriptionUpload}>+ Add Prescription</button>} />
              <div className="record-grid">
                {prescriptions.length ? prescriptions.map(item => (
                  <article className="record-card" key={item.id}>
                    <h3>{item.fileName || "Prescription paper"}</h3>
                    <p>Uploaded: {item.date}</p>
                    <button type="button" className="prescription-image-button" onClick={() => viewFile(item.fileData, item.fileName || "Prescription paper", item.fileType)} aria-label={`Open ${item.fileName || "prescription paper"}`}>
                      <img src={item.fileData} alt={item.fileName || "Prescription paper"} className="prescription-preview" />
                    </button>
                    <div className="record-actions">
                      <button className="delete-record" onClick={() => deletePrescription(item.id)}>Delete</button>
                    </div>
                  </article>
                )) : <div className="dashboard-empty-state"><div className="empty-medical-icon">💊</div><p>No prescription papers uploaded yet.</p><button className="primary-modal-btn" onClick={openPrescriptionUpload}>Upload Prescription</button></div>}
              </div>
            </section>
          )}

          {active === "history" && (
            <section className="dashboard-section">
              <PageHeading label="HEALTH JOURNEY" title="Health History" subtitle="Records organized by date." />
              <div className="record-grid">
                {[...records].sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate)).map(item =>
                  <RecordCard key={item.id} record={item} onView={viewFile} onEdit={openEditRecord} onDelete={deleteRecord} />)}
                {!records.length && <p>No health history available.</p>}
              </div>
            </section>
          )}

          {active === "share" && (
            <section className="dashboard-section">
              <PageHeading label="PATIENT CONTROLLED ACCESS" title="Share Records with a Doctor" subtitle="Let a new doctor review your past health history without sharing your account password." />
              <div className="share-doctor-card">
                <div className="share-doctor-icon">🔐</div>
                <div className="share-doctor-copy"><h2>Temporary Doctor Access</h2><p>Generate a one-time 6-digit code and give the doctor your Patient ID <strong>{currentUser.id}</strong> plus this code. The code is valid for 15 minutes and becomes linked to the first doctor who uses it.</p></div>
                {currentUser.doctorAccess && currentUser.doctorAccess.expiresAt > Date.now() ? <div className="active-doctor-code"><span>YOUR ACCESS CODE</span><strong>{currentUser.doctorAccess.code}</strong><small>Expires at {new Date(currentUser.doctorAccess.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div> : <div className="share-code-expired">No active access code. Generate one when you are ready to share your records.</div>}
                <div className="share-doctor-actions"><button className="primary-modal-btn" onClick={generateDoctorAccess}>{currentUser.doctorAccess && currentUser.doctorAccess.expiresAt > Date.now() ? "Generate New Code" : "Generate Access Code"}</button>{currentUser.doctorAccess && <button className="secondary-btn" onClick={revokeDoctorAccess}>Revoke Access</button>}</div>
                <p className="share-doctor-footnote">You stay in control: revoke the code to stop future access. For this project demo, this sharing works only in the same browser.</p>
              </div>
            </section>
          )}

          {active === "profile" && (
            <section className="dashboard-section">
              <PageHeading label="PERSONAL INFORMATION" title="My Profile" subtitle="Review and update your profile details." />
              <div className="profile-card">
                <div className="profile-header-card">
                  <div className="profile-user-area"><div className="profile-avatar-large">👤</div><div className="profile-user-details"><span className="profile-label">PATIENT PROFILE</span><h2>{currentUser.name}</h2><p>{currentUser.email || currentUser.phone || currentUser.emailOrPhone}</p></div></div>
                  <span className="profile-id">{currentUser.id}</span>
                </div>
                <form className="profile-edit-area" onSubmit={saveProfile}>
                  <div className="profile-edit-grid">
                    <ProfileInput label="Full Name" name="name" defaultValue={currentUser.name} />
                    <ProfileInput label="Date of Birth" name="dob" type="date" defaultValue={currentUser.dob} />
                    <ProfileInput label="Phone" name="phone" defaultValue={currentUser.phone} />
                    <ProfileInput label="Email" name="email" type="email" defaultValue={currentUser.email} />
                    <div className="profile-edit-field"><label>Gender</label><select name="gender" defaultValue={currentUser.gender || ""} className="profile-edit-input"><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></div>
                  </div>
                  <div className="profile-save-row"><button className="profile-save-btn">Save Profile</button><span className="profile-save-message">{profileMessage}</span></div>
                </form>
              </div>
            </section>
          )}
        </main>
      </div>

      {recordModal && (
        <div className="modal-overlay show-modal" onMouseDown={event => { if (event.target === event.currentTarget) setRecordModal(false); }}>
          <div className="record-modal">
            <button className="modal-close" type="button" onClick={() => setRecordModal(false)}>×</button>
            <div className="modal-heading"><div className="modal-medical-icon">📄</div><div><h2>{editingRecord ? "Edit Health Record" : "Add Health Record"}</h2><p>Add a medical report to your health history.</p></div></div>
            <form onSubmit={saveRecord}>
              <div className="form-field"><label htmlFor="healthCategory">Health Category</label><select id="healthCategory" required value={recordForm.category} onChange={event => setRecordForm({ ...recordForm, category: event.target.value })}><option value="">Select health category</option>{[["Cardiovascular", "❤️"], ["Neurological", "🧠"], ["Respiratory", "🫁"], ["Musculoskeletal", "🦴"], ["Reproductive Health", "🌸"], ["General Medicine", "🩺"]].map(([option, icon]) => <option key={option} value={option}>{icon}  {option}</option>)}</select></div>
              <div className="form-field"><label>Report Name</label><input required value={recordForm.reportName} onChange={event => setRecordForm({ ...recordForm, reportName: event.target.value })} placeholder="Example: ECG Report" /></div>
              <div className="form-field"><label>Report Date</label><input type="date" required value={recordForm.reportDate} onChange={event => setRecordForm({ ...recordForm, reportDate: event.target.value })} /></div>
              <div className="form-field"><label>Report Findings / Impression</label><textarea required value={recordForm.problemStatement} onChange={event => setRecordForm({ ...recordForm, problemStatement: event.target.value })} placeholder="Enter the findings or impression written in the medical report..." /></div>
              <div className="form-field"><label>Upload Reports / Lab Results</label><div className="file-upload-box"><input type="file" name="reportFiles" accept="application/pdf,image/jpeg,image/png" multiple required={!editingRecord} /><span>Select one or more ECG images, lab reports, or other medical files (PDF, JPG, JPEG, PNG).</span></div></div>
              {!!recordForm.attachments?.length && <div className="record-attached-file-list"><strong>Already attached reports</strong>{recordForm.attachments.map(file => <span key={file.id}>📄 {file.fileName}</span>)}</div>}

              <div className="form-field prescription-file-field"><label htmlFor="linkedPrescriptionFiles">💊 Add Prescription to This Record (optional)</label><div className="file-upload-box"><input id="linkedPrescriptionFiles" type="file" name="prescriptionFiles" accept="image/jpeg,image/png,application/pdf" multiple /><span>Attach prescription pictures or PDFs to this same health record.</span></div></div>
              {!!recordForm.prescriptionAttachments?.length && <div className="record-attached-file-list"><strong>Prescriptions already attached</strong>{recordForm.prescriptionAttachments.map(file => <span key={file.id}>💊 {file.fileName}</span>)}</div>}

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setRecordModal(false)}>Cancel</button>
                <button type="submit" className="primary-modal-btn">{editingRecord ? "Update Health Record" : "Save Health Record"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {prescriptionModal && <div className="modal-overlay show-modal" onMouseDown={event => { if (event.target === event.currentTarget) setPrescriptionModal(false); }}><div className="record-modal prescription-quick-modal"><button className="modal-close" type="button" onClick={() => setPrescriptionModal(false)}>×</button><div className="modal-heading"><div className="modal-medical-icon">💊</div><div><h2>Add Prescription</h2><p>Upload a prescription paper image for your prescriptions page.</p></div></div><div className="form-field prescription-file-field"><label htmlFor="prescriptionPaperFile">Upload Prescription Picture</label><div className="file-upload-box"><input id="prescriptionPaperFile" type="file" accept="image/jpeg,image/png" onChange={event => savePrescriptionPaper(event.target.files?.[0])} /><span>Choose a JPG or PNG picture. It saves automatically after selection.</span></div><p className="prescription-upload-status" role="status" aria-live="polite">{prescriptionMessage}</p></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setPrescriptionModal(false)}>Close</button></div></div></div>}
      {viewingFile && <FilePreviewModal file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}

function emptyRecord() {
  return { category: "", reportName: "", reportDate: "", problemStatement: "", fileData: "", fileName: "", fileType: "", attachments: [], prescriptionAttachments: [] };
}

function getRecordAttachments(record) {
  const attachments = Array.isArray(record?.attachments) ? record.attachments : [];
  const hasReport = attachments.some(item => item.kind !== "prescription");
  const legacyReport = record?.fileData && !hasReport
    ? [{ id: `legacy-${record.id}`, kind: "report", fileData: record.fileData, fileName: record.fileName || "Medical report", fileType: record.fileType || "" }]
    : [];
  return [...attachments, ...legacyReport];
}

function NavButton({ icon, label, id, active, onClick }) {
  return <button className={"sidebar-item " + (active === id ? "active" : "")} onClick={() => onClick(id)}><span>{icon}</span><span>{label}</span></button>;
}

function Stat({ title, value, icon }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div></div>;
}

function PageHeading({ label, title, subtitle, action }) {
  return <div className="page-heading"><span className="section-label">{label}</span><h1>{title}</h1><p>{subtitle}</p>{action}</div>;
}

function FilePreviewModal({ file, onClose }) {
  const [pdfUrl, setPdfUrl] = useState("");
  const isImage = String(file.fileType || file.fileData).startsWith("image/") || String(file.fileData).startsWith("data:image/");
  const isPdf = file.fileType === "application/pdf" || String(file.fileData).startsWith("data:application/pdf");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    if (isPdf) {
      fetch(file.fileData)
        .then(response => response.blob())
        .then(blob => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPdfUrl(objectUrl);
        })
        .catch(() => setPdfUrl(""));
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.fileData, isPdf]);

  return <div className="file-viewer-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="file-viewer-dialog" role="dialog" aria-modal="true" aria-label={`Preview ${file.fileName || "medical file"}`}>
      <header className="file-viewer-header"><div><strong>{file.fileName || "Medical file"}</strong><span>Health record attachment</span></div><div className="file-viewer-actions"><a href={file.fileData} download={file.fileName || "medical-file"}>Download</a><button type="button" onClick={onClose} aria-label="Close preview">×</button></div></header>
      <div className="file-viewer-content">
        {isImage ? <img src={file.fileData} alt={file.fileName || "Medical report"} /> : isPdf ? (pdfUrl ? <iframe title={file.fileName || "PDF report"} src={pdfUrl} /> : <p>Loading report preview…</p>) : <p>This file type cannot be previewed here. Use Download to open it.</p>}
      </div>
    </section>
  </div>;
}

function RecordList({ records, onView, onEdit, onDelete }) {
  return <div className="record-grid">{records.length ? records.map(record => <RecordCard key={record.id} record={record} onView={onView} onEdit={onEdit} onDelete={onDelete} />) : <p>No records available.</p>}</div>;
}

function RecordCard({ record, onView, onEdit, onDelete }) {
  const attachments = getRecordAttachments(record).filter(file => file.kind !== "prescription");
  return <article className="record-card"><h3>{record.reportName}</h3><p>Category: {record.category}</p><p>Date: {record.reportDate}</p><p>Findings: {record.problemStatement}</p><div className="record-card-attachments"><strong>Reports &amp; Lab Files ({attachments.length})</strong>{attachments.length ? attachments.map(file => <button type="button" key={file.id} onClick={() => onView(file.fileData, file.fileName, file.fileType)}>📄 {file.fileName || "Open file"}</button>) : <span>No report files</span>}</div><div className="record-actions"><button onClick={() => onEdit(record)}>Edit</button><button className="delete-record" onClick={() => onDelete(record.id)}>Delete</button></div></article>;
}

function ProfileInput({ label, name, type = "text", defaultValue = "" }) {
  return <div className="profile-edit-field"><label>{label}</label><input name={name} type={type} defaultValue={defaultValue || ""} /></div>;
}

function EyeIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="m3 3 18 18" />}
    </svg>
  );
}

function Login({ role, setRole, onSubmit, onSignup, onDoctorLogin, message }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-page">
      <Hero />
      <section className="login-section"><div className="login-card">
        <div className="login-header"><h2>Welcome Back</h2><p>Login to access your health records</p></div>
        <div className="role-section"><label>I am a</label><div className="role-buttons">
          <button type="button" className={"role-btn " + (role === "user" ? "active" : "")} onClick={() => setRole("user")}><span className="role-icon">👤</span>User</button>
          <button type="button" className={"role-btn " + (role === "admin" ? "active" : "")} onClick={() => setRole("admin")}><span className="role-icon">🛡️</span>Admin</button>
        </div></div>
        <form onSubmit={onSubmit}>
          <div className="input-group"><label>Email / Phone Number</label><div className="input-wrapper"><span className="input-icon">✉</span><input name="identifier" required placeholder="Enter your email or phone number" /></div></div>
          <div className="input-group"><label>Password</label><div className="input-wrapper"><span className="input-icon">🔒</span><input name="password" type={showPassword ? "text" : "password"} required placeholder="Enter your password" /><button type="button" className="password-visibility-btn" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><EyeIcon visible={showPassword} /></button></div></div>
          <div className="login-options"><label className="remember"><input type="checkbox" /> Remember me</label><span className="forgot-password">Forgot password?</span></div>
          <button className="login-btn">Login <span>→</span></button>
        </form>
        <p className="form-message">{message}</p>
        {role === "user" ? <>
          <div className="or-divider"><span></span><p>OR</p><span></span></div>
          <div className="signup-link"><span>Don't have an account?</span><button type="button" onClick={onSignup}>Create Patient Account</button></div>
          <div className="doctor-login-link"><span>Are you a healthcare provider?</span><button type="button" onClick={onDoctorLogin}>Doctor Login</button></div>
        </> : <div className="provider-note">Admin is pre-set for this demo. Login: admin@hrs.com / admin123</div>}
        <div className="privacy-note"><span>🔒</span><span>Your health information stays in this browser for this project demo.</span></div>
      </div></section>
    </div>
  );
}

function DoctorLogin({ onSubmit, onSignup, onBack, message }) {
  const [showPassword, setShowPassword] = useState(false);
  return <div className="login-page">
    <Hero />
    <section className="login-section"><div className="login-card doctor-login-card">
      <div className="login-header"><span className="section-label">HEALTHCARE PORTAL</span><h2>Doctor Login</h2><p>Sign in with your doctor ID to access patient records.</p></div>
      <form onSubmit={onSubmit}>
        <div className="input-group"><label>Doctor ID or Email</label><div className="input-wrapper"><span className="input-icon">🩺</span><input name="identifier" required placeholder="Enter full Doctor ID or signup email" autoComplete="username" /></div></div>
        <div className="input-group"><label>Password</label><div className="input-wrapper"><span className="input-icon">🔒</span><input name="password" type={showPassword ? "text" : "password"} required placeholder="Enter your password" autoComplete="current-password" /><button type="button" className="password-visibility-btn" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}><EyeIcon visible={showPassword} /></button></div></div>
        <button className="login-btn">Doctor Login <span>→</span></button>
      </form>
      <p className="form-message">{message}</p>
      <div className="provider-note">Demo doctor: DOC-001 &nbsp;·&nbsp; Password: doctor123</div>
      <div className="privacy-note"><span>🔒</span><span>Demo access works with patient accounts saved in this browser.</span></div>
      <div className="doctor-login-link"><span>New doctor?</span><button type="button" onClick={onSignup}>Create Doctor Account</button></div>
      <div className="signup-link doctor-back-link"><button type="button" onClick={onBack}>← Back to Patient Login</button></div>
    </div></section>
  </div>;
}

function DoctorSignup({ onSubmit, onLogin, message }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  return <div className="signup-page"><div className="signup-wrapper">
    <section className="signup-brand-section"><div className="signup-brand"><div className="signup-logo">♥</div><div><h1>Health Record <span>System</span></h1><p>YOUR HEALTH &nbsp; OUR PRIORITY</p></div></div><div className="signup-intro"><h2>Doctor<br />Registration</h2><p>Request a verified Doctor Portal account to review patient records after they grant access.</p><div className="doctor-signup-note">🛡️ &nbsp; Admin approval is required before the account can sign in.</div></div></section>
    <section className="signup-form-area"><div className="signup-card"><div className="signup-card-header"><span className="signup-small-label">HEALTHCARE PROVIDER</span><h2>Create Doctor Account</h2><p>Submit your professional details for approval.</p></div>
      <form onSubmit={onSubmit}>
        <div className="signup-field"><label>Full Name</label><div className="signup-input-wrapper"><span>👩‍⚕️</span><input name="name" required placeholder="Example: Dr. Ayesha Khan" /></div></div>
        <div className="signup-row"><div className="signup-field"><label>Specialization</label><div className="signup-input-wrapper"><span>🩺</span><input name="specialty" required placeholder="Example: Cardiologist" /></div></div><div className="signup-field"><label>Clinic / Hospital</label><div className="signup-input-wrapper"><span>🏥</span><input name="clinic" required placeholder="Clinic or hospital" /></div></div></div>
        <div className="signup-field"><label>Medical Registration / License ID</label><div className="signup-input-wrapper"><span>🪪</span><input name="licenseId" required placeholder="Enter registration ID" /></div></div>
        <div className="signup-field"><label>Email Address</label><div className="signup-input-wrapper"><span>✉</span><input name="email" type="email" required placeholder="Enter your email" /></div></div>
        <div className="signup-field"><label>Set Password</label><div className="signup-input-wrapper"><span>🔒</span><input name="password" type={showPassword ? "text" : "password"} required minLength="4" placeholder="Create your password" /><button type="button" className="password-visibility-btn" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}><EyeIcon visible={showPassword} /></button></div></div>
        <div className="signup-field"><label>Confirm Password</label><div className="signup-input-wrapper"><span>🔐</span><input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} required placeholder="Re-enter your password" /><button type="button" className="password-visibility-btn" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} onClick={() => setShowConfirmPassword(value => !value)}><EyeIcon visible={showConfirmPassword} /></button></div></div>
        <button className="create-account-btn">Submit for Approval <span>→</span></button>
      </form>
      <p className="form-message">{message}</p><div className="signup-login-link">Already registered? <button type="button" onClick={onLogin}>Doctor Login</button></div><div className="signup-privacy">🛡️ <span>Your Doctor ID is shown after submission. Admin approval is needed to activate it.</span></div>
    </div></section>
  </div></div>;
}

function Signup({ onSubmit, onLogin, message }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="signup-page"><div className="signup-wrapper">
      <section className="signup-brand-section"><div className="signup-brand"><div className="signup-logo">♥</div><div><h1>Health Record <span>System</span></h1><p>YOUR HEALTH &nbsp; OUR PRIORITY</p></div></div><div className="signup-intro"><h2>Your Health Journey,<br />All in One Place</h2><p>Create your personal health profile and keep your medical history, reports and health information organized in one place.</p></div><div className="signup-benefits"><div className="signup-benefit"><div className="benefit-icon">📄</div><div><strong>Medical Records</strong><span>Keep your health history organized</span></div></div><div className="signup-benefit"><div className="benefit-icon">📊</div><div><strong>Health Insights</strong><span>Track your medical information</span></div></div><div className="signup-benefit"><div className="benefit-icon">🔒</div><div><strong>Private & Organized</strong><span>Your information stays organized</span></div></div><div className="signup-benefit"><div className="benefit-icon">👨‍⚕️</div><div><strong>Better Care</strong><span>Connect with your healthcare provider</span></div></div></div><div className="signup-bottom-text">A healthier tomorrow<br />starts with your records today ♥</div></section>
      <section className="signup-form-area"><div className="signup-card"><div className="signup-card-header"><span className="signup-small-label">GET STARTED</span><h2>Create Account</h2><p>Enter your details to create your personal health profile.</p></div>
        <form onSubmit={onSubmit}>
          <div className="signup-field"><label>Full Name</label><div className="signup-input-wrapper"><span>👤</span><input name="name" required placeholder="Enter your full name" /></div></div>
          <div className="signup-row"><div className="signup-field"><label>Date of Birth</label><div className="signup-input-wrapper"><span>📅</span><input name="dob" type="date" required /></div></div><div className="signup-field"><label>Gender</label><select name="gender" required className="gender-select-box"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div></div>
          <div className="signup-field"><label>Phone Number or Email Address</label><div className="signup-input-wrapper"><span>📱</span><input name="contact" required placeholder="Enter phone number or email address" /></div><small className="signup-help">Use your phone number or email address to log in.</small></div>
          <div className="signup-field"><label>Set Password</label><div className="signup-input-wrapper"><span>🔒</span><input name="password" type={showPassword ? "text" : "password"} required minLength="4" placeholder="Create your password" /><button type="button" className="password-visibility-btn" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><EyeIcon visible={showPassword} /></button></div></div>
          <div className="signup-field"><label>Confirm Password</label><div className="signup-input-wrapper"><span>🔐</span><input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} required placeholder="Re-enter your password" /><button type="button" className="password-visibility-btn" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} title={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword(value => !value)}><EyeIcon visible={showConfirmPassword} /></button></div></div>
          <button className="create-account-btn">Create Account <span>→</span></button>
        </form>
        <p className="form-message">{message}</p><div className="signup-login-link">Already have an account? <button onClick={onLogin}>Login</button></div><div className="signup-privacy">🔒 <span>Your health information stays in this browser for this project demo.</span></div>
      </div></section>
    </div></div>
  );
}

function Hero() {
  return <section className="hero-section">
    <div className="hero-circle circle-one"></div><div className="hero-circle circle-two"></div><div className="hero-circle circle-three"></div>
    <div className="brand"><div className="brand-logo"><div className="heart-shape">♥</div><div className="heartbeat">─╱╲─╱╲─</div></div><div className="brand-text"><h1><span>Health</span> Record</h1><h1>System</h1><p>YOUR HEALTH&nbsp;&nbsp; OUR PRIORITY</p></div></div>
    <div className="hero-content"><h2>Your Health Journey,<br />All in One Place</h2><p className="hero-description">Store, manage and access your medical history, reports and health information — securely and conveniently.</p><div className="feature-list">{[["📄","Medical Records","Keep all your reports organized"],["📊","Health Insights","Track your health progress"],["🛡️","Private & Secure","Your data stays with you"],["👥","Better Care","Share with your healthcare provider"]].map(item => <div className="feature-item" key={item[1]}><div className="feature-icon">{item[0]}</div><div><h3>{item[1]}</h3><p>{item[2]}</p></div></div>)}</div></div>
    <div className="doctor-area"><div className="doctor-glow"></div><div className="doctor"><div className="doctor-hair"></div><div className="doctor-head"><div className="eye eye-left"></div><div className="eye eye-right"></div><div className="doctor-smile"></div></div><div className="doctor-neck"></div><div className="doctor-body"><div className="coat-left"></div><div className="coat-right"></div><div className="stethoscope"><span></span></div><div className="shirt"></div></div><div className="tablet"><div className="tablet-screen"><div></div><div></div><div></div></div></div><div className="plant"><div className="leaf leaf-one"></div><div className="leaf leaf-two"></div><div className="leaf leaf-three"></div><div className="plant-stem"></div></div></div><div className="care-message">CARE<br /><span>RECORD</span><br />PROGRESS<br />TOGETHER</div></div>
    <div className="tomorrow-message">A Healthier Tomorrow<br />Starts Today ♡</div>
  </section>;
}

function AdminPage({ user, users, setUsers, onLogout, onViewFile, viewingFile, onCloseFile }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const patients = users.filter(item => item.role === "user" || item.role === "patient");
  const filtered = patients.filter(item => (item.name || "").toLowerCase().includes(search.toLowerCase()) || String(item.email || item.phone || item.emailOrPhone || "").toLowerCase().includes(search.toLowerCase()));
  const selected = patients.find(item => String(item.id) === String(selectedId));
  const totalRecords = patients.reduce((sum, item) => sum + (item.healthRecords || []).length, 0);
  const totalPrescriptions = patients.reduce((sum, item) => sum + (item.prescriptions || []).length, 0);
  const doctorAccounts = users.filter(item => item.role === "doctor" && item.id !== "DOC-001");
  const pendingDoctors = users.filter(item => item.role === "doctor" && item.status === "pending");
  function updateDoctorStatus(id, status) {
    const next = users.map(item => String(item.id) === String(id) ? { ...item, status } : item);
    saveUsers(next);
    setUsers(next);
  }
  function removeUser(id) {
    if (!confirm("Remove this user and their saved records from this browser?")) return;
    const next = users.filter(item => String(item.id) !== String(id));
    setUsers(next); saveUsers(next);
    if (String(selectedId) === String(id)) setSelectedId("");
  }
  return <div className="dashboard-body">
    <header className="dashboard-header"><div className="dashboard-brand"><div className="dashboard-brand-icon">♥</div><div><h2>Health Record System</h2><p>Admin Module</p></div></div><div className="dashboard-user"><div className="user-avatar">🛡️</div><div className="user-info"><strong>{user.name || "Admin"}</strong><span>Admin</span></div><button className="dashboard-logout" onClick={onLogout}>Logout</button></div></header>
    <main className="dashboard-content">
      <div className="page-heading"><span className="section-label">ADMIN MODULE</span><h1>Admin Dashboard</h1><p>Manage user accounts and review records saved in this browser.</p></div>
      <div className="stats-grid"><Stat title="User Accounts" value={patients.length} icon="👥" /><Stat title="Doctor Accounts" value={doctorAccounts.length} icon="🩺" /><Stat title="Health Records" value={totalRecords} icon="📄" /><Stat title="Prescription Papers" value={totalPrescriptions} icon="💊" /></div>
      <div className="admin-panel-grid">
        <section className="record-card"><h2>User Management</h2><p>Search accounts and select a user to view saved records.</p><input className="admin-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, email or phone" /><div className="admin-user-list">{filtered.length ? filtered.map(item => <div className="admin-user-row" key={item.id}><button className="admin-user-select" onClick={() => setSelectedId(String(item.id))}><strong>{item.name || "User"}</strong><span>{item.email || item.phone || item.emailOrPhone}</span></button><button className="admin-delete-button" onClick={() => removeUser(item.id)}>Remove</button></div>) : <p>No users found.</p>}</div></section>
        <section className="record-card"><h2>{selected ? selected.name || "User Details" : "User Details"}</h2>{selected ? <><p><strong>Account ID:</strong> {selected.id}</p><p><strong>Contact:</strong> {selected.email || selected.phone || selected.emailOrPhone}</p><h3>Health Records</h3>{(selected.healthRecords || []).length ? selected.healthRecords.map(record => <div className="admin-record-row" key={record.id}><strong>{record.reportName}</strong><span>{record.category} · {record.reportDate}</span>{getRecordAttachments(record).filter(file => file.kind !== "prescription").map(file => <button key={file.id} onClick={() => onViewFile(file.fileData, file.fileName, file.fileType)}>Open {file.fileName || "Report"}</button>)}</div>) : <p>No health records saved.</p>}<h3>Prescription Papers</h3>{(selected.prescriptions || []).length ? selected.prescriptions.map(item => <div className="admin-record-row" key={item.id}><span>{item.fileName || "Prescription paper"}</span><button onClick={() => onViewFile(item.fileData, item.fileName, item.fileType)}>View Image</button></div>) : <p>No prescription papers saved.</p>}</> : <p>Select a user from the list to view their profile and records.</p>}</section>
      </div>
      <section className="doctor-approvals-card">
        <div className="doctor-approvals-heading"><div><span className="section-label">PROVIDER ACCESS</span><h2>Doctor Account Requests</h2><p>Review registration details before enabling Doctor Portal access.</p></div><span>🩺</span></div>
        <div className="doctor-approval-list">{pendingDoctors.length ? pendingDoctors.map(doctor => <article className="doctor-approval-row" key={doctor.id}><div><h3>{doctor.name}</h3><p>{doctor.specialty} · {doctor.clinic}</p><small>Doctor ID: {doctor.id} &nbsp;·&nbsp; License: {doctor.licenseId}</small><small>{doctor.email}</small></div><div className="doctor-approval-actions"><button className="doctor-reject-btn" onClick={() => updateDoctorStatus(doctor.id, "rejected")}>Reject</button><button className="primary-modal-btn" onClick={() => updateDoctorStatus(doctor.id, "approved")}>Approve Doctor</button></div></article>) : <p className="doctor-no-requests">No doctor requests waiting for approval.</p>}</div>
      </section>
      <p className="admin-storage-note">Local Storage keeps this project data in each browser. Admin sees accounts created in this same browser.</p>
    </main>
    {viewingFile && <FilePreviewModal file={viewingFile} onClose={onCloseFile} />}
  </div>;
}

function DoctorPage({ user, users, setUsers, onLogout, onViewFile, viewingFile, onCloseFile }) {
  const [patientId, setPatientId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [authorizedId, setAuthorizedId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState("");
  const patients = users.filter(item => item.role === "user" || item.role === "patient");
  const selected = patients.find(item => String(item.id) === String(authorizedId));
  const editingRecord = selected?.healthRecords?.find(item => String(item.id) === String(editingId));
  const doctorReports = selected ? (selected.healthRecords || []).flatMap(record => getRecordAttachments(record)
    .filter(file => file.kind !== "prescription")
    .map(file => ({ ...file, reportName: record.reportName, reportDate: record.reportDate, category: record.category }))) : [];
  const linkedPrescriptions = selected ? (selected.healthRecords || []).flatMap(record => getRecordAttachments(record)
    .filter(file => file.kind === "prescription")
    .map(file => ({ ...file, recordId: record.id, date: file.date || record.reportDate }))) : [];
  const doctorPrescriptions = Array.from(new Map([...(selected?.prescriptions || []), ...linkedPrescriptions]
    .map(file => [String(file.id || `${file.fileName}-${file.date}`), file])).values());

  function grantPatientAccess(event) {
    event.preventDefault();
    const targetId = patientId.trim().toLowerCase();
    const patient = patients.find(item => String(item.id).toLowerCase() === targetId);
    const grant = patient?.doctorAccess;
    if (!patient || !grant || grant.code !== accessCode.trim() || grant.expiresAt <= Date.now() || (grant.doctorId && String(grant.doctorId) !== String(user.id))) {
      setNotice("Patient ID or access code is incorrect, expired, or already linked to another doctor.");
      setAuthorizedId("");
      return;
    }
    if (!grant.doctorId) {
      const nextUsers = users.map(item => String(item.id) === String(patient.id)
        ? { ...item, doctorAccess: { ...grant, doctorId: user.id } }
        : item);
      saveUsers(nextUsers);
      setUsers(nextUsers);
    }
    setAuthorizedId(String(patient.id));
    setNotice("");
    setFormOpen(false);
  }

  function openRecordForm(record = null) {
    setEditingId(record ? String(record.id) : "");
    setFormOpen(true);
    setNotice("");
  }

  async function savePatientRecord(event) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = Array.from(form.elements.reportFiles.files || []);
    if (files.some(file => !["application/pdf", "image/jpeg", "image/png"].includes(file.type))) {
      setNotice("Attachments must be PDF, JPG or PNG files.");
      return;
    }
    const old = editingRecord;
    const addedAttachments = await Promise.all(files.map(async (file, index) => ({
      id: `FILE-${Date.now()}-${index}`,
      kind: "report",
      fileData: await readFile(file),
      fileName: file.name,
      fileType: file.type
    })));
    const attachments = [...getRecordAttachments(old), ...addedAttachments];
    const firstReport = attachments.find(item => item.kind !== "prescription");
    const record = {
      ...(old || {}),
      id: old ? old.id : "REC-" + Date.now(),
      category: String(data.get("category") || "General Medicine"),
      reportName: String(data.get("reportName") || "").trim(),
      reportDate: String(data.get("reportDate") || ""),
      problemStatement: String(data.get("findings") || "").trim(),
      attachments,
      fileData: firstReport?.fileData || "",
      fileName: firstReport?.fileName || "",
      fileType: firstReport?.fileType || ""
    };
    const previousRecords = selected.healthRecords || [];
    const nextRecords = old
      ? previousRecords.map(item => String(item.id) === editingId ? record : item)
      : [record, ...previousRecords];
    const nextUsers = users.map(item => String(item.id) === String(selected.id) ? { ...item, healthRecords: nextRecords } : item);
    try {
      saveUsers(nextUsers);
      setUsers(nextUsers);
      setFormOpen(false);
      setEditingId("");
      setNotice(old ? "Patient record updated." : "Medical entry added to the patient record.");
    } catch {
      setNotice("Could not save this entry. Try a smaller attachment.");
    }
  }

  return <div className="dashboard-body">
    <header className="dashboard-header"><div className="dashboard-brand"><div className="dashboard-brand-icon">♥</div><div><h2>Health Record System</h2><p>Doctor Portal</p></div></div><div className="dashboard-user"><div className="user-avatar">🩺</div><div className="user-info"><strong>{user.name || "Doctor"}</strong><span>Doctor</span></div><button className="dashboard-logout" onClick={onLogout}>Logout</button></div></header>
    <main className="dashboard-content doctor-portal-content">
      <PageHeading label="DOCTOR PORTAL" title="Patient Health Records" subtitle="Use your doctor account, then enter the patient's ID and temporary access code they shared with you." />
      {!selected ? <section className="doctor-access-panel">
        <div className="doctor-access-illustration">🔐</div><h2>Patient-approved access</h2><p>Ask the patient to open <strong>Share with Doctor</strong> in their account and generate a temporary code. Never ask them for their account password.</p>
        <form className="doctor-access-form" onSubmit={grantPatientAccess}>
          <label>Patient ID<input value={patientId} onChange={event => setPatientId(event.target.value)} required placeholder="Example: HRS-123456" autoComplete="off" /></label>
          <label>Temporary Access Code<input value={accessCode} onChange={event => setAccessCode(event.target.value)} required inputMode="numeric" maxLength="6" placeholder="6-digit code" autoComplete="off" /></label>
          {notice && <p className="doctor-notice" role="alert">{notice}</p>}
          <button className="primary-modal-btn">Open Patient Records</button>
        </form>
      </section> : <>
        <div className="doctor-authorized-bar"><span>🔓 Access approved by the patient and linked to your doctor account.</span><button type="button" onClick={() => { setAuthorizedId(""); setPatientId(""); setAccessCode(""); setFormOpen(false); setNotice(""); }}>Switch Patient</button></div>
        <section className="doctor-patient-details doctor-authorized-details">
            <div className="doctor-selected-header"><div><span className="section-label">PATIENT PROFILE</span><h2>{selected.name || "Patient"}</h2><p>{selected.id}</p></div><span className="doctor-selected-icon">🩺</span></div>
            <div className="doctor-demographics"><p><strong>Date of Birth</strong><span>{selected.dob || "Not provided"}</span></p><p><strong>Gender</strong><span>{selected.gender || "Not provided"}</span></p><p><strong>Contact</strong><span>{selected.email || selected.phone || selected.emailOrPhone || "Not provided"}</span></p></div>
            <div className="doctor-record-heading"><div><h3>Health History</h3><p>Consultation entries and medical notes</p></div><button className="primary-modal-btn" onClick={() => openRecordForm()}>+ Add Medical Entry</button></div>
            {notice && <p className="doctor-notice" role="status">{notice}</p>}
            {formOpen && <form className="doctor-record-form" onSubmit={savePatientRecord}>
              <h3>{editingId ? "Update Medical Entry" : "Add Medical Entry"}</h3>
              <label>Health Category<select name="category" defaultValue={editingRecord?.category || "General Medicine"}><option>General Medicine</option><option>Cardiovascular</option><option>Neurological</option><option>Respiratory</option><option>Musculoskeletal</option><option>Reproductive Health</option></select></label>
              <label>Record / Diagnosis Name<input name="reportName" required defaultValue={editingRecord?.reportName || ""} placeholder="Example: Consultation notes" /></label>
              <label>Date<input name="reportDate" type="date" required defaultValue={editingRecord?.reportDate || new Date().toISOString().slice(0,10)} /></label>
              <label>Findings / Notes<textarea name="findings" required defaultValue={editingRecord?.problemStatement || ""} placeholder="Add the medical notes for this entry" /></label>
              <label>Attach reports / lab results (optional)<input name="reportFiles" type="file" multiple accept="application/pdf,image/jpeg,image/png" /></label>
              {getRecordAttachments(editingRecord).length > 0 && <small>Existing attachments: {getRecordAttachments(editingRecord).map(file => file.fileName).join(", ")}</small>}
              <div className="doctor-record-form-actions"><button type="button" className="secondary-btn" onClick={() => { setFormOpen(false); setEditingId(""); }}>Cancel</button><button className="primary-modal-btn">{editingId ? "Save Update" : "Save Entry"}</button></div>
            </form>}
            <div className="doctor-history-list">
              {(selected.healthRecords || []).length ? [...selected.healthRecords].sort((a,b) => new Date(b.reportDate) - new Date(a.reportDate)).map(record => <article className="doctor-history-card" key={record.id}><div className="doctor-history-icon">📋</div><div className="doctor-history-body"><h4>{record.reportName || "Medical entry"}</h4><p>{record.category || "General Medicine"} <span>·</span> {record.reportDate || "Date not provided"}</p><p className="doctor-history-notes">{record.problemStatement || "No findings recorded."}</p></div><div className="doctor-history-actions"><button onClick={() => openRecordForm(record)}>Edit</button></div></article>) : <div className="doctor-empty-history"><span>🗂️</span><p>No health history recorded for this patient yet.</p></div>}
            </div>
            <section className="doctor-attachments-section"><div className="doctor-attachments-heading"><span>📄</span><div><h3>Reports &amp; Lab Files</h3><p>ECG images, laboratory results, and other uploaded reports.</p></div><strong>{doctorReports.length}</strong></div>{doctorReports.length ? <div className="doctor-file-list">{doctorReports.map(file => <article className="doctor-file-row" key={file.id}><span className="doctor-file-icon">📄</span><div className="doctor-file-details"><strong>{file.fileName || "Medical report"}</strong><span>{file.reportName || "Health record"} · {file.category || "General Medicine"} · {file.reportDate || "Date not provided"}</span></div><button type="button" onClick={() => onViewFile(file.fileData, file.fileName, file.fileType)}>Open report</button></article>)}</div> : <p className="doctor-attachments-empty">No reports or lab files attached.</p>}</section>
            <section className="doctor-prescriptions"><div className="doctor-attachments-heading"><span>💊</span><div><h3>Prescription Papers</h3><p>Uploaded prescription files for this patient.</p></div><strong>{doctorPrescriptions.length}</strong></div>{doctorPrescriptions.length ? <div className="doctor-file-list">{doctorPrescriptions.map(item => <article className="doctor-file-row prescription-row" key={item.id}><span className="doctor-file-icon">💊</span><div className="doctor-file-details"><strong>{item.fileName || "Prescription paper"}</strong><span>{item.recordId ? "Attached to a health record" : `Uploaded: ${item.date || "Date not provided"}`}</span></div><button type="button" onClick={() => onViewFile(item.fileData, item.fileName, item.fileType)}>Open prescription</button></article>)}</div> : <p className="doctor-attachments-empty">No prescription pictures uploaded.</p>}</section>
        </section>
      </>}
      <p className="doctor-storage-notice">Project demo: access codes and patient health files are saved in this browser only. To let real doctors and patients use different devices, this app needs a shared, secured database and server-side access checks.</p>
    </main>
    {viewingFile && <FilePreviewModal file={viewingFile} onClose={onCloseFile} />}
  </div>;
}

export default App;
