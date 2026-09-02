import handler from "../social.js";

export default function request(req, res) {
  const url = new URL(req.url, "http://localhost");
  url.searchParams.set("route", "request");
  req.url = `${url.pathname}?${url.searchParams.toString()}`;
  return handler(req, res);
}
