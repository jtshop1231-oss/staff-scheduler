'use client';

import React, { useState, useEffect } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFTS = ["Day", "Night"];

const ink = "#141B24";
const paper = "#0F1B28";
const card = "#FFFFFF";
const line = "#E1E6E4";
const pulse = "#0E8F82";
const skyBlue = "#0EA5E9";
const skyBlueDim = "#E0F2FE";
const gray = "#9CA3AF";
const muted = "#6B7580";

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
`;

const STAFF_LIST = ["Ana", "Ben", "Carla", "Dan", "Elena", "Franco", "Gabriel", "Hilda"];

// Default admin credentials
const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };

export default function StaffSchedulerApp() {
  const [user, setUser] = useState(null); // { role: "admin" | "staff", name: string }
  const [adminWeeks, setAdminWeeks] = useState(2);
  const [allRequests, setAllRequests] = useState([]);

  // ============ LOGIN SCREEN ============
  if (!user) {
    return (
      <LoginScreen
        onAdminLogin={(username, password) => {
          if (
            username === ADMIN_CREDENTIALS.username &&
            password === ADMIN_CREDENTIALS.password
          ) {
            setUser({ role: "admin", name: username });
          } else {
            alert("Invalid admin credentials");
          }
        }}
        onStaffLogin={(name) => {
          setUser({ role: "staff", name });
        }}
        staffList={STAFF_LIST}
      />
    );
  }

  // ============ ADMIN DASHBOARD ============
  if (user.role === "admin") {
    return (
      <AdminDashboard
        weeks={adminWeeks}
        onWeeksChange={setAdminWeeks}
        allRequests={allRequests}
        onLogout={() => setUser(null)}
      />
    );
  }

  // ============ STAFF CALENDAR ============
  if (user.role === "staff") {
    return (
      <StaffCalendar
        staffName={user.name}
        weeks={adminWeeks}
        allRequests={allRequests}
        onSubmitRequest={(newRequest) => {
          setAllRequests([...allRequests, newRequest]);
        }}
        onLogout={() => setUser(null)}
      />
    );
  }
}

// ============ LOGIN SCREEN ============
function LoginScreen({ onAdminLogin, onStaffLogin, staffList }) {
  const [tab, setTab] = useState("staff"); // "staff" or "admin"
  const [selectedStaff, setSelectedStaff] = useState(staffList[0] || "");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");

  return (
    <div
      style={{
        background: paper,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        color: "#FFFFFF",
        padding: 20,
      }}
    >
      <style>{fontImport}</style>
      <div
        style={{
          background: card,
          border: `1px solid ${line}`,
          borderRadius: 12,
          padding: 32,
          maxWidth: 380,
          width: "100%",
        }}
      >
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            margin: "0 0 24px",
            color: ink,
          }}
        >
          Shift Request Login
        </h1>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => setTab("staff")}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: tab === "staff" ? pulse : paper,
              color: tab === "staff" ? "#fff" : muted,
              cursor: "pointer",
            }}
          >
            Staff Login
          </button>
          <button
            onClick={() => setTab("admin")}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: tab === "admin" ? skyBlue : paper,
              color: tab === "admin" ? "#fff" : muted,
              cursor: "pointer",
            }}
          >
            Admin Login
          </button>
        </div>

        {/* Staff login */}
        {tab === "staff" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              Select your name
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                style={{
                  padding: "10px 12px",
                  border: `1px solid ${line}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "'Inter', sans-serif",
                  color: ink,
                }}
              >
                {STAFF_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => onStaffLogin(selectedStaff)}
              style={{
                padding: "12px 16px",
                background: pulse,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Login as Staff
            </button>
          </div>
        )}

        {/* Admin login */}
        {tab === "admin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              Username
              <input
                type="text"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                placeholder="Enter admin username"
                style={{
                  padding: "10px 12px",
                  border: `1px solid ${line}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </label>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              Password
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onAdminLogin(adminUser, adminPass);
                  }
                }}
                placeholder="Enter password"
                style={{
                  padding: "10px 12px",
                  border: `1px solid ${line}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </label>
            <button
              onClick={() => onAdminLogin(adminUser, adminPass)}
              style={{
                padding: "12px 16px",
                background: skyBlue,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Login as Admin
            </button>
            <div style={{ fontSize: 11, color: muted, marginTop: 8 }}>
              Demo: username <code style={{ background: "#f0f0f0", padding: "2px 4px" }}>admin</code>, password{" "}
              <code style={{ background: "#f0f0f0", padding: "2px 4px" }}>admin123</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ ADMIN DASHBOARD ============
function AdminDashboard({ weeks, onWeeksChange, allRequests, onLogout }) {
  const [newWeeks, setNewWeeks] = useState(weeks);

  // Count requests per staff
  const requestsByStaff = {};
  STAFF_LIST.forEach((s) => (requestsByStaff[s] = 0));
  allRequests.forEach((r) => {
    requestsByStaff[r.staff] = (requestsByStaff[r.staff] || 0) + 1;
  });

  return (
    <div
      style={{
        background: paper,
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        color: "#FFFFFF",
      }}
    >
      <style>{fontImport}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${line}`, background: card }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Admin Dashboard
            </div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 28,
                fontWeight: 700,
                margin: 0,
                color: ink,
              }}
            >
              Control Center
            </h1>
          </div>
          <button
            onClick={onLogout}
            style={{
              padding: "10px 16px",
              background: "none",
              border: `1px solid ${line}`,
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              color: muted,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 24,
        }}
      >
        {/* Settings panel */}
        <div
          style={{
            background: card,
            border: `1px solid ${line}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              margin: "0 0 20px",
              color: ink,
            }}
          >
            Schedule Settings
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: ink,
              }}
            >
              <span>How many weeks ahead for staff to request?</span>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newWeeks}
                  onChange={(e) => setNewWeeks(Math.max(1, Number(e.target.value)))}
                  style={{
                    padding: "10px 12px",
                    border: `1px solid ${line}`,
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "'Inter', sans-serif",
                    width: 80,
                  }}
                />
                <span style={{ fontSize: 13, color: muted }}>weeks</span>
              </div>
            </label>

            <button
              onClick={() => onWeeksChange(newWeeks)}
              disabled={newWeeks === weeks}
              style={{
                padding: "12px 16px",
                background: newWeeks === weeks ? gray : skyBlue,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: newWeeks === weeks ? "not-allowed" : "pointer",
                opacity: newWeeks === weeks ? 0.6 : 1,
              }}
            >
              Update weeks
            </button>

            <div
              style={{
                background: skyBlueDim,
                border: `1px solid ${skyBlue}`,
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: skyBlue,
              }}
            >
              ℹ️ Staff will see <strong>{newWeeks}</strong> weeks of shifts to request
            </div>
          </div>
        </div>

        {/* Live requests panel */}
        <div
          style={{
            background: card,
            border: `1px solid ${line}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              margin: "0 0 20px",
              color: ink,
            }}
          >
            Live Shift Requests
          </h2>

          {allRequests.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: muted,
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 8 }}>⏳ No requests yet</div>
              <div style={{ fontSize: 12 }}>
                Requests will appear here in real-time as staff submit
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {Object.entries(requestsByStaff).map(([staffName, count]) => (
                  <div
                    key={staffName}
                    style={{
                      background: count > 0 ? skyBlueDim : "#F3F4F6",
                      border: `1px solid ${count > 0 ? skyBlue : line}`,
                      borderRadius: 8,
                      padding: 12,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>
                      {staffName}
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: count > 0 ? skyBlue : muted,
                      }}
                    >
                      {count}
                    </div>
                    <div style={{ fontSize: 10, color: muted }}>request{count !== 1 ? "s" : ""}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: muted }}>
                All requests ({allRequests.length})
              </div>
              <div
                style={{
                  maxHeight: 400,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[...allRequests].reverse().map((req, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#F3F4F6",
                      border: `1px solid ${line}`,
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 12,
                      color: ink,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {req.staff} · {req.week} · {req.day} {req.shift}
                    </div>
                    <div style={{ color: muted, fontSize: 11 }}>
                      {req.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ STAFF CALENDAR ============
function StaffCalendar({ staffName, weeks, allRequests, onSubmitRequest, onLogout }) {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selections, setSelections] = useState({});
  const [savedSelections, setSavedSelections] = useState({});

  const hasChanges =
    JSON.stringify(selections) !== JSON.stringify(savedSelections);

  function toggleSelection(day, shift) {
    const key = `${currentWeek}-${day}-${shift}`;
    const current = selections[key] ?? null;
    let next = null;
    if (current === null) next = "on";
    else if (current === "on") next = "off";
    else next = null;
    setSelections({ ...selections, [key]: next });
  }

  function saveSelection() {
    if (!hasChanges) return;

    Object.entries(selections).forEach(([key, value]) => {
      const [week, day, shift] = key.split("-");
      if (value === "on" && !savedSelections[key]) {
        onSubmitRequest({
          staff: staffName,
          week: `Week ${week}`,
          day,
          shift,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }
    });

    setSavedSelections({ ...selections });
  }

  function cancelSelection() {
    setSelections({ ...savedSelections });
  }

  function boxColor(day, shift) {
    const key = `${currentWeek}-${day}-${shift}`;
    const val = selections[key] ?? savedSelections[key] ?? null;
    if (val === "on") return skyBlue;
    if (val === "off") return "#F3F4F6";
    return card;
  }

  function boxLabel(day, shift) {
    const key = `${currentWeek}-${day}-${shift}`;
    const val = selections[key] ?? savedSelections[key] ?? null;
    if (val === "on") return "My Request ON";
    if (val === "off") return "My Request OFF";
    return "Not set";
  }

  return (
    <div
      style={{
        background: paper,
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        color: "#FFFFFF",
      }}
    >
      <style>{fontImport}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${line}`, background: card }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Hello, {staffName}
            </div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 28,
                fontWeight: 700,
                margin: 0,
                color: ink,
              }}
            >
              Request your shifts
            </h1>
          </div>
          <button
            onClick={onLogout}
            style={{
              padding: "10px 16px",
              background: "none",
              border: `1px solid ${line}`,
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              color: muted,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 24px 64px",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 32,
        }}
      >
        {/* Week selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Select week:</span>
          <div style={{ display: "flex", gap: 8 }}>
            {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
              <button
                key={w}
                onClick={() => {
                  setCurrentWeek(w);
                  setSelections({});
                }}
                style={{
                  padding: "8px 14px",
                  border: `1px solid ${line}`,
                  borderRadius: 6,
                  background: currentWeek === w ? skyBlue : card,
                  color: currentWeek === w ? "#fff" : ink,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Week {w}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar grid */}
        <div
          style={{
            background: card,
            border: `1px solid ${line}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 16,
              fontWeight: 600,
              margin: "0 0 20px",
              color: ink,
            }}
          >
            Week {currentWeek} — Click ON or OFF
          </h2>

          {SHIFTS.map((shift) => (
            <div key={shift} style={{ marginBottom: 32 }}>
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  margin: "0 0 12px",
                  color: muted,
                }}
              >
                {shift} Shift
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                {DAYS.map((day) => {
                  const bgColor = boxColor(day, shift);
                  const label = boxLabel(day, shift);
                  const isOn =
                    (selections[`${currentWeek}-${day}-${shift}`] ??
                      savedSelections[`${currentWeek}-${day}-${shift}`] ??
                      null) === "on";

                  return (
                    <button
                      key={`${day}-${shift}`}
                      onClick={() => toggleSelection(day, shift)}
                      style={{
                        background: bgColor,
                        border: isOn ? `2px solid ${skyBlue}` : `1px solid ${line}`,
                        borderRadius: 10,
                        padding: 16,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: isOn ? skyBlue : muted,
                        }}
                      >
                        {day}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: isOn ? skyBlue : "#999",
                        }}
                      >
                        {label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Save/Cancel buttons */}
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button
              onClick={saveSelection}
              disabled={!hasChanges}
              style={{
                background: hasChanges ? skyBlue : gray,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: hasChanges ? "pointer" : "not-allowed",
                opacity: hasChanges ? 1 : 0.6,
              }}
            >
              Save
            </button>
            <button
              onClick={cancelSelection}
              disabled={!hasChanges}
              style={{
                background: "none",
                border: `1px solid ${line}`,
                color: muted,
                borderRadius: 8,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 500,
                cursor: hasChanges ? "pointer" : "not-allowed",
                opacity: hasChanges ? 1 : 0.5,
              }}
            >
              Cancel
            </button>
            {!hasChanges && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 13,
                  color: muted,
                  alignSelf: "center",
                }}
              >
                ✓ Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
