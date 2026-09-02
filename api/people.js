import handler from "./social.js";

export default function people(req, res) {
  const url = new URL(req.url, "http://localhost");
  url.searchParams.set("route", "people");
  req.url = `${url.pathname}?${url.searchParams.toString()}`;
  return handler(req, res);
}
