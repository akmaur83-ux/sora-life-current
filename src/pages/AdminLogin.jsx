import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../lib/adminAuth.jsx";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { signIn, isAdmin, loading } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }

  if (isAdmin) {
    navigate("/admin");
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await signIn(email.trim(), password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message || "Unable to sign in.");
      return;
    }

    navigate("/admin");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f5f1e8",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 32,
          borderRadius: 20,
          background: "#fff",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 8 }}>SORA LIFE Admin</h1>

        <p style={{ marginTop: 0, marginBottom: 24, color: "#666" }}>
          Authorized access only.
        </p>

        <label htmlFor="admin-email" style={{ display: "block", marginBottom: 8 }}>
          Email
        </label>

        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 12,
            marginBottom: 16,
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        />

        <label htmlFor="admin-password" style={{ display: "block", marginBottom: 8 }}>
          Password
        </label>

        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 12,
            marginBottom: 16,
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        />

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              background: "#fff0f0",
              color: "#a11",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: 13,
            border: 0,
            borderRadius: 10,
            background: "#1e3a2f",
            color: "#fff",
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}