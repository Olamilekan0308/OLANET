import handler from "../../social.js";

export default function status(req, res) {
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const userId = parts[parts.length - 1] || "";
  url.searchParams.set("route", "status");
  url.searchParams.set("userId", userId);
  req.url = `/?${url.searchParams.toString()}`;
  return handler(req, res);
}
