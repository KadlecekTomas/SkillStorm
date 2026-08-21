"use client";

import { Slide, ToastContainer } from "react-toastify";

/**
 * Jednotný transient feedback channel pro celou aplikaci.
 * Vizuál držíme klidný a produktový: bez progress baru, bez bounce animace
 * a maximálně jedna zpráva ve viewportu.
 */
export function AppToasts(): React.JSX.Element {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3200}
      hideProgressBar
      newestOnTop
      closeOnClick={false}
      pauseOnFocusLoss
      draggable={false}
      pauseOnHover
      theme="light"
      transition={Slide}
      limit={1}
      className="skillstorm-toast-container"
      toastClassName="skillstorm-toast"
    />
  );
}
