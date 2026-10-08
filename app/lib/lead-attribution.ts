export type LeadAttribution = {
  landingPage: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

const storageKey = "legservice:first-touch";

function emptyAttribution(): LeadAttribution {
  return {
    landingPage: "",
    referrer: "",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
  };
}

function currentAttribution(): LeadAttribution {
  if (typeof window === "undefined") return emptyAttribution();

  const parameters = new URLSearchParams(window.location.search);
  let referrer = "";
  if (document.referrer) {
    try {
      const url = new URL(document.referrer);
      referrer = url.origin === window.location.origin ? url.pathname : url.origin;
    } catch {
      referrer = "";
    }
  }

  return {
    landingPage: window.location.pathname,
    referrer,
    utmSource: parameters.get("utm_source") || "",
    utmMedium: parameters.get("utm_medium") || "",
    utmCampaign: parameters.get("utm_campaign") || "",
    utmContent: parameters.get("utm_content") || "",
    utmTerm: parameters.get("utm_term") || "",
  };
}

export function captureLeadAttribution() {
  const fallback = currentAttribution();
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) {
      const value = JSON.parse(stored) as Partial<LeadAttribution>;
      return { ...emptyAttribution(), ...value };
    }
    window.sessionStorage.setItem(storageKey, JSON.stringify(fallback));
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
  return fallback;
}

export function getLeadAttribution() {
  return captureLeadAttribution();
}
