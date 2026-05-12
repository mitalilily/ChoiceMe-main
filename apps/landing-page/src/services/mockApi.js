import { trackingSamples } from "../data/siteData";
import { buildRateSummary, generateCourierQuotes } from "../utils/calculators";

const validCredentials = {
  email: "ops@choicemee.com",
  password: "ChoiceMee@123",
};

function wait(ms = 900) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function mockLogin(credentials) {
  await wait(900);

  if (
    credentials.email?.toLowerCase() !== validCredentials.email ||
    credentials.password !== validCredentials.password
  ) {
    throw new Error("Invalid email or password. Use the sample credentials shown on the page.");
  }

  return {
    token: "mock-jwt-token",
    user: {
      name: "Operations Manager",
      email: validCredentials.email,
      role: "admin",
    },
  };
}

export async function mockTrackShipment(trackingId) {
  await wait(1100);
  const shipment = trackingSamples.find(
    (item) => item.trackingId.toLowerCase() === trackingId.trim().toLowerCase()
  );

  if (!shipment) {
    throw new Error("Tracking ID not found in demo data. Try CMC78254019 or CMC11984027.");
  }

  const activeStep = shipment.timeline.findIndex((item) =>
    ["Pending", "Awaiting final scan"].includes(item.time)
  );

  return {
    ...shipment,
    activeStep: activeStep === -1 ? shipment.timeline.length - 1 : Math.max(activeStep - 1, 0),
  };
}

export async function mockCalculateRates(formValues) {
  await wait(1200);

  const summary = buildRateSummary(formValues);

  if (!summary.valid) {
    throw new Error("Enter valid pincodes, package weight, and dimensions to calculate rates.");
  }

  return {
    summary,
    options: generateCourierQuotes(formValues),
  };
}

export async function mockSubmitContact(payload) {
  await wait(900);

  if (!payload.name || !payload.email || !payload.message) {
    throw new Error("Please complete your name, email, and message.");
  }

  return {
    ok: true,
    message: "Your inquiry has been queued for the ChoiceMee team.",
  };
}
