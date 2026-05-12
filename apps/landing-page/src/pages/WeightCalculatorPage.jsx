import { useDeferredValue, useMemo, useState } from "react";
import { Alert, Paper, Slider, Stack, TextField, Typography } from "@mui/material";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import WeightVisualizer from "../components/weight/WeightVisualizer";
import { defaultWeightForm, pageArtwork, weightGuideSteps } from "../data/siteData";
import { calculateVolumetricWeight, formatWeight, getBillableWeight } from "../utils/calculators";

export default function WeightCalculatorPage() {
  const [formValues, setFormValues] = useState(defaultWeightForm);
  const deferredValues = useDeferredValue(formValues);

  const volumetricWeight = useMemo(
    () =>
      calculateVolumetricWeight(
        deferredValues.length,
        deferredValues.breadth,
        deferredValues.height
      ),
    [deferredValues]
  );

  const billableWeight = useMemo(
    () => getBillableWeight(deferredValues.actualWeight, volumetricWeight),
    [deferredValues.actualWeight, volumetricWeight]
  );

  const oversize = volumetricWeight > deferredValues.actualWeight;

  const handleSliderChange = (key) => (_, value) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleInputChange = (key) => (event) => {
    setFormValues((current) => ({
      ...current,
      [key]: Number(event.target.value || 0),
    }));
  };

  return (
    <div className="page-shell">
      <PageHero
        artwork={pageArtwork.weightHero}
      

        description="Enter your parcel size and actual weight to see how courier billing works in a simple, clear way."
        title="Measure your parcel and see the billable weight instantly."
      />

      <section className="section-block section-block--guide pattern-dots">
        <div className="container-shell guide-layout">
          <MotionFade className="guide-layout__visual" delay={0.06}>
            <div className="illustration-panel illustration-panel--guide">
              <img
                alt={pageArtwork.weightGuide.alt}
                className="illustration-panel__image"
                src={pageArtwork.weightGuide.src}
              />
            </div>
          </MotionFade>

          <MotionFade delay={0.16}>
            <Paper className="glass-panel user-guide-card" elevation={0}>
              <div className="user-guide-card__header">
                <Typography className="user-guide-card__eyebrow" variant="overline">
                  User guide
                </Typography>
                <Typography variant="h5">How to calculate billable weight</Typography>
                <Typography className="user-guide-card__copy" variant="body2">
                  Follow the same workflow your operations team would use before booking a shipment.
                </Typography>
              </div>

              <Stack gap={2.2} mt={3}>
                {weightGuideSteps.map((step) => (
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

      <section className="section-block section-block--dashboard pattern-splatter">
        <div className="container-shell weight-layout">
          <MotionFade>
            <Paper className="glass-panel weight-controls" elevation={0}>
              <Typography variant="h5">Parcel dimensions</Typography>
              <Typography className="weight-controls__copy" variant="body2">
                The volumetric formula uses the standard divisor of 5000 for courier calculations.
              </Typography>

              <div className="weight-slider-group">
                <label>
                  <span>Length</span>
                  <Slider max={80} min={10} onChange={handleSliderChange("length")} value={formValues.length} />
                </label>
                <label>
                  <span>Breadth</span>
                  <Slider max={80} min={10} onChange={handleSliderChange("breadth")} value={formValues.breadth} />
                </label>
                <label>
                  <span>Height</span>
                  <Slider max={80} min={8} onChange={handleSliderChange("height")} value={formValues.height} />
                </label>
              </div>

              <div className="form-grid form-grid--three">
                <TextField label="Length (cm)" onChange={handleInputChange("length")} value={formValues.length} />
                <TextField label="Breadth (cm)" onChange={handleInputChange("breadth")} value={formValues.breadth} />
                <TextField label="Height (cm)" onChange={handleInputChange("height")} value={formValues.height} />
              </div>
              <TextField
                label="Actual weight (kg)"
                onChange={handleInputChange("actualWeight")}
                value={formValues.actualWeight}
              />
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <Paper className="glass-panel weight-results" elevation={0}>
              <WeightVisualizer
                breadth={deferredValues.breadth}
                height={deferredValues.height}
                length={deferredValues.length}
              />
              <div className="weight-results__summary">
                <div>
                  <span>Volumetric weight</span>
                  <strong>{formatWeight(volumetricWeight)}</strong>
                </div>
                <div>
                  <span>Actual weight</span>
                  <strong>{formatWeight(deferredValues.actualWeight)}</strong>
                </div>
                <div>
                  <span>Billable weight</span>
                  <strong>{formatWeight(billableWeight)}</strong>
                </div>
              </div>
              <Alert severity={oversize ? "warning" : "success"}>
                {oversize
                  ? "Volumetric weight is higher than actual weight, so pricing will likely use the volumetric figure."
                  : "Actual weight is the controlling value right now, which is ideal for compact shipments."}
              </Alert>
            </Paper>
          </MotionFade>
        </div>
      </section>
    </div>
  );
}
