import { useState, useRef, useEffect } from "react";
import supabase, { BUCKET_ID } from "../lib/supabase";

// Mock filter images - replace with your actual art images
const filterImages = [
  { id: 1, src: "/filters/starry-night.jpg", name: "Starry Night" },
  { id: 2, src: "/filters/scream.jpg", name: "The Scream" },
  { id: 3, src: "/filters/guernica.jpg", name: "Guernica" },
  {
    id: 4,
    src: "/filters/persistence-of-memory.jpg",
    name: "Persistence of Memory",
  },
];

// Add this utility function at the top of the file
const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export default function Camera() {
  // State management
  const [appState, setAppState] = useState<"camera" | "preview" | "processing">(
    "camera"
  );

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera
  useEffect(() => {
    if (appState === "camera") {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
        }
      };

      startCamera();

      // Cleanup function to stop camera when component unmounts or state changes
      return () => {
        const stream = videoRef.current?.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      };
    }
  }, [appState]);

  // Take picture function
  const takePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to data URL
        const imageDataUrl = canvas.toDataURL("image/png");
        setCapturedImage(imageDataUrl);
        setAppState("preview");
      }
    }
  };

  // Retake picture function
  const retakePicture = () => {
    setCapturedImage(null);
    setSelectedFilter(null);
    setAppState("camera");
  };

  // Apply filter function
  const applyFilter = async (filterId: number) => {
    setSelectedFilter(filterId);
    setAppState("processing");
    setError(null);

    try {
      setIsUploading(true);

      // Convert the base64 image to a File object
      const imageFile = dataURLtoFile(
        capturedImage!,
        `photo-${Date.now()}.png`
      );

      // Upload original image to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(`originals/${imageFile.name}`, imageFile, {
          contentType: "image/png",
          cacheControl: "3600",
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL of the uploaded image
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(`originals/${imageFile.name}`);

      setProcessedImage(publicUrlData.publicUrl);
      setIsUploading(false);
    } catch (err) {
      console.error("Error uploading image:", err);
      setError("Failed to upload image. Please try again.");
      setIsUploading(false);
      setAppState("preview");
    }
  };

  // Render different UI based on current state
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center">
      {/* Hidden canvas for capturing images */}
      <canvas ref={canvasRef} className="hidden" />

      {/* STATE 1: Camera View */}
      {appState === "camera" && (
        <>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <button
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-[70px] h-[70px] rounded-full bg-white/30 flex items-center justify-center cursor-pointer"
            onClick={takePicture}
            aria-label="Take picture"
          >
            <div className="w-[60px] h-[60px] rounded-full bg-white " />
          </button>
        </>
      )}

      {/* STATE 2: Preview with Filter Options */}
      {appState === "preview" && capturedImage && (
        <>
          <div className="relative w-full h-full">
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover"
            />

            <button
              className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-[70px] h-[70px] rounded-full bg-white/80 flex items-center justify-center cursor-pointer"
              onClick={retakePicture}
              aria-label="Retake picture"
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-gray-800">
                <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
              </svg>
            </button>

            <div className="absolute right-5 top-1/2 transform -translate-y-1/2 flex flex-col gap-4 max-h-[80vh] overflow-y-auto p-2.5">
              {filterImages.map((filter) => (
                <div
                  key={filter.id}
                  className="w-[200px] h-[150px] bg-white/90 rounded-xl overflow-hidden shadow-lg cursor-pointer transition-transform hover:scale-105"
                  onClick={() => applyFilter(filter.id)}
                >
                  <img
                    src={filter.src}
                    alt={filter.name}
                    className="w-full h-[120px] object-cover"
                  />
                  <span className="block p-2 text-center font-medium">
                    {filter.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* STATE 3: Processing and Result */}
      {appState === "processing" && (
        <div className="flex flex-col items-center justify-center w-full h-full bg-black">
          {error ? (
            <div className="text-red-500 text-center p-4 bg-white/10 rounded-lg">
              <p>{error}</p>
              <button
                className="mt-4 px-6 py-2 bg-white/80 rounded-full font-medium hover:bg-white transition-colors"
                onClick={() => setAppState("preview")}
              >
                Try Again
              </button>
            </div>
          ) : !processedImage ? (
            <>
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-5" />
              <p className="text-white text-lg">
                {isUploading
                  ? "Uploading image..."
                  : "Applying artistic style..."}
              </p>
            </>
          ) : (
            <>
              <img
                src={processedImage}
                alt="Processed"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-10 flex gap-5">
                <button
                  className="px-6 py-3 bg-white/80 rounded-full font-medium hover:bg-white transition-colors"
                  onClick={retakePicture}
                >
                  Take New Photo
                </button>
                <button
                  className="px-6 py-3 bg-white/80 rounded-full font-medium hover:bg-white transition-colors"
                  onClick={() => {
                    // Download the processed image
                    const link = document.createElement("a");
                    link.href = processedImage;
                    link.download = "artistic-photo.png";
                    link.click();
                  }}
                >
                  Download
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
