import { useDeferredValue, useMemo, useState, startTransition } from "react";
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import LoadingCard from "../components/common/LoadingCard";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import CourierOptionCard from "../components/rates/CourierOptionCard";
import { defaultRateForm, pageArtwork, paymentModes, rateGuideSteps } from "../data/siteData";
import { requestRateQuote } from "../services/api";
import { buildRateSummary, formatCurrency, formatWeight } from "../utils/calculators";

export default function RateCalculatorPage() {
  const [formValues, setFormValues] = useState(defaultRateForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const deferredForm = useDeferredValue(formValues);

  const previewSummary = useMemo(() => buildRateSummary(deferredForm), [deferredForm]);

  const handleChange = (key) => (event) => {
    setFormValues((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await requestRateQuote(formValues);
      startTransition(() => {
        setResult(response);
      });
    } catch (rateError) {
      startTransition(() => {
        setResult(null);
        setError(rateError.message);
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHero
        artwork={pageArtwork.rateHero}
        
        description="Add your pickup, delivery, and parcel details to view shipping charges in one easy comparison screen."
        title="Check shipping rates fast and choose the best courier."
      />

      <section className="section-block section-block--warm pattern-stripes-vertical">
        <div className="container-shell calculator-layout">
          <MotionFade>
            <Paper className="glass-panel calculator-form-card" elevation={0}>
              <Typography variant="h5">Lane and package details</Typography>
              <Typography className="calculator-form-card__copy" variant="body2">
                Built for prepaid and COD flows with volumetric weight awareness and API-ready output.
              </Typography>

              <form className="calculator-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <TextField
                    inputProps={{ inputMode: "numeric", maxLength: 6 }}
                    label="Origin pincode"
                    onChange={handleChange("originPincode")}
                    value={formValues.originPincode}
                  />
                  <TextField
                    inputProps={{ inputMode: "numeric", maxLength: 6 }}
                    label="Destination pincode"
                    onChange={handleChange("destinationPincode")}
                    value={formValues.destinationPincode}
                  />
                </div>
                <div className="form-grid form-grid--three">
                  <TextField label="Weight (kg)" onChange={handleChange("weight")} value={formValues.weight} />
                  <TextField label="Length (cm)" onChange={handleChange("length")} value={formValues.length} />
                  <TextField label="Breadth (cm)" onChange={handleChange("breadth")} value={formValues.breadth} />
                </div>
                <div className="form-grid">
                  <TextField label="Height (cm)" onChange={handleChange("height")} value={formValues.height} />
                  <TextField
                    label="Payment type"
                    onChange={handleChange("paymentType")}
                    select
                    value={formValues.paymentType}
                  >
                    {paymentModes.map((mode) => (
                      <MenuItem key={mode} value={mode}>
                        {mode}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>

                <Button className="button-primary" disabled={loading} type="submit" variant="contained">
                  {loading ? "Calculating..." : "Calculate rates"}
                </Button>
              </form>

              {error ? <Alert severity="error">{error}</Alert> : null}
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <Paper className="glass-panel live-summary-card" elevation={0}>
              <Typography variant="h5">Live billable preview</Typography>
              <div className="live-summary-card__grid">
                <div>
                  <span>Zone</span>
                  <strong>{previewSummary.zone.label}</strong>
                </div>
                <div>
                  <span>Actual weight</span>
                  <strong>{formatWeight(previewSummary.actualWeight)}</strong>
                </div>
                <div>
                  <span>Volumetric weight</span>
                  <strong>{formatWeight(previewSummary.volumetricWeight)}</strong>
                </div>
                <div>
                  <span>Billable weight</span>
                  <strong>{formatWeight(previewSummary.billableWeight)}</strong>
                </div>
                <div>
                  <span>Payment surcharge</span>
                  <strong>{formatCurrency(previewSummary.paymentSurcharge)}</strong>
                </div>
                <div>
                  <span>Lane SLA</span>
                  <strong>{previewSummary.zone.sla}</strong>
                </div>
              </div>
            </Paper>
          </MotionFade>
        </div>
      </section>

      <section className="section-block section-block--guide pattern-splatter">
        <div className="container-shell guide-layout">
          <MotionFade className="guide-layout__visual" delay={0.06}>
            <div className="illustration-panel illustration-panel--guide illustration-panel--compact">
              <img alt={pageArtwork.rateGuide.alt} className="illustration-panel__image" src={pageArtwork.rateGuide.src} />
            </div>
          </MotionFade>

          <MotionFade delay={0.16}>
            <Paper className="glass-panel user-guide-card" elevation={0}>
              <div className="user-guide-card__header">
                <Typography className="user-guide-card__eyebrow" variant="overline">
                  User guide
                </Typography>
                <Typography variant="h5">How to use this calculator</Typography>
                <Typography className="user-guide-card__copy" variant="body2">
                  Enter the shipment details once and review the live preview before requesting the final courier rates.
                </Typography>
              </div>

              <Stack gap={2.2} mt={3}>
                {rateGuideSteps.map((step) => (
                  <div className="guide-item" key={step.label}>
                    <span className="guide-item__badge">{step.label}</span>
                    <Typography className="guide-item__title" variant="subtitle1">
                      {step.title}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {step.description}
                    </Typography>
                  </div>
                ))}
              </Stack>
            </Paper>
          </MotionFade>
        </div>
      </section>

      <section className="section-block section-block--stats pattern-cross-hatch">
        <div className="container-shell">
          <div className="courier-results-grid">
            {loading
              ? [0, 1, 2].map((index) => <LoadingCard key={index} className="courier-loading-card" lines={6} />)
              : result?.options?.map((option) => <CourierOptionCard key={option.id} option={option} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
