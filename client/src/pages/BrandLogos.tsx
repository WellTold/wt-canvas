import { MediaLibrary } from "@/components/media/MediaLibrary";

export default function BrandLogos() {
  return (
    <div>
      <div className="wt-page-header">
        <h1 className="wt-page-title">Brand Logos</h1>
      </div>
      
      <MediaLibrary type="brand_logos" />
    </div>
  );
}
