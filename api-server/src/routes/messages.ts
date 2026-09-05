import { Router, type IRouter, type Request, type NextFunction } from "express";
import socialRouter from "./social";

const router: IRouter = Router();

// Keep the legacy /api/messages namespace, but let the single social router own
// conversation/message endpoints. This prevents duplicate route definitions from
// shadowing the richer conversation response used by the Messenger UI.
router.use((req: Request, _res, next: NextFunction) => {
  if (req.method === "POST" && req.path === "/conversations" && typeof req.body?.user_id === "string" && !req.body?.user_ids) {
    req.body.user_ids = [req.body.user_id];
  }
  next();
});

router.use(socialRouter);

export default router;
