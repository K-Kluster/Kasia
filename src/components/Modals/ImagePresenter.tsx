import { useUiStore } from "../../store/ui.store";
import { useEffect } from "react";

// in the modal show an image that is enlarged
export const ImagePresenter = () => {
  const { imagePresenterImage, setImagePresenterImage } = useUiStore();

  // clear image data when component unmounts (modal closes)
  useEffect(() => {
    return () => {
      setImagePresenterImage(null);
    };
  }, [setImagePresenterImage]);

  if (!imagePresenterImage) {
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      <img
        src={imagePresenterImage}
        alt="Presented image"
        className="h-auto max-w-full rounded-lg object-contain"
        style={{ zoom: 1.5 }}
      />
    </div>
  );
};
