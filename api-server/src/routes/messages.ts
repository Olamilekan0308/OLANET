import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import socialRouter from "./social";

const router: IRouter = Router();

// The frontend uses /api/messages/* while the existing social router exposes
// direct-message endpoints at /api/conversations/*. Keep both contracts valid
// so the UI and older clients can coexist.
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.method === "POST" && req.path === "/conversations" && typeof req.body?.user_id === "string" && !req.body?.user_ids) {
    req.body.user_ids = [req.body.user_id];
  }
  next();
});

router.use(socialRouter);

export default router;
