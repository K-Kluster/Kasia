import React, { useRef, useEffect, useState } from "react";
import jsQR from "jsqr";
import { CameraIcon } from "@heroicons/react/24/solid";
import { toast } from "../utils/toast";
import clsx from "clsx";
import { Modal } from "./Common/modal";

interface QrScannerProps {
  onScan: (data: string) => void;
}

export const QrScanner: React.FC<QrScannerProps> = ({ onScan }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  // check for camera devices on mount - which includes components this is placed in
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      const hasCam = devices.some((device) => device.kind === "videoinput");
      setHasCamera(hasCam);
    });
  }, []);

  // start camera when modal opens
  useEffect(() => {
    if (!showModal) return;
    if (showModal && !hasCamera) {
      // just in case
      toast.error("Device does not have a supported Camera");
      setShowModal(false);
      return;
    }
    let localStream: MediaStream | null = null;
    let cancelled = false;

    const waitForVideoAndStartCamera = async () => {
      let attempts = 0;
      while (!videoRef.current && attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }
      if (!videoRef.current) {
        toast.error("Video element not able to start");
        setShowModal(false);
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera API not supported. Needs HTTPS");
        setShowModal(false);
        return;
      }
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current && !cancelled) {
          videoRef.current.srcObject = localStream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setStream(localStream);
        }
      } catch (err: unknown) {
        const msg =
          "Could not access camera: " +
          (err instanceof Error ? err.message : String(err));
        toast.error(msg);
        setShowModal(false);
      }
    };

    waitForVideoAndStartCamera();

    return () => {
      cancelled = true;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      setStream(null);
    };
  }, [showModal, hasCamera]);

  // scan when stream is ready
  useEffect(() => {
    if (!stream) return;
    let id: number;
    // create an offscreen canvas for scanning
    const canvas = document.createElement("canvas");
    const tick = () => {
      const v = videoRef.current;
      if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const code = jsQR(
            ctx.getImageData(0, 0, canvas.width, canvas.height).data,
            canvas.width,
            canvas.height
          );
          if (code) {
            onScan(code.data);
            setShowModal(false);
            return;
          }
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [stream, onScan]);

  return (
    <>
      <button
        type="button"
        className={clsx(
          "rounded bg-gray-700 p-2 text-white hover:bg-gray-600",
          {
            "cursor-pointer": hasCamera,
            hidden: !hasCamera,
          }
        )}
        onClick={() => hasCamera && setShowModal(true)}
        title={hasCamera ? "Scan QR code" : "No camera available"}
        disabled={!hasCamera}
      >
        <CameraIcon className="h-5 w-5" />
      </button>
      {/* need to lift the z of the modal because its usually stacked on another modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} className={"z-60"}>
          <div className="flex flex-col items-center border-none bg-transparent p-4">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-sm shadow"
            />
            <div className="mt-2 text-gray-200 italic">Find a KAS QR</div>
          </div>
        </Modal>
      )}
    </>
  );
};
