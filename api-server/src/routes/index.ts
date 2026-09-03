import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import olanetAIRouter from "./olanet-ai-v2";
import supportAIRouter from "./support-ai";
import circlesRouter from "./circles";
import socialRouter from "./social";
import socialV2Router from "./social-v2";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(olanetAIRouter);
router.use(supportAIRouter);
router.use(circlesRouter);
router.use(socialRouter);
router.use("/social2", socialV2Router);
router.use(settingsRouter);

export default router;
