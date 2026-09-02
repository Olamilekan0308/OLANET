import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import olanetAIRouter from "./olanet-ai-v2";
import supportAIRouter from "./support-ai";
import circlesRouter from "./circles";
import peopleDirectRouter from "./people-direct";
import groupsDirectRouter from "./groups-direct";
import socialFixesRouter from "./social-fixes";
import socialRouter from "./social";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(olanetAIRouter);
router.use(supportAIRouter);
router.use(circlesRouter);
router.use(peopleDirectRouter);
router.use(groupsDirectRouter);
router.use(socialFixesRouter);
router.use(socialRouter);
router.use(settingsRouter);

export default router;
