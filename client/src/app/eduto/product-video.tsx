"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./eduto.module.css";

/**
 * Hlavní CTA — 90sekundové video v nativním <dialog>.
 * Nativní dialog dává focus trap, Esc a inertní pozadí bez knihovny.
 *
 * VIDEO ZATÍM CHYBÍ: až dodáš soubor, nahraj ho jako
 * client/public/eduto/produkt.mp4 (ideálně i .webm) a nastav VIDEO_EXISTS = true.
 */
const VIDEO_EXISTS = false;
const VIDEO_SRC = "/eduto/produkt.mp4";

export function ProductVideo(): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Esc zavírá dialog nativně — stav i fokus musí jít s ním.
  const handleClose = (): void => {
    videoRef.current?.pause();
    setOpen(false);
    // Návrat fokusu nenecháváme jen na prohlížeči.
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.btnPrimar}
        onClick={() => setOpen(true)}
      >
        Projít produkt
      </button>

      <dialog
        ref={dialogRef}
        className={styles.modal}
        aria-labelledby="eduto-video-titulek"
        onClose={handleClose}
      >
        <div className={styles.modalObsah}>
          <div className={styles.modalHlavicka}>
            <h2 id="eduto-video-titulek" className={styles.modalTitulek}>
              Průchod produktem · 90 sekund
            </h2>
            <button
              type="button"
              className={styles.modalZavrit}
              onClick={handleClose}
            >
              Zavřít
            </button>
          </div>

          {VIDEO_EXISTS ? (
            <video
              ref={videoRef}
              className={styles.modalVideo}
              src={VIDEO_SRC}
              controls
              playsInline
              preload="none"
            />
          ) : (
            <p className={styles.modalChybi}>
              Místo pro 90sekundový průchod produktem.
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
