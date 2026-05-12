import { useState } from "react";
import { Alert, Button, Chip, Paper, TextField, Typography } from "@mui/material";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import { useAppData } from "../context/AppDataContext";

export default function LoginPage() {
  const { authLoading, session, signIn, signOut } = useAppData();
  const [credentials, setCredentials] = useState({
    email: "ops@choicemee.com",
    password: "ChoiceMee@123",
  });
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleChange = (key) => (event) => {
    setCredentials((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    try {
      await signIn(credentials);
      setStatus({ type: "success", message: "Signed in to the demo operations portal." });
    } catch (loginError) {
      setStatus({ type: "error", message: loginError.message });
    }
  };

  return (
    <div className="page-shell">
      <PageHero
        badge="Portal login"
        caption="JWT-ready auth flow"
        description="A premium login surface for the operations side of the platform, backed by the frontend session context and the Express auth scaffold."
        title="Access the ChoiceMee operations portal."
      />

      <section className="section-block section-block--stats pattern-marble">
        <div className="container-shell login-layout">
          <MotionFade>
            <Paper className="glass-panel login-panel login-panel--info" elevation={0}>
              <Chip label="Demo credentials loaded" />
              <Typography variant="h4">Built for role-based access and clean operations workflows.</Typography>
              <Typography className="login-panel__copy" variant="body2">
                The backend scaffold includes JWT authentication, user roles, shipment APIs, and
                transaction endpoints. This page uses the local mock path until the API base URL is connected.
              </Typography>
              <div className="login-panel__credential">
                <span>Email</span>
                <strong>ops@choicemee.com</strong>
              </div>
              <div className="login-panel__credential">
                <span>Password</span>
                <strong>ChoiceMee@123</strong>
              </div>
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <Paper className="glass-panel login-panel" elevation={0}>
              <Typography variant="h5">{session ? "You're signed in" : "Sign in"}</Typography>
              <Typography className="login-panel__copy" variant="body2">
                Use the seeded credentials or replace the service layer with the production API.
              </Typography>

              {session ? (
                <div className="login-session">
                  <Typography variant="body1">{session.user.name}</Typography>
                  <Typography variant="body2">
                    {session.user.email} • {session.user.role}
                  </Typography>
                  <Button className="button-secondary" onClick={signOut} variant="outlined">
                    Sign out
                  </Button>
                </div>
              ) : (
                <form className="login-form" onSubmit={handleSubmit}>
                  <TextField label="Email" onChange={handleChange("email")} value={credentials.email} />
                  <TextField
                    label="Password"
                    onChange={handleChange("password")}
                    type="password"
                    value={credentials.password}
                  />
                  {status.message ? <Alert severity={status.type}>{status.message}</Alert> : null}
                  <Button className="button-primary" disabled={authLoading} type="submit" variant="contained">
                    {authLoading ? "Signing in..." : "Login"}
                  </Button>
                </form>
              )}
            </Paper>
          </MotionFade>
        </div>
      </section>
    </div>
  );
}
