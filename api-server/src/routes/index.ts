import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import olanetAIRouter from "./olanet-ai-v2";
import supportAIRouter from "./support-ai";
import circlesRouter from "./circles";
import socialRouter from "./social";
import messagesRouter from "./messages";
import settingsRouter from "./settings";
import friendsRouter from "./friends";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(olanetAIRouter);
router.use(supportAIRouter);
router.use(circlesRouter);
router.use(socialRouter);
router.use("/messages", messagesRouter);
router.use(settingsRouter);
router.use(friendsRouter);

export default router;
