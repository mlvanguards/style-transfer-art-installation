import { createBrowserRouter } from "react-router-dom";

import Camera from "../pages/camera";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Camera />,
  },
]);

export default router;
