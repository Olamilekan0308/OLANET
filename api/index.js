import app from "../api-server/src/vercel-app.ts";

export const config = {
  maxDuration: 30,
};

export default function handler(req, res) {
  return app(req, res);
}
