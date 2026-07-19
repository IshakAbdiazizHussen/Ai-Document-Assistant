import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatWindow } from "@/components/chat/chat-window";
import { DocumentList } from "@/components/documents/document-list";
import { FileUpload } from "@/components/documents/file-upload";

export default async function DashboardDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FileUpload />
          <DocumentList activeId={id} />
        </CardContent>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col overflow-hidden">
          <ChatWindow documentId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
