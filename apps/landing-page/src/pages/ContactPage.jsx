import { useState } from "react";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import PageHero from "../components/common/PageHero";
import MotionFade from "../components/common/MotionFade";
import { brand } from "../data/siteData";
import { submitContact } from "../services/api";

const initialForm = {
  name: "",
  email: "",
  phone: brand.phone,
  company: "",
  message: "",
};

export default function ContactPage() {
  const [formValues, setFormValues] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleChange = (key) => (event) => {
    setFormValues((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await submitContact(formValues);
      setStatus({ type: "success", message: response.message });
      setFormValues(initialForm);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHero
        badge="Contact"
        caption="Premium support"
        description="Talk to the ChoiceMee Logistics team about shipping setup, API integrations, pricing logic, or logistics operations."
        title="Let's design a better shipping flow for your business."
      />

      <section className="section-block section-block--dashboard pattern-gradient-mesh">
        <div className="container-shell contact-grid">
          <MotionFade>
            <Paper className="glass-panel contact-card" elevation={0}>
              <Typography className="contact-card__title" variant="h5">
                Reach us directly
              </Typography>
              <Stack spacing={2.4}>
                <div>
                  <Typography className="contact-card__label" variant="body2">
                    Phone
                  </Typography>
                  <a className="contact-card__link" href={`tel:${brand.phone}`}>
                    {brand.phone}
                  </a>
                </div>
                <div>
                  <Typography className="contact-card__label" variant="body2">
                    Email
                  </Typography>
                  <a className="contact-card__link" href={`mailto:${brand.email}`}>
                    {brand.email}
                  </a>
                </div>
                <div>
                  <Typography className="contact-card__label" variant="body2">
                    Address
                  </Typography>
                  <Typography variant="body1">{brand.address}</Typography>
                </div>
              </Stack>
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <Paper className="glass-panel contact-form" elevation={0}>
              <Typography className="contact-card__title" variant="h5">
                Send an inquiry
              </Typography>
              <Typography className="contact-card__subcopy" variant="body2">
                This form is wired to the mock API today and the Express/Mongo contact endpoint when
                `VITE_API_BASE_URL` is configured.
              </Typography>

              <form className="contact-form__fields" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <TextField label="Name" onChange={handleChange("name")} required value={formValues.name} />
                  <TextField
                    label="Email"
                    onChange={handleChange("email")}
                    required
                    type="email"
                    value={formValues.email}
                  />
                </div>
                <div className="form-grid">
                  <TextField label="Phone" onChange={handleChange("phone")} value={formValues.phone} />
                  <TextField
                    label="Company"
                    onChange={handleChange("company")}
                    value={formValues.company}
                  />
                </div>
                <TextField
                  label="Message"
                  minRows={5}
                  multiline
                  onChange={handleChange("message")}
                  required
                  value={formValues.message}
                />

                {status.message ? <Alert severity={status.type}>{status.message}</Alert> : null}

                <Button className="button-primary" disabled={loading} type="submit" variant="contained">
                  {loading ? "Sending..." : "Send inquiry"}
                </Button>
              </form>
            </Paper>
          </MotionFade>
        </div>
      </section>
    </div>
  );
}
