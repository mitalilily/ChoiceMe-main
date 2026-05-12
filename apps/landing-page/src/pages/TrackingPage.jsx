import { useEffect, useState, startTransition } from "react";
import { Alert, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import LoadingCard from "../components/common/LoadingCard";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import TrackingTimeline from "../components/tracking/TrackingTimeline";
import { pageArtwork, trackingSamples } from "../data/siteData";
import { searchTracking } from "../services/api";

export default function TrackingPage() {
  const [trackingId, setTrackingId] = useState(trackingSamples[0].trackingId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const runTracking = async (id = trackingId) => {
    setLoading(true);
    setError("");

    try {
      const response = await searchTracking(id);
      startTransition(() => {
        setResult(response);
      });
    } catch (trackingError) {
      startTransition(() => {
        setResult(null);
        setError(trackingError.message);
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTracking(trackingSamples[0].trackingId);
  }, []);

  return (
    <div className="page-shell">
      <PageHero
        artwork={pageArtwork.trackingHero}
       
        description="Enter a tracking ID to follow the parcel status, route updates, and delivery progress from dispatch to doorstep."
        title="Track your shipment with clear, real-time updates."
      />

      <section className="section-block section-block--dashboard pattern-chevrons">
        <div className="container-shell tracking-layout">
          <div className="tracking-layout__aside">
            <MotionFade>
              <Paper className="glass-panel tracking-search" elevation={0}>
                <Typography variant="h5">Search tracking ID</Typography>
                <Typography className="tracking-search__copy" variant="body2">
                  Try the seeded demo IDs below or connect the page to the backend shipment lookup API.
                </Typography>
                <form
                  className="tracking-search__form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runTracking();
                  }}
                >
                  <TextField
                    fullWidth
                    label="Tracking ID"
                    onChange={(event) => setTrackingId(event.target.value)}
                    value={trackingId}
                  />
                  <Button className="button-primary" disabled={loading} type="submit" variant="contained">
                    {loading ? "Tracking..." : "Track shipment"}
                  </Button>
                </form>
                <Stack direction="row" flexWrap="wrap" gap={1.2}>
                  {trackingSamples.map((sample) => (
                    <Chip
                      key={sample.trackingId}
                      label={sample.trackingId}
                      onClick={() => {
                        setTrackingId(sample.trackingId);
                        runTracking(sample.trackingId);
                      }}
                    />
                  ))}
                </Stack>
                {error ? <Alert severity="error">{error}</Alert> : null}
              </Paper>
            </MotionFade>

            <MotionFade className="tracking-layout__art" delay={0.08}>
              <div className="illustration-panel illustration-panel--tracking illustration-panel--compact">
                <img alt={pageArtwork.trackingAside.alt} className="illustration-panel__image" src={pageArtwork.trackingAside.src} />
              </div>
            </MotionFade>
          </div>

          <div className="tracking-layout__results">
            {loading ? (
              <div className="tracking-loading-grid">
                <LoadingCard lines={5} />
                <LoadingCard lines={6} />
              </div>
            ) : result ? (
              <>
                <MotionFade delay={0.12}>
                  <Paper className="glass-panel tracking-spotlight" elevation={0}>
                    <div>
                      <Typography variant="overline">Shipment spotlight</Typography>
                      <Typography variant="h4">
                        {result.trackingId} - {result.orderId}
                      </Typography>
                      <Typography className="tracking-spotlight__copy" variant="body2">
                        Customer {result.customer} - {result.paymentType}
                      </Typography>
                    </div>
                    <Chip className="tracking-spotlight__chip" label={result.status} />
                  </Paper>
                </MotionFade>

                <TrackingTimeline activeStep={result.activeStep} timeline={result.timeline} />
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
