# Model

Home for the price/recommendation model. The website talks to it only through the HTTP API in [`../CONTRACT.md`](../CONTRACT.md).

Put training code, notebooks and the API server here. Keep raw datasets out of git (`*.csv` is ignored); note where to download them instead.

When the API is deployed, set `MODEL_API_URL` (and `MODEL_API_KEY` if you add auth) in the Vercel project and redeploy.
