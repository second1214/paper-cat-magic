import { onRequestGet as __api_scores_ts_onRequestGet } from "/home/user/paper-cat-magic/functions/api/scores.ts"
import { onRequestPost as __api_scores_ts_onRequestPost } from "/home/user/paper-cat-magic/functions/api/scores.ts"

export const routes = [
    {
      routePath: "/api/scores",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_scores_ts_onRequestGet],
    },
  {
      routePath: "/api/scores",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_scores_ts_onRequestPost],
    },
  ]