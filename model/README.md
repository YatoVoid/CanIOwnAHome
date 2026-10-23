# Model

Home for the price/recommendation model. The website talks to it only through the HTTP APIs in [`../CONTRACT.md`](../CONTRACT.md).

Put training code, notebooks and the API server here. Keep raw datasets out of git (`*.csv` is ignored); note where to download them instead.

The deployed endpoints are listed in [`../CONTRACT.md`](../CONTRACT.md). If the URL changes, update `MODEL_API_URL` in Vercel and redeploy.
