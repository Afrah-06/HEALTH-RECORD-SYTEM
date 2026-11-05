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
    if (!localStorage.getItem("currentUserId")) return "login";
    const savedRole = localStorage.getItem("currentUserRole");
    return savedRole === "admin" || savedRole === "provider" ? "admin" : "dashboard";
  });
  const [userId, setUserId] = useState(() => localStorage.getItem("currentUserId") || "");
  const [role, setRole] = useState("user");
  const [active, setActive] = useState("overview");
  const [message, setMessage] = useState("");
  const [recordModal, setRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState("");
  const [recordForm, setRecordForm] = useState(emptyRecord());
  const [prescriptionFile, setPrescriptionFile] = useState(null);
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
    if (JSON.stringify(next) !== JSON.stringify(users)) {
      setUsers(next);
      saveUsers(next);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("currentUserId", currentUser.id);
      localStorage.setItem("currentUserRole", currentUser.role);
      localStorage.setItem("isLoggedIn", "true");
    }
  }, [currentUser]);

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
    const password = String(data.get("password") || "");
    const found = users.find(item => {
      const accountIsAdmin = item.role === "admin" || item.role === "provider";
      const accountIsUser = item.role === "user" || item.role === "patient";
      if ((role === "admin" && !accountIsAdmin) || (role === "user" && !accountIsUser) || item.password !== password) return false;
      const entered = identifier.toLowerCase();
      return String(item.email || "").toLowerCase() === entered ||
        String(item.emailOrPhone || "").toLowerCase() === entered ||
        String(item.phone || "") === identifier;
    });
    if (!found) {
      setMessage("Invalid email/phone or password.");
      return;
    }
    setUserId(String(found.id));
    setPage(found.role === "provider" || found.role === "admin" ? "admin" : "dashboard");
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

  function logout() {
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("currentUserRole");
    localStorage.removeItem("isLoggedIn");
    setUserId("");
    setPage("login");
    setActive("overview");
  }

  function openNewRecord() {
    setEditingRecord("");
    setRecordForm(emptyRecord());
    setPrescriptionFile(null);
    setRecordModal(true);
  }

  function openPrescriptionUpload() {
    openNewRecord();
    window.setTimeout(() => {
      document.getElementById("prescriptionPaperFile")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 80);
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
      fileType: record.fileType || ""
    });
    setPrescriptionFile(null);
    setRecordModal(true);
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!currentUser) return;
    const file = event.currentTarget.reportFile.files[0];
    if (!editingRecord && !file) {
      alert("Please upload a medical report.");
      return;
    }
    if (file && !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      alert("Only PDF, JPG, JPEG and PNG files are allowed.");
      return;
    }
    const existing = currentUser.healthRecords || [];
    const old = existing.find(item => String(item.id) === editingRecord);
    const nextRecord = {
      ...(old || {}),
      id: old ? old.id : String(Date.now()),
      category: recordForm.category,
      reportName: recordForm.reportName.trim(),
      reportDate: recordForm.reportDate,
      problemStatement: recordForm.problemStatement.trim(),
      fileData: file ? await readFile(file) : recordForm.fileData,
      fileName: file ? file.name : recordForm.fileName,
      fileType: file ? file.type : recordForm.fileType
    };
    const nextRecords = old
      ? existing.map(item => String(item.id) === editingRecord ? nextRecord : item)
      : [nextRecord, ...existing];
    updateCurrentUser({ healthRecords: nextRecords });
    setRecordModal(false);
  }

  async function savePrescriptionPaper() {
    if (!currentUser) return;
    if (!prescriptionFile) {
      alert("Choose a picture of the prescription paper first.");
      return;
    }
    if (!["image/jpeg", "image/png"].includes(prescriptionFile.type)) {
      alert("Upload a JPG or PNG image of the prescription.");
      return;
    }
    const item = {
      id: "RX-" + Date.now(),
      fileName: prescriptionFile.name,
      fileType: prescriptionFile.type,
      fileData: await readFile(prescriptionFile),
      date: new Date().toLocaleDateString()
    };
    updateCurrentUser({ prescriptions: [item, ...(currentUser.prescriptions || [])] });
    setPrescriptionFile(null);
    const input = document.getElementById("prescriptionPaperFile");
    if (input) input.value = "";
    alert("Prescription picture saved.");
  }

  function deleteRecord(id) {
    if (!confirm("Delete this health record?")) return;
    updateCurrentUser({
      healthRecords: (currentUser.healthRecords || []).filter(item => String(item.id) !== String(id))
    });
  }

  function deletePrescription(id) {
    if (!confirm("Delete this prescription picture?")) return;
    updateCurrentUser({
      prescriptions: (currentUser.prescriptions || []).filter(item => String(item.id) !== String(id))
    });
  }

  function viewFile(fileData) {
    if (!fileData) return;
    const opened = window.open(fileData, "_blank");
    if (!opened) alert("Allow pop-ups to view this file.");
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

  if (page === "signup") {
    return <Signup onSubmit={signup} onLogin={() => { setMessage(""); setPage("login"); }} message={message} />;
  }
  if (page === "login") {
    return <Login role={role} setRole={setRole} onSubmit={login} onSignup={() => { setMessage(""); setPage("signup"); }} message={message} />;
  }
  if (!currentUser) {
    setPage("login");
    return null;
  }
  if (page === "admin") {
    return <AdminPage user={currentUser} users={users} setUsers={setUsers} onLogout={logout} />;
  }

  const records = currentUser.healthRecords || [];
  const reports = records.filter(item => item.fileData);
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
          </nav>
          <div className="sidebar-bottom">
            <NavButton icon="👨‍⚕️" label="Doctors" id="doctors" active={active} onClick={setActive} />
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
              <PageHeading label="UPLOADED FILES" title="Reports" subtitle="View your uploaded medical reports." />
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
                    <img src={item.fileData} alt="Prescription paper" className="prescription-preview" />
                    <div className="record-actions">
                      <button onClick={() => viewFile(item.fileData)}>View Image</button>
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

          {active === "doctors" && (
            <section className="dashboard-section">
              <PageHeading label="CARE TEAM" title="My Doctors" subtitle="Your healthcare contacts." />
              <div className="doctor-card"><div className="doctor-avatar">👨‍⚕️</div><div className="doctor-details"><h3>Healthcare Provider</h3><p>Your healthcare provider information will appear here.</p></div></div>
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
              <div className="form-field"><label>Health Category</label><select required value={recordForm.category} onChange={event => setRecordForm({ ...recordForm, category: event.target.value })}><option value="">Select health category</option>{["Cardiovascular", "Neurological", "Respiratory", "Musculoskeletal", "Reproductive Health", "General Medicine"].map(option => <option key={option}>{option}</option>)}</select></div>
              <div className="form-field"><label>Report Name</label><input required value={recordForm.reportName} onChange={event => setRecordForm({ ...recordForm, reportName: event.target.value })} placeholder="Example: ECG Report" /></div>
              <div className="form-field"><label>Report Date</label><input type="date" required value={recordForm.reportDate} onChange={event => setRecordForm({ ...recordForm, reportDate: event.target.value })} /></div>
              <div className="form-field"><label>Report Findings / Impression</label><textarea required value={recordForm.problemStatement} onChange={event => setRecordForm({ ...recordForm, problemStatement: event.target.value })} placeholder="Enter the findings or impression written in the medical report..." /></div>
              <div className="form-field"><label>Upload Report</label><div className="file-upload-box"><input type="file" name="reportFile" accept="application/pdf,image/jpeg,image/png" required={!editingRecord} /><span>PDF, JPG, JPEG or PNG</span></div></div>

              <div className="prescription-upload-block">
                <div className="form-field"><label htmlFor="prescriptionPaperFile">Upload Prescription</label><div className="file-upload-box"><input id="prescriptionPaperFile" type="file" accept="image/jpeg,image/png" onChange={event => setPrescriptionFile(event.target.files[0] || null)} /><span>Choose a picture of your prescription paper (JPG or PNG)</span></div></div>
                <button type="button" className="secondary-btn" onClick={savePrescriptionPaper}>Save Prescription Picture</button>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setRecordModal(false)}>Cancel</button>
                <button type="submit" className="primary-modal-btn">{editingRecord ? "Update Health Record" : "Save Health Record"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyRecord() {
  return { category: "", reportName: "", reportDate: "", problemStatement: "", fileData: "", fileName: "", fileType: "" };
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

function RecordList({ records, onView, onEdit, onDelete }) {
  return <div className="record-grid">{records.length ? records.map(record => <RecordCard key={record.id} record={record} onView={onView} onEdit={onEdit} onDelete={onDelete} />) : <p>No records available.</p>}</div>;
}

function RecordCard({ record, onView, onEdit, onDelete }) {
  return <article className="record-card"><h3>{record.reportName}</h3><p>Category: {record.category}</p><p>Date: {record.reportDate}</p><p>Findings: {record.problemStatement}</p><p>File: {record.fileName || "No file"}</p><div className="record-actions"><button disabled={!record.fileData} onClick={() => onView(record.fileData)}>View Report</button><button onClick={() => onEdit(record)}>Edit</button><button className="delete-record" onClick={() => onDelete(record.id)}>Delete</button></div></article>;
}

function ProfileInput({ label, name, type = "text", defaultValue = "" }) {
  return <div className="profile-edit-field"><label>{label}</label><input name={name} type={type} defaultValue={defaultValue || ""} /></div>;
}

function Login({ role, setRole, onSubmit, onSignup, message }) {
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
          <div className="input-group"><label>Password</label><div className="input-wrapper"><span className="input-icon">🔒</span><input name="password" type="password" required placeholder="Enter your password" /></div></div>
          <div className="login-options"><label className="remember"><input type="checkbox" /> Remember me</label><span className="forgot-password">Forgot password?</span></div>
          <button className="login-btn">Login <span>→</span></button>
        </form>
        <p className="form-message">{message}</p>
        <div className="or-divider"><span></span><p>OR</p><span></span></div>
        <div className="signup-link"><span>Don't have an account?</span><button onClick={onSignup}>Create Account</button></div>
        {role === "admin" && <div className="provider-note">Admin demo login: admin@hrs.com / admin123</div>}
        <div className="privacy-note"><span>🔒</span><span>Your health information stays in this browser for this project demo.</span></div>
      </div></section>
    </div>
  );
}

function Signup({ onSubmit, onLogin, message }) {
  return (
    <div className="signup-page"><div className="signup-wrapper">
      <section className="signup-brand-section"><div className="signup-brand"><div className="signup-logo">♥</div><div><h1>Health Record <span>System</span></h1><p>YOUR HEALTH &nbsp; OUR PRIORITY</p></div></div><div className="signup-intro"><h2>Your Health Journey,<br />All in One Place</h2><p>Create your personal health profile and keep your medical history, reports and health information organized in one place.</p></div><div className="signup-benefits"><div className="signup-benefit"><div className="benefit-icon">📄</div><div><strong>Medical Records</strong><span>Keep your health history organized</span></div></div><div className="signup-benefit"><div className="benefit-icon">📊</div><div><strong>Health Insights</strong><span>Track your medical information</span></div></div><div className="signup-benefit"><div className="benefit-icon">🔒</div><div><strong>Private & Organized</strong><span>Your information stays organized</span></div></div><div className="signup-benefit"><div className="benefit-icon">👨‍⚕️</div><div><strong>Better Care</strong><span>Connect with your healthcare provider</span></div></div></div><div className="signup-bottom-text">A healthier tomorrow<br />starts with your records today ♥</div></section>
      <section className="signup-form-area"><div className="signup-card"><div className="signup-card-header"><span className="signup-small-label">GET STARTED</span><h2>Create Account</h2><p>Enter your details to create your personal health profile.</p></div>
        <form onSubmit={onSubmit}>
          <div className="signup-field"><label>Full Name</label><div className="signup-input-wrapper"><span>👤</span><input name="name" required placeholder="Enter your full name" /></div></div>
          <div className="signup-row"><div className="signup-field"><label>Date of Birth</label><div className="signup-input-wrapper"><span>📅</span><input name="dob" type="date" required /></div></div><div className="signup-field"><label>Gender</label><select name="gender" required className="gender-select-box"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div></div>
          <div className="signup-field"><label>Phone Number or Email Address</label><div className="signup-input-wrapper"><span>📱</span><input name="contact" required placeholder="Enter phone number or email address" /></div><small className="signup-help">Use your phone number or email address to log in.</small></div>
          <div className="signup-field"><label>Set Password</label><div className="signup-input-wrapper"><span>🔒</span><input name="password" type="password" required minLength="4" placeholder="Create your password" /></div></div>
          <div className="signup-field"><label>Confirm Password</label><div className="signup-input-wrapper"><span>🔐</span><input name="confirmPassword" type="password" required placeholder="Re-enter your password" /></div></div>
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

function AdminPage({ user, users, setUsers, onLogout }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const patients = users.filter(item => item.role === "user" || item.role === "patient");
  const filtered = patients.filter(item => (item.name || "").toLowerCase().includes(search.toLowerCase()) || String(item.email || item.phone || item.emailOrPhone || "").toLowerCase().includes(search.toLowerCase()));
  const selected = patients.find(item => String(item.id) === String(selectedId));
  const totalRecords = patients.reduce((sum, item) => sum + (item.healthRecords || []).length, 0);
  const totalPrescriptions = patients.reduce((sum, item) => sum + (item.prescriptions || []).length, 0);
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
      <div className="stats-grid"><Stat title="User Accounts" value={patients.length} icon="👥" /><Stat title="Health Records" value={totalRecords} icon="📄" /><Stat title="Prescription Papers" value={totalPrescriptions} icon="💊" /></div>
      <div className="admin-panel-grid">
        <section className="record-card"><h2>User Management</h2><p>Search accounts and select a user to view saved records.</p><input className="admin-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, email or phone" /><div className="admin-user-list">{filtered.length ? filtered.map(item => <div className="admin-user-row" key={item.id}><button className="admin-user-select" onClick={() => setSelectedId(String(item.id))}><strong>{item.name || "User"}</strong><span>{item.email || item.phone || item.emailOrPhone}</span></button><button className="admin-delete-button" onClick={() => removeUser(item.id)}>Remove</button></div>) : <p>No users found.</p>}</div></section>
        <section className="record-card"><h2>{selected ? selected.name || "User Details" : "User Details"}</h2>{selected ? <><p><strong>Account ID:</strong> {selected.id}</p><p><strong>Contact:</strong> {selected.email || selected.phone || selected.emailOrPhone}</p><h3>Health Records</h3>{(selected.healthRecords || []).length ? selected.healthRecords.map(record => <div className="admin-record-row" key={record.id}><strong>{record.reportName}</strong><span>{record.category} · {record.reportDate}</span>{record.fileData && <button onClick={() => window.open(record.fileData, "_blank")}>View File</button>}</div>) : <p>No health records saved.</p>}<h3>Prescription Papers</h3>{(selected.prescriptions || []).length ? selected.prescriptions.map(item => <div className="admin-record-row" key={item.id}><span>{item.fileName || "Prescription paper"}</span><button onClick={() => window.open(item.fileData, "_blank")}>View Image</button></div>) : <p>No prescription papers saved.</p>}</> : <p>Select a user from the list to view their profile and records.</p>}</section>
      </div>
      <p className="admin-storage-note">Local Storage keeps this project data in each browser. Admin sees accounts created in this same browser.</p>
    </main>
  </div>;
}

export default App;
