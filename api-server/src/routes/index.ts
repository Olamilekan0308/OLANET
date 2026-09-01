import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import olanetAIRouter from "./olanet-ai-v2";
import supportAIRouter from "./support-ai";
import circlesRouter from "./circles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(olanetAIRouter);
router.use(supportAIRouter);
router.use(circlesRouter);

export default router;
