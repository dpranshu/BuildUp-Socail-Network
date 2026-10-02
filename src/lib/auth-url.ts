export function getAppOrigin(request: Request): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    const configured = new URL(configuredSiteUrl);
    if (configured.protocol !== "http:" && configured.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.");
    }
    return configured.origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  if (!/^[a-z\d.-]+(?::\d{1,5})?$/i.test(requestHost)) {
    throw new Error("Invalid application host.");
  }

  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProtocol = forwardedProtocol ? `${forwardedProtocol}:` : new URL(request.url).protocol;
  const protocol = requestProtocol === "https:" ? "https:" : "http:";
  return new URL(`${protocol}//${requestHost}`).origin;
}