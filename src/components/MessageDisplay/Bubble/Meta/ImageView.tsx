import { FC } from "react";
import { ScanEye } from "lucide-react";
import { KasiaConversationEvent } from "../../../../types/all";
import { useUiStore } from "../../../../store/ui.store";
import { extractFileData, isImageType } from "../../../../utils/parse-message";

type ImageViewProps = {
  data: KasiaConversationEvent;
  position: string;
};

export const ImageView: FC<ImageViewProps> = ({ data, position }) => {
  const { openModal, setImagePresenterImage } = useUiStore();
  const containerClass = position === "left" ? "ml-2" : "mr-2";

  if (!isImageType(data)) {
    return null;
  }

  const handleImageClick = () => {
    const fileData = extractFileData(data);
    if (fileData && fileData.content) {
      setImagePresenterImage(fileData.content);
      openModal("image");
    }
  };

  return (
    <div className={`${containerClass} flex items-center`}>
      <button
        className="cursor-pointer opacity-80 transition-opacity hover:opacity-100"
        onClick={handleImageClick}
      >
        <ScanEye className="size-6" />
      </button>
    </div>
  );
};
