import { MediaLibrary } from "@/components/media/MediaLibrary";

export default function LifestyleImages() {
  return (
    <div>
      <div className="wt-page-header">
        <h1 className="wt-page-title">Lifestyle Images</h1>
      </div>
      
      <MediaLibrary type="lifestyle_images" />
    </div>
  );
}
