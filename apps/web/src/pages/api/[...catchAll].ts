import app from '../../../../api/src/index';

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false,
  },
};

export default function handler(req: any, res: any) {
  // Strip /api prefix so Express routes match correctly
  if (req.url && req.url.startsWith('/api')) {
    req.url = req.url.substring(4) || '/';
  }
  // Pass the request to the Express app
  return app(req, res);
}
