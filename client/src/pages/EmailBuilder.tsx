import { ContentEditor } from "@/components/content/ContentEditor";
import { useLocation } from "wouter";

interface Props {
  emailId?: string;
}

export default function EmailBuilder({ emailId }: Props) {
  const [, setLocation] = useLocation();

  const handleClose = () => {
    setLocation("/emails");
  };

  return (
    <ContentEditor
      contentItemId={emailId}
      type="email_campaign"
      onClose={handleClose}
    />
  );
}
