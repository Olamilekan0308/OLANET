import handler from "../social.js";

export default function update(req, res) {
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1] || "";
  url.searchParams.set("route", "update");
  url.searchParams.set("id", id);
  req.url = `${url.pathname}?${url.searchParams.toString()}`;
  return handler(req, res);
}
